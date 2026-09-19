import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket as TicketIcon,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Share2,
  Copy,
  Check,
  Download,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  QrCode,
  Music,
  CreditCard,
  Building2,
  Lock,
  MessageCircle,
  HelpCircle,
  ShoppingBag
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Event, TicketBatch, Ticket, Sale, PaymentMethod, User } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../services/whatsapp';

interface PublicEventPageViewProps {
  slugOrId: string;
  currentUser?: User | null;
  onBackToAdmin?: () => void;
}

export const PublicEventPageView: React.FC<PublicEventPageViewProps> = ({
  slugOrId,
  currentUser,
  onBackToAdmin
}) => {
  const [data, setData] = useState(() => StorageService.getPublicEventData(slugOrId));
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerDoc, setCustomerDoc] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Completed purchase state
  const [purchaseResult, setPurchaseResult] = useState<{
    sale: Sale;
    tickets: Ticket[];
  } | null>(null);

  // Keep synced with store updates (e.g., if batch stock changes or new batch added)
  useEffect(() => {
    const unsubscribe = StorageService.subscribe(() => {
      const refreshed = StorageService.getPublicEventData(slugOrId);
      setData(refreshed);
    });
    return () => unsubscribe();
  }, [slugOrId]);

  // Select initial active batch
  useEffect(() => {
    if (data?.batches && data.batches.length > 0) {
      const firstAvailable = data.batches.find(
        b => b.status === 'active' && b.totalQuantity - b.soldQuantity > 0
      );
      if (firstAvailable) {
        setSelectedBatchId(firstAvailable.id);
      } else {
        setSelectedBatchId(data.batches[0].id);
      }
    }
  }, [data?.batches]);

  const event = data?.event;
  const company = data?.company;
  const batches = data?.batches || [];

  const selectedBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatchId);
  }, [batches, selectedBatchId]);

  const availableStock = selectedBatch
    ? Math.max(0, selectedBatch.totalQuantity - selectedBatch.soldQuantity)
    : 0;

  const isSoldOut = selectedBatch ? availableStock <= 0 : false;
  const totalAmount = selectedBatch ? selectedBatch.price * quantity : 0;

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    if (!event) return;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Ingressos disponíveis para *${event.name}*!\n\nData: ${formatDate(event.date)} às ${event.startTime}h\nLocal: ${event.venue} (${event.city}-${event.state})\n\nGaranta seu ingresso no link oficial:\n${url}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleDownloadSinglePDF = (ticketId: string) => {
    StorageService.exportTicketPDF(ticketId);
  };

  const handleDownloadAllPDF = () => {
    if (!purchaseResult) return;
    const ticketIds = purchaseResult.tickets.map(t => t.id);
    StorageService.exportTicketsPDF(ticketIds);
  };

  const handleSendTicketsWhatsApp = () => {
    if (!purchaseResult || !event) return;
    const phone = customerPhone.replace(/[^0-9]/g, '');
    const ticketCodes = purchaseResult.tickets.map(t => `• Ingresso: ${t.ticketNumber} (${t.ticketTypeName})`).join('\n');
    const msg = `Olá *${customerName}*, sua compra para *${event.name}* foi confirmada!\n\n${ticketCodes}\n\nData: ${formatDate(event.date)} às ${event.startTime}h\nLocal: ${event.venue}\n\nApresente seus ingressos com QR Code na portaria. Bom evento!`;
    const waUrl = `https://api.whatsapp.com/send?phone=${phone.startsWith('55') ? phone : `55${phone}`}&text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handleBuyTickets = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!event) return;

    if (event.status !== 'active') {
      if (event.status === 'draft') {
        setErrorMessage('As vendas para este evento ainda não foram iniciadas pela organização.');
      } else if (event.status === 'finished') {
        setErrorMessage('Este evento já foi encerrado.');
      } else if (event.status === 'cancelled') {
        setErrorMessage('Este evento foi cancelado.');
      }
      return;
    }

    if (!selectedBatchId || !selectedBatch) {
      setErrorMessage('Por favor, selecione uma categoria de ingresso.');
      return;
    }

    if (availableStock < quantity) {
      setErrorMessage(`Estoque insuficiente! Restam apenas ${availableStock} ingresso(s) nesta categoria.`);
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Informe seu nome completo para emissão do ingresso nominal.');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMessage('Informe seu WhatsApp para entrega e confirmação dos ingressos.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = StorageService.createPublicSale({
        eventId: event.id,
        batchId: selectedBatchId,
        quantity,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerDoc: customerDoc.trim() || undefined,
        paymentMethod
      });

      setPurchaseResult(result);
      setIsSubmitting(false);

      // Trigger celebratory confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {
        // Ignore animation fallback
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Erro ao processar sua compra. Tente novamente.');
    }
  };

  // Event not found view
  if (!event) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-white">Evento não encontrado</h1>
          <p className="text-sm text-slate-400">
            O link informado não corresponde a nenhum evento ativo ou pode ter sido descontinuado.
          </p>
          {currentUser && onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Voltar ao Painel Administrativo
            </button>
          )}
        </div>
      </div>
    );
  }

  // If purchase completed, show ticket confirmation view
  if (purchaseResult) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6">
        {/* Organizer top bar if logged in */}
        {currentUser && onBackToAdmin && (
          <div className="max-w-3xl mx-auto mb-6 bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs text-slate-300">
            <span>👁️ Modo de visualização pública (Organizador logado)</span>
            <button
              onClick={onBackToAdmin}
              className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Painel
            </button>
          </div>
        )}

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Success Banner */}
          <div className="bg-gradient-to-b from-emerald-950/80 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-3 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Compra Confirmada com Sucesso!
            </h1>
            <p className="text-sm text-emerald-300 font-medium">
              Pedido <span className="font-mono font-bold text-white">{purchaseResult.sale.saleNumber}</span>
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Parabéns, <strong>{customerName}</strong>! Seus ingressos oficiais com QR Code individual foram gerados e estão prontos para uso.
            </p>

            {/* Quick Action Buttons */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleDownloadAllPDF}
                className="flex items-center gap-2 py-3 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Baixar Ingressos em PDF (9×5 cm)
              </button>

              <button
                onClick={handleSendTicketsWhatsApp}
                className="flex items-center gap-2 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                Receber no WhatsApp
              </button>
            </div>
          </div>

          {/* Individual Tickets Cards */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <TicketIcon className="w-5 h-5 text-indigo-400" />
              Seus Ingressos Emitidos ({purchaseResult.tickets.length})
            </h2>

            {purchaseResult.tickets.map((t, idx) => (
              <div
                key={t.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-5 transition-all"
              >
                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs">
                      {t.ticketTypeName} • {t.batchName}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                      Válido para 1 Entrada
                    </span>
                  </div>

                  <h3 className="text-base font-black text-white">{event.name}</h3>
                  <p className="text-xs text-slate-400">
                    Titular: <strong className="text-slate-200">{t.customerName}</strong>
                  </p>
                  <p className="text-xs font-mono text-indigo-400 font-bold">
                    Código: {t.ticketNumber}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatDate(event.date)} às {event.startTime}h • {event.venue}
                  </p>
                </div>

                {/* QR Code & PDF Action */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="bg-white p-2.5 rounded-xl shadow-md">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
                        t.validationToken
                      )}`}
                      alt={`QR Code ${t.ticketNumber}`}
                      className="w-24 h-24 object-contain"
                    />
                  </div>
                  <button
                    onClick={() => handleDownloadSinglePDF(t.id)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar PDF (9x5 cm)
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Event Instructions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs text-slate-400">
            <h4 className="font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Orientações para o Acesso ao Evento
            </h4>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Apresente este QR Code direto na tela do seu celular ou impresso na portaria.</li>
              <li>Cada QR Code é único e antifraude; após a validação na catraca, ele será invalidado automaticamente.</li>
              <li>Chegue com antecedência para evitar filas no horário de pico.</li>
              <li>Dúvidas ou suporte? Entre em contato com a organização pelo WhatsApp {company?.whatsapp || event.whatsapp}.</li>
            </ul>
          </div>

          {/* Buy more button */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                setPurchaseResult(null);
                setQuantity(1);
              }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Comprar mais ingressos para este evento
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Commercial Public Event Page
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Organizer preview top bar if logged in */}
      {currentUser && onBackToAdmin && (
        <div className="sticky top-0 z-50 bg-indigo-950/95 border-b border-indigo-800/80 backdrop-blur-md px-4 py-2.5 text-xs text-indigo-200 flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Pré-visualização do Organizador • Esta é a página pública que seus clientes acessam
          </span>
          <button
            onClick={onBackToAdmin}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-800 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Painel Admin
          </button>
        </div>
      )}

      {/* Hero Header with Official Event Artwork */}
      <header className="relative w-full overflow-hidden bg-slate-900">
        {/* Background Artwork Banner with Blur Accent */}
        <div className="absolute inset-0 z-0">
          <img
            src={event.coverImage}
            alt={event.name}
            className="w-full h-full object-cover opacity-30 filter blur-xs scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>
        </div>

        {/* Content Box */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pt-14 sm:pb-16 flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8">
          {/* Event Official Artwork Poster */}
          <div className="w-48 sm:w-56 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 shrink-0 bg-slate-800 relative group">
            <img
              src={event.coverImage}
              alt={event.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {event.status !== 'active' && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 text-center">
                <span className="px-3 py-1 rounded-lg bg-rose-600 text-white font-black text-xs uppercase tracking-wider">
                  {event.status === 'draft' ? 'Em Breve' : event.status === 'finished' ? 'Encerrado' : 'Cancelado'}
                </span>
              </div>
            )}
          </div>

          {/* Event Metadata */}
          <div className="space-y-3.5 text-center md:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  event.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {event.status === 'active'
                  ? 'Vendas Abertas'
                  : event.status === 'draft'
                  ? 'Em Planejamento'
                  : event.status === 'finished'
                  ? 'Evento Encerrado'
                  : 'Cancelado'}
              </span>

              <span className="px-3 py-1 rounded-full bg-white/10 text-slate-300 text-xs font-medium">
                Organizado por: <strong>{event.organizerName || company?.name}</strong>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {event.name}
            </h1>

            {/* Date, Time and Venue Highlights */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-y-2 gap-x-4 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{formatDate(event.date)}</span>
              </div>

              <span className="text-slate-600 hidden sm:inline">•</span>

              <div className="flex items-center gap-1.5 font-semibold text-indigo-400">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{event.startTime}h às {event.endTime}h</span>
              </div>

              <span className="text-slate-600 hidden sm:inline">•</span>

              <div className="flex items-center gap-1.5 text-slate-300">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{event.venue} • {event.city} - {event.state}</span>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="pt-2 flex items-center justify-center md:justify-start gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" /> Compartilhar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Event Information, Attractions and Venue (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Status Alert if not active */}
          {event.status !== 'active' && (
            <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-amber-300 text-sm">
                  {event.status === 'draft'
                    ? 'Vendas não iniciadas'
                    : event.status === 'finished'
                    ? 'Evento encerrado'
                    : 'Evento cancelado'}
                </p>
                <p className="text-amber-200/80 leading-relaxed">
                  {event.status === 'draft'
                    ? 'Este evento ainda está em fase de preparação pela organização. Em breve as vendas oficiais serão liberadas neste link.'
                    : event.status === 'finished'
                    ? 'Este evento já foi realizado. Não é mais possível adquirir ingressos.'
                    : 'Este evento foi cancelado pelos organizadores.'}
                </p>
              </div>
            </div>
          )}

          {/* Description Block */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-sm">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Sobre o Evento
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {event.description || 'Nenhuma descrição informada pelo organizador.'}
            </p>
          </div>

          {/* Attractions (if registered) */}
          {event.attractions && event.attractions.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-sm">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Music className="w-5 h-5 text-indigo-400" />
                Atrações Confirmadas
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {event.attractions.map((attraction, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700/80 text-white font-bold text-xs flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    {attraction}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Venue & Location Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-sm">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              Local do Evento
            </h2>

            <div className="space-y-1.5 text-xs sm:text-sm text-slate-300">
              <p className="font-bold text-white text-base">{event.venue}</p>
              <p className="text-slate-400">{event.address}</p>
              <p className="text-slate-400">{event.city} - {event.state}</p>
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${event.venue}, ${event.address}, ${event.city} - ${event.state}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors pt-1"
            >
              Abrir rota no Google Maps <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Organizer Guarantee & Anti-fraud Info */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 text-xs text-slate-400">
            <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-slate-200">Compra 100% Segura e Ingressos Oficiais</p>
              <p className="text-slate-400">
                Seus ingressos possuem QR Code criptográfico individual e validação em tempo real na portaria da arena.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Ticket Batches & Checkout Form (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <TicketIcon className="w-5 h-5 text-emerald-400" />
                Ingressos & Lotes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Selecione sua categoria de ingresso para este evento
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Batches Selector */}
            <div className="space-y-3">
              {batches.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-2xl">
                  Nenhum lote disponível cadastrado no momento.
                </div>
              ) : (
                batches.map(batch => {
                  const stock = batch.totalQuantity - batch.soldQuantity;
                  const soldOut = stock <= 0 || batch.status === 'exhausted';
                  const isSelected = selectedBatchId === batch.id;

                  return (
                    <div
                      key={batch.id}
                      onClick={() => {
                        if (!soldOut && event.status === 'active') {
                          setSelectedBatchId(batch.id);
                        }
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        soldOut
                          ? 'bg-slate-950/60 border-slate-800/80 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {batch.ticketTypeName}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded-md bg-slate-800">
                            {batch.name}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400">
                          {soldOut ? (
                            <span className="text-rose-400 font-bold">Esgotado</span>
                          ) : (
                            <span>{stock} restantes disponíveis</span>
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-black text-base text-emerald-400">
                          {batch.price === 0 ? 'Grátis' : formatCurrency(batch.price)}
                        </p>
                        {isSelected && !soldOut && (
                          <span className="text-[10px] font-bold text-indigo-400 uppercase">
                            Selecionado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Purchase Form */}
            {event.status === 'active' && batches.length > 0 && (
              <form onSubmit={handleBuyTickets} className="space-y-4 pt-2 border-t border-slate-800">
                {/* Quantity */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Quantidade de Ingressos
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuantity(q)}
                        disabled={isSoldOut || (selectedBatch && availableStock < q)}
                        className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          quantity === q
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        {q}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nome Completo do Titular *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    WhatsApp para Recebimento *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: (11) 98765-4321"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* CPF & Email (Optional for agility) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      CPF / Documento
                    </label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={customerDoc}
                      onChange={e => setCustomerDoc(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      E-mail (opcional)
                    </label>
                    <input
                      type="email"
                      placeholder="nome@email.com"
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pix')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethod === 'pix'
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> PIX Imediato
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('credito')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethod === 'credito'
                          ? 'bg-indigo-950/40 border-indigo-500 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Cartão / Portaria
                    </button>
                  </div>

                  {paymentMethod === 'pix' && company?.pixKey && (
                    <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300">
                      Chave PIX da Organização: <strong className="font-mono text-white">{company.pixKey}</strong> ({company.pixRecipientName || company.name})
                    </div>
                  )}
                </div>

                {/* Total Summary */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Total a pagar:</span>
                    <p className="text-xs text-slate-500">
                      {quantity}x {selectedBatch?.ticketTypeName || 'Ingresso'}
                    </p>
                  </div>
                  <span className="text-2xl font-black text-emerald-400">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>

                {/* Submit Buy Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isSoldOut}
                  className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  {isSubmitting
                    ? 'Emitindo Ingressos...'
                    : isSoldOut
                    ? 'Lote Esgotado'
                    : 'Garantir Ingressos Agora'}
                </button>

                <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" /> Transação com emissão imediata e QR Code único antifraude
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-900 py-8 px-4 text-center text-xs text-slate-500 space-y-2">
        <p className="text-slate-400 font-semibold">
          {event.name} • Organizado por {event.organizerName || company?.name}
        </p>
        <p className="text-[11px]">
          Plataforma de Ingressos & Validação em Portaria • Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
};
