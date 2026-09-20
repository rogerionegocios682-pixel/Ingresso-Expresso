import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Event, Ticket, TicketBatch } from '../types';
import { getEventFromFirestore } from './firebase';

export interface CleanImageData {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  aspectRatio: number; // width / height
}

/**
 * Utility to convert an image URL or base64 into a clean Data URL for jsPDF.
 * Preserves PNG transparency when applicable, calculates aspect ratio for proportionate
 * rendering, and includes a timeout and graceful error catching to prevent hangs.
 */
export async function getCleanImageDataUrl(url?: string): Promise<CleanImageData | null> {
  if (!url || !url.trim()) return null;

  const isPng = url.toLowerCase().includes('.png') || url.startsWith('data:image/png');
  const format: 'PNG' | 'JPEG' = isPng ? 'PNG' : 'JPEG';

  try {
    const loadImagePromise = new Promise<CleanImageData | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const natW = img.naturalWidth || 600;
          const natH = img.naturalHeight || 400;
          const aspectRatio = natW / (natH || 1);

          if (url.startsWith('data:image/')) {
            resolve({ dataUrl: url, format, aspectRatio });
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = natW;
          canvas.height = natH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ dataUrl: url, format, aspectRatio });
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.92);
          resolve({ dataUrl, format, aspectRatio });
        } catch {
          resolve({ dataUrl: url, format, aspectRatio: 1.5 });
        }
      };
      img.onerror = () => {
        if (url.startsWith('data:image/')) {
          resolve({ dataUrl: url, format, aspectRatio: 1.5 });
        } else {
          resolve(null);
        }
      };
      img.src = url;
    });

    // 2.5s safety timeout to prevent hanging on slow network or blocked CORS
    const timeoutPromise = new Promise<CleanImageData | null>((resolve) => {
      setTimeout(() => {
        if (url.startsWith('data:image/')) {
          resolve({ dataUrl: url, format, aspectRatio: 1.5 });
        } else {
          resolve(null);
        }
      }, 2500);
    });

    return await Promise.race([loadImagePromise, timeoutPromise]);
  } catch {
    return null;
  }
}

/**
 * Resolves the complete event entity from the database (local storage and cloud Firestore),
 * ensuring that the latest logoImage and coverImage are retrieved automatically
 * even if the caller passed a partial or unpopulated event object.
 */
export async function resolveEventFromDatabase(
  event?: Partial<Event>,
  eventId?: string
): Promise<Event> {
  const targetId = eventId || event?.id;
  let dbEvent: Event | undefined;

  // 1. Fetch from local storage (safe, zero circular dependency)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('ie_events');
      if (raw) {
        const events: Event[] = JSON.parse(raw);
        if (targetId) {
          dbEvent = events.find(e => e.id === targetId);
        }
        if (!dbEvent && event?.name) {
          dbEvent = events.find(e => e.name?.toLowerCase().trim() === event.name?.toLowerCase().trim());
        }
      }
    }
  } catch (err) {
    console.warn('Falha ao ler eventos do armazenamento local:', err);
  }

  // 2. If targetId exists and dbEvent is missing or missing either logoImage or coverImage, query Firestore directly
  if (targetId && (!dbEvent || !dbEvent.logoImage || !dbEvent.coverImage)) {
    try {
      const firestoreEvent = await getEventFromFirestore(targetId);
      if (firestoreEvent) {
        dbEvent = { ...dbEvent, ...firestoreEvent };
        // Sync local cache with new image assets
        if (typeof window !== 'undefined' && window.localStorage && (firestoreEvent.logoImage || firestoreEvent.coverImage)) {
          try {
            const raw = window.localStorage.getItem('ie_events');
            if (raw) {
              const events: Event[] = JSON.parse(raw);
              const idx = events.findIndex(e => e.id === targetId);
              if (idx >= 0) {
                events[idx] = { ...events[idx], ...firestoreEvent };
                window.localStorage.setItem('ie_events', JSON.stringify(events));
              }
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.warn('Falha ao buscar imagens do evento no Firestore para o PDF:', err);
    }
  }

  // Construct complete merged event ensuring images are retained
  const resolved: Event = {
    id: targetId || 'evt-default',
    companyId: event?.companyId || dbEvent?.companyId || 'comp-01',
    name: event?.name || dbEvent?.name || 'EVENTO',
    description: event?.description || dbEvent?.description || '',
    date: event?.date || dbEvent?.date || '',
    startTime: event?.startTime || dbEvent?.startTime || '',
    endTime: event?.endTime || dbEvent?.endTime || '',
    venue: event?.venue || dbEvent?.venue || '',
    address: event?.address || dbEvent?.address || '',
    city: event?.city || dbEvent?.city || '',
    state: event?.state || dbEvent?.state || '',
    organizerName: event?.organizerName || dbEvent?.organizerName || '',
    docNumber: event?.docNumber || dbEvent?.docNumber || '',
    phone: event?.phone || dbEvent?.phone || '',
    whatsapp: event?.whatsapp || dbEvent?.whatsapp || '',
    email: event?.email || dbEvent?.email || '',
    status: event?.status || dbEvent?.status || 'active',
    createdAt: event?.createdAt || dbEvent?.createdAt || new Date().toISOString(),
    slug: event?.slug || dbEvent?.slug || '',
    attractions: event?.attractions || dbEvent?.attractions || [],
    coverImage: event?.coverImage || dbEvent?.coverImage || '',
    logoImage: event?.logoImage || dbEvent?.logoImage || '',
    bannerImage: event?.bannerImage || dbEvent?.bannerImage || ''
  };

  return resolved;
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
      dark: '#000000', // Pure black modules for optical scanner accuracy
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  });
}

/**
 * Mathematical Layout Geometry for A4 Printing
 * Individual ticket: 90 mm x 50 mm (9 cm x 5 cm)
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
 * Automatically displays the Cover Artwork and Event Logo without compromising QR Code readability.
 */
export function renderTicket(
  doc: jsPDF,
  ticket: Ticket,
  event: Event,
  batch: TicketBatch | undefined,
  qrDataUrl: string,
  coverImage: CleanImageData | null,
  logoImage: CleanImageData | null,
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
  const headerH = 14.5;

  // Solid dark premium header background across full top width
  doc.setFillColor(9, 13, 22); // Deep Slate
  doc.rect(originX + 1.0, headerY, w - 2.0, headerH, 'F');

  let textStartX = originX + 3.2;

  // A. RENDER EVENT COVER ARTWORK (Capa do Evento)
  // Positioned on the left side of the header
  if (coverImage) {
    try {
      const boxW = 18.0;
      const boxH = 12.0;
      const boxX = originX + 2.4;
      const boxY = headerY + 1.25;

      const aspect = coverImage.aspectRatio || 1.5;
      let renderW = boxW;
      let renderH = boxH;

      if (aspect > boxW / boxH) {
        renderW = boxW;
        renderH = boxW / aspect;
      } else {
        renderH = boxH;
        renderW = boxH * aspect;
      }

      const renderX = boxX + (boxW - renderW) / 2;
      const renderY = boxY + (boxH - renderH) / 2;

      doc.addImage(coverImage.dataUrl, coverImage.format, renderX, renderY, renderW, renderH);

      // Fine dark border around cover box
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.2);
      doc.rect(boxX, boxY, boxW, boxH, 'S');

      textStartX = originX + 22.0;
    } catch {
      textStartX = originX + 3.2;
    }
  } else if (!coverImage && logoImage) {
    // If no cover is present, show the logo on the left as well
    try {
      const boxW = 18.0;
      const boxH = 12.0;
      const boxX = originX + 2.4;
      const boxY = headerY + 1.25;

      const aspect = logoImage.aspectRatio || 1.5;
      let renderW = boxW;
      let renderH = boxH;

      if (aspect > boxW / boxH) {
        renderW = boxW;
        renderH = boxW / aspect;
      } else {
        renderH = boxH;
        renderW = boxH * aspect;
      }

      const renderX = boxX + (boxW - renderW) / 2;
      const renderY = boxY + (boxH - renderH) / 2;

      doc.addImage(logoImage.dataUrl, logoImage.format, renderX, renderY, renderW, renderH);

      textStartX = originX + 22.0;
    } catch {
      textStartX = originX + 3.2;
    }
  }

  // B. RENDER EVENT LOGO IN STUB HEADER (Logomarca do Evento)
  // Positioned in the header above the access control stub (x = originX + 59 to originX + 89 mm)
  const stubHeaderCenterX = originX + 74.0;
  if (logoImage) {
    try {
      const maxLogoW = 24.0;
      const maxLogoH = 11.5;
      const aspect = logoImage.aspectRatio || 2.0;

      let renderW = maxLogoW;
      let renderH = maxLogoH;

      if (aspect > maxLogoW / maxLogoH) {
        renderW = maxLogoW;
        renderH = maxLogoW / aspect;
      } else {
        renderH = maxLogoH;
        renderW = maxLogoH * aspect;
      }

      const renderX = stubHeaderCenterX - renderW / 2;
      const renderY = headerY + (headerH - renderH) / 2;

      // Clean contrast container backdrop
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(renderX - 0.4, renderY - 0.4, renderW + 0.8, renderH + 0.8, 0.5, 0.5, 'F');

      doc.addImage(logoImage.dataUrl, logoImage.format, renderX, renderY, renderW, renderH);
    } catch (e) {
      console.warn('Erro ao renderizar logo no cabeçalho do canhoto:', e);
    }
  } else {
    // Official typography badge when no logo is uploaded
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.text('INGRESSO', stubHeaderCenterX, headerY + 5.8, { align: 'center' });

    doc.setFontSize(5.0);
    doc.setTextColor(56, 189, 248); // Sky blue
    doc.text('AUTENTICADO', stubHeaderCenterX, headerY + 10.2, { align: 'center' });
  }

  // C. EVENT METADATA (Left Header Body)
  const headerRightMargin = originX + 58.0;

  // Event Name (Bold white)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);

  const availableTitleChars = Math.max(16, Math.floor((headerRightMargin - textStartX) * 1.55));
  const rawEventName = (event.name || ticket.eventName || 'EVENTO').toUpperCase();
  const truncatedEventName = rawEventName.length > availableTitleChars
    ? rawEventName.slice(0, availableTitleChars - 2) + '...'
    : rawEventName;
  doc.text(truncatedEventName, textStartX, headerY + 4.5);

  // Date and Time (Sky Blue / High contrast)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(56, 189, 248); // sky-400
  const formattedDate = event.date ? event.date.split('-').reverse().join('/') : '';
  const dateStr = formattedDate ? `DATA: ${formattedDate}` : 'DATA A DEFINIR';
  const timeStr = event.startTime ? `ÀS ${event.startTime}` : '';
  doc.text(`${dateStr} ${timeStr}`.trim(), textStartX, headerY + 8.5);

  // Venue & City (Soft light slate)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.0);
  doc.setTextColor(203, 213, 225); // slate-300
  const venueStr = (event.venue || event.address || 'Portaria Principal').toUpperCase();
  const cityStr = event.city ? `• ${event.city.toUpperCase()}` : '';
  const fullVenue = `${venueStr} ${cityStr}`.trim();
  const availableVenueChars = Math.max(18, Math.floor((headerRightMargin - textStartX) * 1.95));
  const truncatedVenue = fullVenue.length > availableVenueChars
    ? fullVenue.slice(0, availableVenueChars - 2) + '...'
    : fullVenue;
  doc.text(truncatedVenue, textStartX, headerY + 12.2);

  // --- 3. PERFORATION DIVIDER & NOTCHES (x = originX + 59 mm) ---
  const stubDividerX = originX + 59.0;

  // Semicircular notches at top and bottom of perforation line
  doc.setFillColor(255, 255, 255);
  doc.circle(stubDividerX, headerY + headerH, 1.2, 'F');
  doc.circle(stubDividerX, originY + 48.8, 1.2, 'F');

  // Perforated dashed line
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
  // A dedicated pure white container guarantees 100% optical reading of the QR Code
  doc.setFillColor(255, 255, 255);
  doc.rect(originX + 59.2, originY + 15.5, 29.8, 33.5, 'F');

  // Stub Sub-header
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.6);
  doc.text('CONTROLE DE ACESSO', originX + 74.0, originY + 18.2, { align: 'center' });

  // High Resolution QR Code Image (22.5 mm x 22.5 mm, centered with generous white quiet zones)
  const qrX = originX + 62.75;
  const qrY = originY + 19.5;
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
  doc.text(codeText, originX + 74.0, originY + 44.5, { align: 'center' });

  // Security Hash verification string (Last 8 chars)
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.3);
  const tokenClean = ticket.validationToken || '';
  const tokenHash = tokenClean.length > 8 ? tokenClean.slice(-8).toUpperCase() : tokenClean.toUpperCase() || 'VALID';
  doc.text(`HASH: #${tokenHash}`, originX + 74.0, originY + 47.8, { align: 'center' });
}

/**
 * Creates and compiles a jsPDF document containing the given tickets formatted for
 * OPTIMIZED A4 PRINTING (12 tickets per sheet, 90mm x 50mm each, landscape orientation).
 * Automatically resolves cover and logo from the database if not present in the passed event.
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

  // Ensure full event with database images is retrieved
  const fullEvent = await resolveEventFromDatabase(event, tickets[0]?.eventId);

  const layout = calculateA4Layout();

  // Create A4 document in Landscape orientation
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Pre-load event cover and logo images once for ultra-fast rendering
  const [coverImage, logoImage] = await Promise.all([
    getCleanImageDataUrl(fullEvent.coverImage || batch?.artworkUrl),
    getCleanImageDataUrl(fullEvent.logoImage)
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
    const printInfo = `${(fullEvent.name || 'EVENTO').toUpperCase()} • LOTE: ${(batch?.name || tickets[0]?.batchName || 'GERAL').toUpperCase()} • PÁGINA ${pageIndex + 1} DE ${totalPages} • FORMATO 90x50 MM (12 INGRESSOS/FOLHA A4)`;
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
        fullEvent,
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
 * Automatically resolves cover and logo from the database if not present in the passed event.
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

  // Ensure full event with database images is retrieved
  const fullEvent = await resolveEventFromDatabase(event, tickets[0]?.eventId);

  // Exact required physical dimensions: 90 mm x 50 mm (9cm x 5cm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [90, 50]
  });

  // Pre-load event cover and logo images once for ultra-fast rendering
  const [coverImage, logoImage] = await Promise.all([
    getCleanImageDataUrl(fullEvent.coverImage || batch?.artworkUrl),
    getCleanImageDataUrl(fullEvent.logoImage)
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

    renderTicket(doc, ticket, fullEvent, batch, qrDataUrl, coverImage, logoImage, 0, 0, false);
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
  const fullEvent = await resolveEventFromDatabase(event, tickets[0]?.eventId);
  const doc = await generateA4TicketsPDFDocument(tickets, fullEvent, batch, onProgress);

  const cleanEventName = (fullEvent.name || 'evento').replace(/[^a-zA-Z0-9]/g, '_');
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
  const fullEvent = await resolveEventFromDatabase(event, tickets[0]?.eventId);
  const doc = await generateTicketsPDFDocument(tickets, fullEvent, batch, onProgress);

  const cleanEventName = (fullEvent.name || 'evento').replace(/[^a-zA-Z0-9]/g, '_');
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
  const fullEvent = await resolveEventFromDatabase(event, ticket.eventId);
  const doc = await generateTicketsPDFDocument([ticket], fullEvent, batch);

  const cleanEventName = (fullEvent.name || 'evento').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanCode = (ticket.ticketNumber || ticket.id).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Ingresso_9x5cm_${cleanEventName}_${cleanCode}.pdf`;

  doc.save(filename);
}
