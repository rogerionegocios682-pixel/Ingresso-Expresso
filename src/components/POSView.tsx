import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Calendar,
  Ticket as TicketIcon,
  User as UserIcon,
  Phone,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle,
  AlertCircle,
  Plus,
  Minus,
  ArrowRight,
  Sparkles,
  Gift
} from 'lucide-react';
import { Event, TicketBatch, PaymentMethod, User, Ticket } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../services/whatsapp';
import { TicketDisplayModal } from './TicketDisplayModal';
import { PrintToast, PrintToastData } from './PrintToast';

interface POSViewProps {
  currentUser: User;
  onNavigateToTickets?: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ currentUser }) => {
  const companyId = StorageService.getCurrentCompanyId();
  const allEvents = StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId);

  // Filter events authorized for seller if applicable
  const authorizedEvents = useMemo(() => {
    return allEvents.filter(evt => {
      if (evt.status !== 'active') return false;
      if (currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') return true;
      if (!currentUser.authorizedEventIds || currentUser.authorizedEventIds.includes('*')) return true;
      return currentUser.authorizedEventIds.includes(evt.id);
    });
  }, [allEvents, currentUser]);

  const [selectedEventId, setSelectedEventId] = useState<string>(authorizedEvents[0]?.id || '');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerDoc, setCustomerDoc] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Generated tickets state for modal display
  const [generatedTickets, setGeneratedTickets] = useState<Ticket[] | null>(null);

  // Custom toast notification state for printing confirmation
  const [printToast, setPrintToast] = useState<PrintToastData | null>(null);
  const [lastPrintJob, setLastPrintJob] = useState<PrintToastData | null>(null);

  const handlePrintSuccess = (info: {
    ticketLabel: string;
    count: number;
    timestamp: string;
    eventName: string;
  }) => {
    const data: PrintToastData = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ticketLabel: info.ticketLabel,
      eventName: info.eventName,
      count: info.count,
      timestamp: info.timestamp
    };
    setPrintToast(data);
    setLastPrintJob(data);
  };

  const handleReprintFromToast = () => {
    try {
      window.print();
    } catch (err) {
      console.error('Erro ao acionar reimpressão:', err);
    }
  };

  const currentEvent = useMemo(() => {
    return allEvents.find(e => e.id === selectedEventId);
  }, [allEvents, selectedEventId]);

  const batchesForEvent = useMemo(() => {
    if (!selectedEventId) return [];
    return StorageService.getBatches(undefined, selectedEventId);
  }, [selectedEventId]);

  const selectedBatch = useMemo(() => {
    return batchesForEvent.find(b => b.id === selectedBatchId);
  }, [batchesForEvent, selectedBatchId]);

  const availableStock = selectedBatch ? selectedBatch.totalQuantity - selectedBatch.soldQuantity : 0;
  const isSoldOut = selectedBatch ? availableStock <= 0 : false;
  const totalAmount = selectedBatch ? selectedBatch.price * quantity : 0;

  // Auto-select first batch if event changes
  React.useEffect(() => {
    if (batchesForEvent.length > 0) {
      const activeBatch = batchesForEvent.find(b => b.totalQuantity - b.soldQuantity > 0) || batchesForEvent[0];
      setSelectedBatchId(activeBatch.id);
      setQuantity(1);
    } else {
      setSelectedBatchId('');
    }
  }, [batchesForEvent]);

  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedEventId) {
      setErrorMessage('Selecione um evento para realizar a venda.');
      return;
    }

    if (!selectedBatchId || !selectedBatch) {
      setErrorMessage('Selecione um tipo de ingresso válido.');
      return;
    }

    if (availableStock < quantity) {
      setErrorMessage(`Estoque insuficiente! Apenas ${availableStock} disponíveis.`);
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Informe o nome do cliente.');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMessage('Informe o WhatsApp ou telefone do cliente para entrega do ingresso.');
      return;
    }

    setIsProcessing(true);

    try {
      const result = StorageService.createSale({
        companyId: currentEvent?.companyId || companyId,
        eventId: selectedEventId,
        batchId: selectedBatchId,
        quantity,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerDoc: customerDoc.trim() || undefined,
        paymentMethod,
        seller: currentUser
      });

      // Open post-sale modal
      setGeneratedTickets(result.tickets);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao processar a venda.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetForNewSale = () => {
    setGeneratedTickets(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerDoc('');
    setCustomerEmail('');
    setQuantity(1);
    setErrorMessage('');
  };

  const paymentOptions: { id: PaymentMethod; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'pix', label: 'Pix', icon: <QrCode className="w-4 h-4 text-teal-600" />, desc: 'Instantâneo' },
    { id: 'dinheiro', label: 'Dinheiro', icon: <Banknote className="w-4 h-4 text-emerald-600" />, desc: 'Presencial' },
    { id: 'credito', label: 'Cartão Crédito', icon: <CreditCard className="w-4 h-4 text-indigo-600" />, desc: 'À vista/Parc.' },
    { id: 'debito', label: 'Cartão Débito', icon: <CreditCard className="w-4 h-4 text-blue-600" />, desc: 'Direto na conta' },
    { id: 'cortesia', label: 'Cortesia', icon: <Gift className="w-4 h-4 text-amber-600" />, desc: 'Vip/Parceiro' },
    { id: 'outros', label: 'Outros', icon: <Sparkles className="w-4 h-4 text-purple-600" />, desc: 'Transferência/Boleto' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      {/* Custom Toast Notification confirming printing service */}
      <PrintToast
        toast={printToast}
        onClose={() => setPrintToast(null)}
        onReprint={handleReprintFromToast}
      />

      {/* Top Banner / Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">PDV de Ingressos</h1>
              <p className="text-sm text-slate-500">Venda presencial ultra rápida com emissão imediata e envio WhatsApp</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Print Status Indicator in header for fast-paced queue operations */}
          {lastPrintJob && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium no-print">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Última impressão: <strong>{lastPrintJob.ticketLabel}</strong> ({lastPrintJob.timestamp})
              </span>
              <button
                type="button"
                onClick={() => {
                  setPrintToast(lastPrintJob);
                  handleReprintFromToast();
                }}
                className="text-emerald-700 hover:text-emerald-950 font-bold underline cursor-pointer ml-1"
                title="Reenviar comando de impressão"
              >
                Reimprimir
              </button>
            </div>
          )}

          {currentUser.role === 'SELLER' && (
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs font-medium">
              <span>Operador: <strong>{currentUser.name}</strong></span>
              {currentUser.commissionRate ? (
                <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold">
                  Comissão: {currentUser.commissionRate}%
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Atenção na venda:</strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Main POS Grid */}
      <form onSubmit={handleSaleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Event & Ticket Selection */}
        <div className="lg:col-span-2 space-y-5">
          {/* Step 1: Select Event */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">1</span>
              <span>Selecionar Evento</span>
            </div>

            {authorizedEvents.length === 0 ? (
              <p className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                Nenhum evento ativo disponível no momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {authorizedEvents.map(evt => {
                  const isSelected = evt.id === selectedEventId;
                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEventId(evt.id)}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex gap-3 text-left ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <img
                        src={evt.coverImage}
                        alt={evt.name}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{evt.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatDate(evt.date)} • {evt.startTime}h
                        </p>
                        <p className="text-xs text-slate-600 font-medium truncate mt-0.5">{evt.venue}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Select Ticket Batch */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">2</span>
                <span>Tipo de Ingresso & Lote</span>
              </div>
              <span className="text-xs text-slate-500">{batchesForEvent.length} opções disponíveis</span>
            </div>

            {batchesForEvent.length === 0 ? (
              <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl text-center">
                Cadastre lotes de ingressos neste evento para iniciar as vendas.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {batchesForEvent.map(batch => {
                  const isSelected = batch.id === selectedBatchId;
                  const available = batch.totalQuantity - batch.soldQuantity;
                  const soldOut = available <= 0;

                  return (
                    <div
                      key={batch.id}
                      onClick={() => {
                        if (!soldOut) setSelectedBatchId(batch.id);
                      }}
                      className={`p-4 rounded-xl border-2 transition-all relative ${
                        soldOut
                          ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 bg-white cursor-pointer'
                      }`}
                    >
                      {soldOut && (
                        <span className="absolute top-2.5 right-2.5 text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-rose-600 text-white">
                          ESGOTADO
                        </span>
                      )}

                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                            {batch.name}
                          </span>
                          <h4 className="text-base font-bold text-slate-900">{batch.ticketTypeName}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-slate-900">
                            {batch.price === 0 ? 'Cortesia' : formatCurrency(batch.price)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Disponíveis: <strong className={available < 10 ? 'text-amber-600 font-bold' : 'text-slate-700 font-semibold'}>{available}</strong> / {batch.totalQuantity}</span>
                        {isSelected && !soldOut && (
                          <span className="text-indigo-700 font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Selecionado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quantity Selector */}
            {selectedBatch && !isSoldOut && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">Quantidade de Ingressos:</label>
                  <p className="text-xs text-slate-400">Restam {availableStock} no estoque</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center font-bold text-slate-700 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <span className="w-12 text-center text-lg font-bold text-slate-900">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => setQuantity(prev => Math.min(availableStock, prev + 1))}
                    disabled={quantity >= availableStock}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center font-bold text-slate-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <div className="flex gap-1 ml-2">
                    {[1, 2, 3, 5].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setQuantity(Math.min(availableStock, num))}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                          quantity === num
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        +{num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Customer Details, Payment & Checkout */}
        <div className="space-y-5">
          {/* Step 3: Customer Information */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">3</span>
              <span>Dados do Cliente</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Roberto da Silva"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp / Celular * (Para envio do ingresso)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="Ex: (11) 98765-4321"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    CPF (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={customerDoc}
                    onChange={e => setCustomerDoc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    E-mail (Opcional)
                  </label>
                  <input
                    type="email"
                    placeholder="cliente@email.com"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Payment Method */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">4</span>
              <span>Forma de Pagamento</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map(opt => {
                const isSelected = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-white shadow-2xs">
                      {opt.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs leading-tight font-semibold">{opt.label}</p>
                      <p className="text-[10px] text-slate-400 leading-tight">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Order Summary & Confirm Button */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Resumo da Venda</h4>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Evento:</span>
                <span className="font-semibold text-white truncate max-w-[170px]">
                  {currentEvent?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ingresso:</span>
                <span className="font-semibold text-white">
                  {selectedBatch ? `${selectedBatch.ticketTypeName} (${quantity}x)` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Pagamento:</span>
                <span className="font-semibold uppercase text-emerald-400">
                  {paymentMethod}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-base font-medium text-slate-200">Total a Pagar:</span>
                <span className="text-2xl font-black text-emerald-400">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing || !selectedBatch || isSoldOut || !customerName || !customerPhone}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              {isProcessing ? (
                <span>Emitindo Ingressos...</span>
              ) : (
                <>
                  <span>CONFIRMAR VENDA</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-slate-400">
              Gera o ingresso digital e o QR Code imediatamente após a confirmação.
            </p>
          </div>
        </div>
      </form>

      {/* Post-Sale Modal with QR Code & Print / WhatsApp */}
      {generatedTickets && currentEvent && (
        <TicketDisplayModal
          tickets={generatedTickets}
          event={currentEvent}
          onClose={() => setGeneratedTickets(null)}
          onNewSale={handleResetForNewSale}
          onPrintSuccess={handlePrintSuccess}
        />
      )}
    </div>
  );
};
