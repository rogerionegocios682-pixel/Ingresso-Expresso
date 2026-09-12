import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  Send,
  PlusCircle,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Event, Ticket } from '../types';
import { formatCurrency, formatDate, generateWhatsAppMessage, openWhatsAppChat } from '../services/whatsapp';

interface TicketDisplayModalProps {
  tickets: Ticket[];
  event: Event;
  onClose: () => void;
  onNewSale: () => void;
  onPrintSuccess?: (info: { ticketLabel: string; count: number; timestamp: string; eventName: string }) => void;
}

interface PrintNotification {
  show: boolean;
  ticketLabel: string;
  timestamp: string;
  count: number;
}

export const TicketDisplayModal: React.FC<TicketDisplayModalProps> = ({
  tickets,
  event,
  onClose,
  onNewSale,
  onPrintSuccess
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [printNotification, setPrintNotification] = useState<PrintNotification | null>(null);
  const [hasPrinted, setHasPrinted] = useState<boolean>(false);
  const [printAll, setPrintAll] = useState<boolean>(false);
  const [showPrintConfirmDialog, setShowPrintConfirmDialog] = useState<boolean>(false);

  const currentTicket = tickets[currentIndex] || tickets[0];
  const printRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate QR codes for all tickets in the sale batch
  useEffect(() => {
    if (!tickets || tickets.length === 0) return;
    tickets.forEach(ticket => {
      if (!qrMap[ticket.id]) {
        QRCode.toDataURL(ticket.validationToken, {
          width: 240,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'H'
        })
          .then(url => {
            setQrMap(prev => ({ ...prev, [ticket.id]: url }));
          })
          .catch(err => console.error('Erro ao gerar QR Code:', err));
      }
    });
  }, [tickets]);

  // Clean up auto-dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handlePrint = (all: boolean = false) => {
    setPrintAll(all);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const label = all ? `Todos (${tickets.length} ingressos)` : currentTicket.ticketNumber;

    // Show visual confirmation toast immediately
    setPrintNotification({
      show: true,
      ticketLabel: label,
      timestamp: timeStr,
      count: all ? tickets.length : 1
    });
    setHasPrinted(true);
    setShowPrintConfirmDialog(false);

    // Notify POSView operator interface
    onPrintSuccess?.({
      ticketLabel: label,
      count: all ? tickets.length : 1,
      timestamp: timeStr,
      eventName: event.name
    });

    // Auto-dismiss toast after 7 seconds
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setPrintNotification(prev => (prev ? { ...prev, show: false } : null));
    }, 7000);

    // Send print command to browser print service
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Erro ao acionar serviço de impressão:', err);
      }
    }, 80);
  };

  const handleSendWhatsApp = () => {
    if (!currentTicket) return;
    const msg = generateWhatsAppMessage(currentTicket, event);
    openWhatsAppChat(currentTicket.customerPhone, msg);
  };

  if (!currentTicket) return null;

  const currentQr = qrMap[currentTicket.id] || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      {/* Interactive Modal View (Hidden during print) */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 no-print my-auto">
        
        {/* Floating Success Toast Notification for Print Service */}
        <AnimatePresence>
          {printNotification && printNotification.show && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="absolute top-3 left-3 right-3 z-50 bg-slate-900/95 text-white rounded-xl p-3.5 shadow-2xl border border-emerald-500/40 backdrop-blur-md flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Printer className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 uppercase tracking-wide">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Comando de Impressão Enviado
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {printNotification.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-medium">
                    Enviado com sucesso ao serviço de impressão do navegador para{' '}
                    <strong className="text-white font-semibold">{printNotification.ticketLabel}</strong>.
                  </p>
                  <p className="text-[11px] text-emerald-300/80">
                    Verifique a fila de impressão da sua impressora térmica ou padrão.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handlePrint(false)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Enviar novamente para a impressora"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span className="hidden sm:inline">Reimprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintNotification(prev => (prev ? { ...prev, show: false } : null))}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmation Dialog Modal (Optional Preview Dialog) */}
        <AnimatePresence>
          {showPrintConfirmDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 text-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Confirmar Impressão</h3>
                    <p className="text-xs text-slate-500">Selecione o modo de impressão do PDV</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p>
                    <strong>Evento:</strong> {event.name}
                  </p>
                  <p>
                    <strong>Ingresso Atual:</strong> {currentTicket.ticketTypeName} ({currentTicket.ticketNumber})
                  </p>
                  <p>
                    <strong>Total no Pedido:</strong> {tickets.length} ingresso(s)
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePrint(false)}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir Apenas Este ({currentTicket.ticketNumber})</span>
                  </button>

                  {tickets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handlePrint(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                    >
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Imprimir Todos ({tickets.length} Ingressos)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPrintConfirmDialog(false)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-200">Venda Concluída</span>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>🎟️</span> INGRESSO GERADO
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multiple tickets pager if sale was quantity > 1 */}
        {tickets.length > 1 && (
          <div className="bg-slate-100 px-5 py-2.5 flex items-center justify-between border-b border-slate-200 text-sm">
            <span className="text-slate-600 font-medium">
              Ingresso <strong className="text-slate-900">{currentIndex + 1}</strong> de <strong className="text-slate-900">{tickets.length}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="p-1 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition-all text-slate-700 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentIndex === tickets.length - 1}
                onClick={() => setCurrentIndex(prev => Math.min(tickets.length - 1, prev + 1))}
                className="p-1 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition-all text-slate-700 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Ticket Details & QR Code */}
        <div className="p-6 space-y-4">
          {/* Card Details */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2.5 text-sm">
            <div className="flex justify-between items-start pb-2 border-b border-slate-200">
              <div>
                <span className="text-xs text-slate-500 font-medium">Evento:</span>
                <p className="font-bold text-slate-900 text-base leading-snug">{event.name}</p>
                <p className="text-xs text-slate-600">{formatDate(event.date)} às {event.startTime}h • {event.venue}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-xs text-slate-500 font-medium">Cliente:</span>
                <p className="font-semibold text-slate-800">{currentTicket.customerName}</p>
                <p className="text-xs text-slate-500">{currentTicket.customerPhone}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Ingresso:</span>
                <p className="font-semibold text-indigo-700">{currentTicket.ticketTypeName}</p>
                <p className="text-xs text-slate-500">{currentTicket.batchName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <span className="text-xs text-slate-500 font-medium">Nº do Ingresso:</span>
                <p className="font-mono font-bold text-slate-900 tracking-wider text-sm">{currentTicket.ticketNumber}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Valor:</span>
                <p className="font-bold text-emerald-700 text-base">{formatCurrency(currentTicket.price)}</p>
              </div>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-dashed border-slate-300 rounded-xl">
            {currentQr ? (
              <img
                src={currentQr}
                alt="QR Code do Ingresso"
                className="w-40 h-40 rounded-lg shadow-xs"
              />
            ) : (
              <div className="w-40 h-40 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-xs text-slate-400">
                Gerando QR Code...
              </div>
            )}
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Token: {currentTicket.validationToken}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Validação criptografada única contra fraudes</p>
          </div>

          {/* Inline Visual Print Confirmation Banner */}
          {hasPrinted && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-950">
                  Comando de impressão enviado com sucesso
                </p>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  O sinal foi transmitido ao spooler do navegador para{' '}
                  <strong>{currentTicket.ticketNumber}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePrint(false)}
                className="text-emerald-700 hover:text-emerald-950 text-[11px] font-bold underline shrink-0 cursor-pointer"
              >
                Reimprimir
              </button>
            </div>
          )}

          {/* Actions matching requirement #26: IMPRIMIR INGRESSO, ENVIAR PELO WHATSAPP, NOVA VENDA */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => handlePrint(false)}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold shadow-xs transition-all cursor-pointer ${
                  hasPrinted
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                {hasPrinted ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>ENVIADO (REIMPRIMIR)</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>IMPRIMIR INGRESSO</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSendWhatsApp}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>ENVIAR PELO WHATSAPP</span>
              </button>
            </div>

            {/* Quick action to print all tickets if bundle > 1 */}
            {tickets.length > 1 && (
              <button
                type="button"
                onClick={() => handlePrint(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>IMPRIMIR TODOS OS {tickets.length} INGRESSOS DESTA VENDA</span>
              </button>
            )}

            <button
              onClick={onNewSale}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>NOVA VENDA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Voucher Format (Shown only during print) */}
      <div id="printable-ticket" ref={printRef} className="hidden print:block text-black font-sans bg-white">
        {(printAll ? tickets : [currentTicket]).map((tkt, idx) => (
          <div
            key={tkt.id}
            className="p-6 max-w-sm mx-auto border border-dashed border-black mb-6"
            style={{ pageBreakAfter: idx < (printAll ? tickets.length - 1 : 0) ? 'always' : 'auto' }}
          >
            <div className="text-center pb-3 border-b-2 border-black">
              <h1 className="text-xl font-black uppercase tracking-tight">INGRESSOS EVENTOS</h1>
              <p className="text-xs font-semibold">{event.organizerName}</p>
            </div>

            <div className="py-3 text-center border-b border-black">
              <h2 className="text-lg font-bold uppercase">{event.name}</h2>
              <p className="text-sm font-semibold">{formatDate(event.date)} às {event.startTime}h</p>
              <p className="text-xs">{event.venue} - {event.address}</p>
              <p className="text-xs">{event.city} / {event.state}</p>
            </div>

            <div className="py-3 space-y-1.5 border-b border-black text-xs">
              <div className="flex justify-between">
                <span className="font-bold">INGRESSO:</span>
                <span className="font-bold uppercase">{tkt.ticketTypeName}</span>
              </div>
              <div className="flex justify-between">
                <span>LOTE:</span>
                <span>{tkt.batchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">NÚMERO:</span>
                <span className="font-mono font-bold">{tkt.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-semibold uppercase">{tkt.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>VALOR:</span>
                <span className="font-bold">{formatCurrency(tkt.price)}</span>
              </div>
              <div className="flex justify-between">
                <span>PAGAMENTO:</span>
                <span className="uppercase">{tkt.paymentMethod}</span>
              </div>
            </div>

            <div className="py-4 flex flex-col items-center justify-center text-center">
              {(qrMap[tkt.id] || currentQr) && (
                <img
                  src={qrMap[tkt.id] || currentQr}
                  alt="QR Code"
                  className="w-40 h-40 mx-auto"
                />
              )}
              <p className="font-mono text-[10px] mt-2 tracking-widest">{tkt.validationToken}</p>
            </div>

            <div className="pt-2 border-t border-black text-[10px] text-center space-y-1">
              <p className="font-bold">ORIENTAÇÕES BÁSICAS:</p>
              <p>• Obrigatório apresentar este ingresso e documento oficial com foto.</p>
              <p>• Este QR Code é único e intransferível. Entrada permitida apenas 1 vez.</p>
              <p>• A validação é realizada digitalmente em tempo real na portaria.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
