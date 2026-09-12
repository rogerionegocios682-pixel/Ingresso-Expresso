import { Event, Ticket } from '../types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function generateWhatsAppMessage(ticket: Ticket, event: Event): string {
  const formattedDate = formatDate(event.date);
  const formattedPrice = formatCurrency(ticket.price);

  const message = `🎟️ *SEU INGRESSO DIGITAL ESTÁ CONFIRMADO!*

Olá, *${ticket.customerName}*! Seu ingresso para o evento foi gerado com sucesso:

📍 *Evento:* ${event.name}
📅 *Data:* ${formattedDate} às ${event.startTime}h
🏛️ *Local:* ${event.venue} (${event.city}-${event.state})
🎫 *Ingresso:* ${ticket.ticketTypeName} (${ticket.batchName})
🔢 *Nº do Ingresso:* ${ticket.ticketNumber}
💰 *Valor Pago:* ${formattedPrice}
🔐 *Código de Validação:* ${ticket.validationToken}

⚠️ *Instruções para Entrada:*
- Apresente este código ou o QR Code diretamente na portaria pelo celular.
- Tenha em mãos um documento com foto.
- Cada ingresso possui validação única antifraude e permite apenas 1 entrada.

Esperamos você! Tenha um excelente evento! 🎉`;

  return message;
}

export function openWhatsAppChat(phone: string, message: string): void {
  // Clean phone numbers to pure digits
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  // If no country code, prepend 55 (Brazil)
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = `55${cleanPhone}`;
  }

  const encoded = encodeURIComponent(message);
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
