/**
 * Image upload service with security validations, MIME/extension checks,
 * canvas sanitization, and optimization.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp'
];

export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

export const FORBIDDEN_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.js', '.mjs',
  '.html', '.htm', '.svg', '.vbs', '.scr', '.jar', '.dll', '.bin'
];

export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
}

/**
 * Validates file type, extension, and size according to strict security rules.
 */
export function validateImageFile(
  file: File,
  maxSizeBytes: number = DEFAULT_MAX_FILE_SIZE
): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo fornecido.' };
  }

  // 1. Check file size
  if (file.size <= 0) {
    return { valid: false, error: 'O arquivo selecionado está vazio.' };
  }

  if (file.size > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    const fileMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `O arquivo (${fileMb} MB) excede o tamanho máximo permitido de ${maxMb} MB.`
    };
  }

  // 2. Check forbidden extensions
  const fileNameLower = file.name.toLowerCase();
  for (const forbidden of FORBIDDEN_EXTENSIONS) {
    if (fileNameLower.endsWith(forbidden)) {
      return {
        valid: false,
        error: `Formato de arquivo não autorizado por motivos de segurança (${forbidden}).`
      };
    }
  }

  // 3. Check allowed extensions
  const hasAllowedExt = ALLOWED_IMAGE_EXTENSIONS.some(ext => fileNameLower.endsWith(ext));
  if (!hasAllowedExt) {
    return {
      valid: false,
      error: 'Formato inválido. Por favor, envie uma imagem nos formatos PNG, JPG, JPEG ou WEBP.'
    };
  }

  // 4. Check MIME type
  const normalizedMime = (file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime)) {
    return {
      valid: false,
      error: `Tipo MIME (${normalizedMime || 'desconhecido'}) não permitido. Apenas imagens PNG, JPG ou WEBP são aceitas.`
    };
  }

  return { valid: true, file };
}

/**
 * Decodes the image into an HTML Canvas to sanitize the pixel stream,
 * strip malicious metadata/EXIF payloads, constrain maximum dimensions,
 * and re-encode to a clean, lightweight Base64 Data URL.
 */
export async function processAndOptimizeImage(
  file: File,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    forceFormat?: 'image/jpeg' | 'image/png';
  }
): Promise<string> {
  const maxWidth = options?.maxWidth || 1280;
  const maxHeight = options?.maxHeight || 1280;
  const quality = options?.quality || 0.85;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Erro ao ler os bytes do arquivo selecionado.'));
    };

    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error('Falha ao obter dados da imagem.'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        reject(new Error('O arquivo não pôde ser decodificado como uma imagem válida.'));
      };

      img.onload = () => {
        try {
          let { naturalWidth: width, naturalHeight: height } = img;

          if (width === 0 || height === 0) {
            reject(new Error('Dimensões da imagem inválidas.'));
            return;
          }

          // Calculate aspect ratio preservation
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Fallback to raw data url if 2d context unavailable
            resolve(rawDataUrl);
            return;
          }

          // Draw image to sanitize pixels and strip metadata
          ctx.drawImage(img, 0, 0, width, height);

          // Determine output format
          const isPngSource = file.type === 'image/png';
          const outputFormat = options?.forceFormat || (isPngSource ? 'image/png' : 'image/jpeg');

          const cleanDataUrl = canvas.toDataURL(outputFormat, quality);
          resolve(cleanDataUrl);
        } catch (canvasErr) {
          console.warn('Canvas optimization warning, using raw data url:', canvasErr);
          resolve(rawDataUrl);
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}
