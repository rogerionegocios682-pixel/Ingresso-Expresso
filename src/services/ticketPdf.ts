import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Event, Ticket, TicketBatch } from '../types';

/**
 * Utility to convert an image URL or base64 into a clean Data URL for jsPDF.
 * Preserves PNG transparency when applicable, and includes a timeout and graceful
 * error catching to prevent hangs.
 */
export async function getCleanImageDataUrl(url?: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  if (!url || !url.trim()) return null;

  const isPng = url.toLowerCase().includes('.png') || url.startsWith('data:image/png');
  const format = isPng ? 'PNG' : 'JPEG';

  if (url.startsWith('data:image/')) {
    return { dataUrl: url, format };
  }

  try {
    const loadImagePromise = new Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null>((resolve) => {
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
          const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.9);
          resolve({ dataUrl, format });
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
    width: 320,
    margin: 1,
    color: {
      dark: '#0f172a', // Slate 900
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  });
}

/**
 * Mathematical Layout Geometry for A4 Printing
 * Individual ticket: 90 mm x 50 mm
 * A4 Sheet: 297 mm x 210 mm (Landscape)
 * Columns: 3 (3 x 90 = 270 mm, left/right margins = 13.5 mm)
 * Rows: 4 (4 x 50 = 200 mm, top/bottom margins = 5.0 mm)
 * Max capacity: 12 tickets per A4 sheet
 */
export interface A4LayoutCalculation {
  orientation: 'landscape' | 'portrait';
  pageWidth: number;
  pageHeight: number;
  ticketWidth: number;
  ticketHeight: number;
  columns: number;
  rows: number;
  ticketsPerPage: number;
  marginLeft: number;
  marginTop: number;
  gapX: number;
  gapY: number;
}

export function calculateA4Layout(): A4LayoutCalculation {
  const pageWidth = 297; // Landscape A4 mm
  const pageHeight = 210; // Landscape A4 mm
  const ticketWidth = 90; // 9 cm
  const ticketHeight = 50; // 5 cm

  const columns = Math.floor(pageWidth / ticketWidth); // 3
  const rows = Math.floor(pageHeight / ticketHeight); // 4
  const ticketsPerPage = columns * rows; // 12

  const marginLeft = (pageWidth - columns * ticketWidth) / 2; // 13.5 mm
  const marginTop = (pageHeight - rows * ticketHeight) / 2; // 5.0 mm

  return {
    orientation: 'landscape',
    pageWidth,
    pageHeight,
    ticketWidth,
    ticketHeight,
    columns,
    rows,
    ticketsPerPage,
    marginLeft,
    marginTop,
    gapX: 0,
    gapY: 0
  };
}

/**
 * Renders a single 90 mm x 50 mm ticket at the given (originX, originY) coordinates.
 * Supports both standalone 90x50 mm pages (originX=0, originY=0) and tiled A4 sheets.
 * Integrates Cover Image and Event Logo proportionally and cleanly.
 */
export function renderTicket(
  doc: jsPDF,
  ticket: Ticket,
  event: Event,
  batch: TicketBatch | undefined,
  qrDataUrl: string,
  coverImage: { dataUrl: string; format: 'PNG' | 'JPEG' } | null,
  logoImage: { dataUrl: string; format: 'PNG' | 'JPEG' } | null,
  originX: number = 0,
  originY: number = 0,
  drawCutMarks: boolean = false
): void {
  const w = 90;
  const h = 50;

  // --- 1. BASE BACKGROUND & TICKET CONTAINER (90 mm x 50 mm) ---
  doc.setFillColor(255, 255, 255);
  doc.rect(originX, originY, w, h, 'F');

  // Outer subtle frame (0.8mm from physical ticket edges)
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.25);
  doc.roundedRect(originX + 0.8, originY + 0.8, w - 1.6, h - 1.6, 1.0, 1.0, 'S');

  // Optional cutting guidelines / crop marks when printing on A4 sheet
  if (drawCutMarks) {
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([1.0, 1.0], 0);
    doc.rect(originX, originY, w, h, 'S');
    doc.setLineDashPattern([], 0);

    // Corner crop tick marks
    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.2);
    // Top-left
    doc.line(originX - 2, originY, originX, originY);
    doc.line(originX, originY - 2, originX, originY);
    // Top-right
    doc.line(originX + w, originY, originX + w + 2, originY);
    doc.line(originX + w, originY - 2, originX + w, originY);
    // Bottom-left
    doc.line(originX - 2, originY + h, originX, originY + h);
    doc.line(originX, originY + h, originX, originY + h + 2);
    // Bottom-right
    doc.line(originX + w, originY + h, originX + w + 2, originY + h);
    doc.line(originX + w, originY + h, originX + w, originY + h + 2);
  }

  // --- 2. HEADER: EVENT COVER, LOGO & METADATA (Height: 14.5 mm) ---
  const headerY = originY + 1.0;
  const headerH = 14.2;

  // Solid dark premium header background
  doc.setFillColor(9, 13, 22); // Deep Slate
  doc.rect(originX + 1.0, headerY, w - 2.0, headerH, 'F');

  let textStartX = originX + 3.0;

  // Render Event Cover Artwork Thumbnail
  if (coverImage) {
    try {
      const artW = 18;
      const artH = 11.8;
      const artX = originX + 2.4;
      const artY = headerY + 1.2;

      doc.addImage(coverImage.dataUrl, coverImage.format, artX, artY, artW, artH);

      // Border around cover
      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.2);
      doc.rect(artX, artY, artW, artH, 'S');

      textStartX = originX + 22.0;
    } catch {
      textStartX = originX + 3.0;
    }
  }

  // Render Event Logo (placed in header or right before stub)
  let headerRightMargin = originX + 58.0;
  if (logoImage) {
    try {
      const logoBoxW = 13.5;
      const logoBoxH = 11.5;
      const logoX = originX + 59.0 - logoBoxW - 1.5;
      const logoY = headerY + 1.35;

      // Clean background pill for logo if dark
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(logoX - 0.5, logoY - 0.5, logoBoxW + 1.0, logoBoxH + 1.0, 0.6, 0.6, 'F');

      doc.addImage(logoImage.dataUrl, logoImage.format, logoX, logoY, logoBoxW, logoBoxH);

      headerRightMargin = logoX - 1.5;
    } catch {
      headerRightMargin = originX + 58.0;
    }
  }

  // Event Name (Bold white)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);

  const availableTitleChars = Math.max(16, Math.floor((headerRightMargin - textStartX) * 1.6));
  const rawEventName = (event.name || ticket.eventName || 'EVENTO').toUpperCase();
  const truncatedEventName = rawEventName.length > availableTitleChars
    ? rawEventName.slice(0, availableTitleChars - 2) + '...'
    : rawEventName;
  doc.text(truncatedEventName, textStartX, headerY + 4.4);

  // Date and Time (Sky Blue / High contrast)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(56, 189, 248); // sky-400
  const formattedDate = event.date ? event.date.split('-').reverse().join('/') : '';
  const dateStr = formattedDate ? `DATA: ${formattedDate}` : 'DATA A DEFINIR';
  const timeStr = event.startTime ? `ÀS ${event.startTime}` : '';
  doc.text(`${dateStr} ${timeStr}`.trim(), textStartX, headerY + 8.3);

  // Venue & City (Soft light gray)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.0);
  doc.setTextColor(203, 213, 225); // slate-300
  const venueStr = (event.venue || event.address || 'Portaria Principal').toUpperCase();
  const cityStr = event.city ? `• ${event.city.toUpperCase()}` : '';
  const fullVenue = `${venueStr} ${cityStr}`.trim();
  const availableVenueChars = Math.max(18, Math.floor((headerRightMargin - textStartX) * 2.0));
  const truncatedVenue = fullVenue.length > availableVenueChars
    ? fullVenue.slice(0, availableVenueChars - 2) + '...'
    : fullVenue;
  doc.text(truncatedVenue, textStartX, headerY + 12.0);

  // --- 3. PERFORATION DIVIDER & NOTCHES (x = originX + 59 mm) ---
  const stubDividerX = originX + 59.0;

  // Semicircular notches at top and bottom of perforation line
  doc.setFillColor(255, 255, 255);
  doc.circle(stubDividerX, headerY + headerH, 1.2, 'F');
  doc.circle(stubDividerX, originY + 48.8, 1.2, 'F');

  // Perforated line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.2, 0.8], 0);
  doc.line(stubDividerX, headerY + headerH + 1.2, stubDividerX, originY + 47.6);
  doc.setLineDashPattern([], 0); // Reset dash

  // --- 4. TICKET BODY: LEFT COLUMN (x = originX + 2.5 to 58 mm) ---
  // Batch & Ticket Category Badge
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254); // indigo-200
  doc.setLineWidth(0.2);
  doc.roundedRect(originX + 2.5, originY + 16.8, 54, 5.8, 0.8, 0.8, 'FD');

  doc.setTextColor(67, 56, 202); // indigo-700
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  const rawBatch = ticket.batchName || batch?.name || '1º LOTE';
  const rawType = ticket.ticketTypeName || 'INGRESSO';
  const batchLabel = `${rawBatch} • ${rawType}`.toUpperCase();
  doc.text(batchLabel.length > 33 ? batchLabel.slice(0, 31) + '...' : batchLabel, originX + 4.5, originY + 20.8);

  // Customer / Bearer
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.6);
  doc.text('TITULAR / PORTADOR:', originX + 3.0, originY + 25.8);

  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  const attendeeName = (ticket.customerName || 'INGRESSO AO PORTADOR').toUpperCase();
  doc.text(attendeeName.length > 30 ? attendeeName.slice(0, 28) + '...' : attendeeName, originX + 3.0, originY + 29.2);

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
    docLine = 'Ingresso Oficial com Autenticação Antifraude';
  }
  doc.text(docLine, originX + 3.0, originY + 32.8);

  // Venue Access instructions
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.6);
  doc.text('LOCAL / PORTARIA:', originX + 3.0, originY + 36.8);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.0);
  const gateInfo = (event.venue ? `${event.venue}` : 'Portaria Principal').toUpperCase();
  doc.text(gateInfo.length > 34 ? gateInfo.slice(0, 32) + '...' : gateInfo, originX + 3.0, originY + 40.0);

  // Price & Payment
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  const priceFormatted = ticket.price === 0
    ? 'CORTESIA (R$ 0,00)'
    : `VALOR: R$ ${ticket.price.toFixed(2).replace('.', ',')}`;
  const payMethod = ticket.paymentMethod ? ` (${ticket.paymentMethod.toUpperCase()})` : '';
  doc.text(`${priceFormatted}${payMethod}`, originX + 3.0, originY + 44.2);

  // Anti-fraud micro notice
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.0);
  doc.text('Válido p/ 1 entrada única • Apresente na portaria • Proibida reprodução', originX + 3.0, originY + 47.8);

  // --- 5. TICKET STUB: RIGHT COLUMN (x = originX + 59 to 89 mm, width = 30 mm) ---
  // Stub Header
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.text('CONTROLE DE ACESSO', originX + 74.0, originY + 17.6, { align: 'center' });

  // High Resolution QR Code Image (22.5 mm x 22.5 mm, centered on stub)
  const qrX = originX + 62.75;
  const qrY = originY + 19.0;
  const qrSize = 22.5;
  try {
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch (err) {
    console.error('Erro ao renderizar imagem do QR code no PDF:', err);
  }

  // Structured Sequential Ticket Code (Centered below QR code)
  doc.setTextColor(15, 23, 42);
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.2);
  const codeText = ticket.ticketNumber || ticket.id;
  doc.text(codeText, originX + 74.0, originY + 44.2, { align: 'center' });

  // Security Hash verification string (Last 8 chars)
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.3);
  const tokenClean = ticket.validationToken || '';
  const tokenHash = tokenClean.length > 8 ? tokenClean.slice(-8).toUpperCase() : tokenClean.toUpperCase() || 'VALID';
  doc.text(`HASH: #${tokenHash}`, originX + 74.0, originY + 47.4, { align: 'center' });
}

/**
 * Creates and compiles a jsPDF document containing the given tickets formatted for
 * OPTIMIZED A4 PRINTING (12 tickets per sheet, 90mm x 50mm each, landscape orientation).
 */
export async function generateA4TicketsPDFDocument(
  tickets: Ticket[],
  event: Event,
  batch?: TicketBatch,
  onProgress?: (current: number, total: number) => void
): Promise<jsPDF> {
  if (!tickets || tickets.length === 0) {
    throw new Error('Nenhum ingresso fornecido para geração do PDF A4.');
  }

  const layout = calculateA4Layout();

  // Create A4 document in Landscape orientation
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Pre-load event cover and logo images once for ultra-fast rendering
  const [coverImage, logoImage] = await Promise.all([
    getCleanImageDataUrl(event.coverImage || batch?.artworkUrl),
    getCleanImageDataUrl(event.logoImage)
  ]);

  const totalTickets = tickets.length;
  const totalPages = Math.ceil(totalTickets / layout.ticketsPerPage);

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    if (pageIndex > 0) {
      doc.addPage('a4', 'landscape');
    }

    onProgress?.(pageIndex + 1, totalPages);

    // Subtle header note at top margin of sheet for production/printing reference
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400
    const printInfo = `${(event.name || 'EVENTO').toUpperCase()} • LOTE: ${(batch?.name || tickets[0]?.batchName || 'GERAL').toUpperCase()} • PÁGINA ${pageIndex + 1} DE ${totalPages} • FORMATO 90x50 MM (12 INGRESSOS/FOLHA A4)`;
    doc.text(printInfo, layout.pageWidth / 2, 3.8, { align: 'center' });

    // Render tickets on this page (up to 12)
    const startIndex = pageIndex * layout.ticketsPerPage;
    const endIndex = Math.min(startIndex + layout.ticketsPerPage, totalTickets);

    for (let i = startIndex; i < endIndex; i++) {
      const ticket = tickets[i];
      const slotIndex = i - startIndex;
      const col = slotIndex % layout.columns;
      const row = Math.floor(slotIndex / layout.columns);

      const originX = layout.marginLeft + col * layout.ticketWidth;
      const originY = layout.marginTop + row * layout.ticketHeight;

      // Generate unique QR code for each individual ticket
      const qrDataUrl = await generateQrDataUrl(ticket.validationToken || ticket.ticketNumber);

      // Render the ticket with subtle cutting marks enabled
      renderTicket(
        doc,
        ticket,
        event,
        batch,
        qrDataUrl,
        coverImage,
        logoImage,
        originX,
        originY,
        true // drawCutMarks = true for A4 sheet
      );
    }
  }

  return doc;
}

/**
 * Creates and compiles a jsPDF document containing the given tickets in STANDALONE 90mm x 50mm format.
 * (1 ticket per page, exactly 9cm x 5cm).
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

  // Pre-load event cover and logo images once for ultra-fast rendering
  const [coverImage, logoImage] = await Promise.all([
    getCleanImageDataUrl(event.coverImage || batch?.artworkUrl),
    getCleanImageDataUrl(event.logoImage)
  ]);

  const total = tickets.length;

  for (let i = 0; i < total; i++) {
    const ticket = tickets[i];
    if (i > 0) {
      doc.addPage([90, 50], 'landscape');
    }

    onProgress?.(i + 1, total);

    // Generate unique QR code for this ticket
    const qrDataUrl = await generateQrDataUrl(ticket.validationToken || ticket.ticketNumber);

    renderTicket(doc, ticket, event, batch, qrDataUrl, coverImage, logoImage, 0, 0, false);
  }

  return doc;
}

/**
 * Generates an A4 PDF Blob for the provided tickets (12 tickets per sheet).
 */
export async function generateA4TicketsPDFBlob(
  tickets: Ticket[],
  event: Event,
  batch?: TicketBatch,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const doc = await generateA4TicketsPDFDocument(tickets, event, batch, onProgress);
  return doc.output('blob');
}

/**
 * Generates a PDF Blob for the provided tickets (exact 9cm x 5cm standalone pages).
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
 * Generate a PDF for multiple tickets formatted for A4 PRINTING (12 tickets per page) and triggers browser download.
 */
export async function exportTicketsBatchToA4PDF(
  tickets: Ticket[],
  event: Event,
  batch?: TicketBatch,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const doc = await generateA4TicketsPDFDocument(tickets, event, batch, onProgress);

  const cleanEventName = (event.name || 'evento').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanBatchName = (batch?.name || tickets[0]?.batchName || 'lote').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Ingressos_Folha_A4_${cleanEventName}_${cleanBatchName}_${tickets.length}un.pdf`;

  doc.save(filename);
}

/**
 * Generate a PDF for multiple tickets (whole batch or selection) and triggers browser download.
 * Every page is strictly 9cm x 5cm (90mm x 50mm landscape).
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
