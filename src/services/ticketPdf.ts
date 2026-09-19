import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Event, Ticket, TicketBatch } from '../types';

/**
 * Utility to convert an image URL or base64 into a clean Data URL for jsPDF.
 * Includes a timeout and graceful error catching to prevent hangs.
 */
async function getCleanImageDataUrl(url?: string): Promise<string | null> {
  if (!url || !url.trim()) return null;
  if (url.startsWith('data:image/')) return url;

  try {
    const loadImagePromise = new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 600;
          canvas.height = img.naturalHeight || 300;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

    // 2.5s safety timeout to prevent hanging on slow network or blocked CORS
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2500);
    });

    return await Promise.race([loadImagePromise, timeoutPromise]);
  } catch {
    return null;
  }
}

/**
 * Generate a high-resolution QR code Data URL for a single ticket token.
 * Uses Error Correction Level 'H' (High) for reliable scanning even on printed/damaged paper.
 */
async function generateQrDataUrl(token: string): Promise<string> {
  return await QRCode.toDataURL(token, {
    width: 300,
    margin: 1,
    color: {
      dark: '#0f172a', // Slate 900
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  });
}

/**
 * Renders a single 9cm x 5cm ticket on the active jsPDF page.
 * Format: 90 mm (width) x 50 mm (height).
 */
function renderTicketPage(
  doc: jsPDF,
  ticket: Ticket,
  event: Event,
  batch: TicketBatch | undefined,
  qrDataUrl: string,
  eventArtworkDataUrl: string | null
): void {
  // --- 1. BASE BACKGROUND & OUTER BOUNDARY (90 mm x 50 mm) ---
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 90, 50, 'F');

  // Outer subtle frame (1mm margin from physical edges)
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.roundedRect(1, 1, 88, 48, 1.2, 1.2, 'S');

  // --- 2. HEADER: EVENT ARTWORK & EVENT METADATA (Height: 14.2 mm) ---
  const headerY = 1.2;
  const headerH = 14.2;

  // Solid dark premium header background
  doc.setFillColor(9, 13, 22); // Deep Slate
  doc.rect(1.2, headerY, 87.6, headerH, 'F');

  let textStartX = 3.8;
  const maxTitleWidth = eventArtworkDataUrl ? 61 : 82;

  // Event Artwork Thumbnail / Banner Frame
  if (eventArtworkDataUrl) {
    try {
      const artW = 20;
      const artH = 11.8;
      const artX = 2.5;
      const artY = headerY + 1.2;

      // Draw artwork
      doc.addImage(eventArtworkDataUrl, 'JPEG', artX, artY, artW, artH);

      // Subtle border around artwork
      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.25);
      doc.rect(artX, artY, artW, artH, 'S');

      textStartX = 24.5;
    } catch {
      textStartX = 3.8;
    }
  }

  // Event Name (Bold white)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  const rawEventName = (event.name || ticket.eventName || 'EVENTO').toUpperCase();
  const truncatedEventName = rawEventName.length > (eventArtworkDataUrl ? 32 : 44)
    ? rawEventName.slice(0, eventArtworkDataUrl ? 30 : 42) + '...'
    : rawEventName;
  doc.text(truncatedEventName, textStartX, headerY + 4.5);

  // Date and Time (Sky Blue / High visibility)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(56, 189, 248); // sky-400
  const formattedDate = event.date ? event.date.split('-').reverse().join('/') : '';
  const dateStr = formattedDate ? `DATA: ${formattedDate}` : 'DATA A DEFINIR';
  const timeStr = event.startTime ? `ÀS ${event.startTime}` : '';
  doc.text(`${dateStr} ${timeStr}`.trim(), textStartX, headerY + 8.4);

  // Venue & City (Soft light gray)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.setTextColor(203, 213, 225); // slate-300
  const venueStr = (event.venue || event.address || 'Portaria Principal').toUpperCase();
  const cityStr = event.city ? `• ${event.city.toUpperCase()}` : '';
  const fullVenue = `${venueStr} ${cityStr}`.trim();
  const truncatedVenue = fullVenue.length > (eventArtworkDataUrl ? 36 : 50)
    ? fullVenue.slice(0, eventArtworkDataUrl ? 34 : 48) + '...'
    : fullVenue;
  doc.text(truncatedVenue, textStartX, headerY + 12.2);

  // --- 3. PERFORATION DIVIDER & NOTCHES (x = 59 mm) ---
  const stubDividerX = 59;

  // Semicircular notches at top and bottom of perforation line (realistic ticket look)
  doc.setFillColor(255, 255, 255);
  doc.circle(stubDividerX, headerY + headerH, 1.2, 'F');
  doc.circle(stubDividerX, 48.8, 1.2, 'F');

  // Perforated line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.2, 0.8], 0);
  doc.line(stubDividerX, headerY + headerH + 1.2, stubDividerX, 47.6);
  doc.setLineDashPattern([], 0); // Reset dash

  // --- 4. TICKET BODY: LEFT COLUMN (x = 2 to 58 mm, width = 56 mm) ---
  // Batch & Ticket Category Badge
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254); // indigo-200
  doc.setLineWidth(0.2);
  doc.roundedRect(3, 17, 53, 6, 0.8, 0.8, 'FD');

  doc.setTextColor(67, 56, 202); // indigo-700
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  const rawBatch = ticket.batchName || batch?.name || '1º LOTE';
  const rawType = ticket.ticketTypeName || 'INGRESSO';
  const batchLabel = `${rawBatch} • ${rawType}`.toUpperCase();
  doc.text(batchLabel.length > 32 ? batchLabel.slice(0, 30) + '...' : batchLabel, 5, 21.2);

  // Customer / Bearer
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.text('TITULAR / PORTADOR:', 3.5, 26);

  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  const attendeeName = (ticket.customerName || 'INGRESSO AO PORTADOR').toUpperCase();
  doc.text(attendeeName.length > 29 ? attendeeName.slice(0, 27) + '...' : attendeeName, 3.5, 29.5);

  // Document or Contact line
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  let docLine = '';
  if (ticket.customerDoc) {
    docLine = `DOC/CPF: ${ticket.customerDoc}`;
  } else if (ticket.customerPhone) {
    docLine = `TEL: ${ticket.customerPhone}`;
  } else {
    docLine = 'Ingresso Individual com Autenticação Antifraude';
  }
  doc.text(docLine, 3.5, 33);

  // Venue Access instructions
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.text('LOCAL / PORTARIA:', 3.5, 37);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  const gateInfo = (event.venue ? `${event.venue}` : 'Portaria Principal').toUpperCase();
  doc.text(gateInfo.length > 32 ? gateInfo.slice(0, 30) + '...' : gateInfo, 3.5, 40.2);

  // Price & Payment
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  const priceFormatted = ticket.price === 0
    ? 'CORTESIA (R$ 0,00)'
    : `VALOR: R$ ${ticket.price.toFixed(2).replace('.', ',')}`;
  const payMethod = ticket.paymentMethod ? ` (${ticket.paymentMethod.toUpperCase()})` : '';
  doc.text(`${priceFormatted}${payMethod}`, 3.5, 44.5);

  // Anti-fraud micro notice
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.2);
  doc.text('Válido p/ 1 entrada única • Apresente na portaria • Proibida reprodução', 3.5, 47.8);

  // --- 5. TICKET STUB: RIGHT COLUMN (x = 59 to 89 mm, width = 30 mm) ---
  // Stub Header
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.6);
  doc.text('CONTROLE DE ACESSO', 74, 18, { align: 'center' });

  // High Resolution QR Code Image (22.5 mm x 22.5 mm, centered on stub)
  const qrX = 62.75;
  const qrY = 19.5;
  const qrSize = 22.5;
  try {
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch (err) {
    console.error('Erro ao renderizar imagem do QR code no PDF:', err);
  }

  // Structured Sequential Ticket Code (Centered below QR code)
  doc.setTextColor(15, 23, 42);
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.4);
  const codeText = ticket.ticketNumber || ticket.id;
  doc.text(codeText, 74, 44.4, { align: 'center' });

  // Security Hash verification string (Last 8 chars)
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.4);
  const tokenClean = ticket.validationToken || '';
  const tokenHash = tokenClean.length > 8 ? tokenClean.slice(-8).toUpperCase() : tokenClean.toUpperCase() || 'VALID';
  doc.text(`HASH: #${tokenHash}`, 74, 47.6, { align: 'center' });
}

/**
 * Creates and compiles a jsPDF document containing the given tickets.
 * Formats every page to exactly 9cm x 5cm (90mm x 50mm landscape).
 */
export async function generateTicketsPDFDocument(
  tickets: Ticket[],
  event: Event,
  batch?: TicketBatch,
  onProgress?: (current: number, total: number) => void
): Promise<jsPDF> {
  if (!tickets || tickets.length === 0) {
    throw new Error('Nenhum ingresso fornecido para geração de PDF.');
  }

  // Exact required physical dimensions: 90 mm x 50 mm (9cm x 5cm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [90, 50]
  });

  // Pre-load event artwork once for efficiency across all tickets
  const artworkDataUrl = await getCleanImageDataUrl(event.coverImage || batch?.artworkUrl);

  const total = tickets.length;

  for (let i = 0; i < total; i++) {
    const ticket = tickets[i];
    if (i > 0) {
      doc.addPage([90, 50], 'landscape');
    }

    onProgress?.(i + 1, total);

    // Generate unique QR code for this ticket
    const qrDataUrl = await generateQrDataUrl(ticket.validationToken || ticket.ticketNumber);

    renderTicketPage(doc, ticket, event, batch, qrDataUrl, artworkDataUrl);
  }

  return doc;
}

/**
 * Generates a PDF Blob for the provided tickets (exact 9cm x 5cm dimensions).
 */
export async function generateTicketsPDFBlob(
  tickets: Ticket[],
  event: Event,
  batch?: TicketBatch,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const doc = await generateTicketsPDFDocument(tickets, event, batch, onProgress);
  return doc.output('blob');
}

/**
 * Generate a PDF for multiple tickets (whole batch or selection) and triggers browser download.
 * Every ticket is strictly formatted to 9cm x 5cm (90mm x 50mm landscape).
 */
export async function exportTicketsBatchToPDF(
  tickets: Ticket[],
  event: Event,
  batch?: TicketBatch,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const doc = await generateTicketsPDFDocument(tickets, event, batch, onProgress);

  const cleanEventName = (event.name || 'evento').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanBatchName = (batch?.name || tickets[0]?.batchName || 'lote').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Ingressos_9x5cm_${cleanEventName}_${cleanBatchName}_${tickets.length}un.pdf`;

  doc.save(filename);
}

/**
 * Generate a PDF for a single individual ticket and triggers browser download.
 * Dimensions: exactly 9cm x 5cm (90mm x 50mm).
 */
export async function exportSingleTicketToPDF(
  ticket: Ticket,
  event: Event,
  batch?: TicketBatch
): Promise<void> {
  const doc = await generateTicketsPDFDocument([ticket], event, batch);

  const cleanEventName = (event.name || 'evento').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanCode = (ticket.ticketNumber || ticket.id).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Ingresso_9x5cm_${cleanEventName}_${cleanCode}.pdf`;

  doc.save(filename);
}
