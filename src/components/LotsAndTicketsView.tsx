import React, { useState } from 'react';
import {
  Plus,
  Ticket,
  Layers,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Edit2,
  Filter
} from 'lucide-react';
import { Event, TicketBatch, BatchStatus, User } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../services/whatsapp';

interface LotsAndTicketsViewProps {
  currentUser: User;
  initialEventId?: string;
  onOpenPOS: (eventId: string) => void;
}

export const LotsAndTicketsView: React.FC<LotsAndTicketsViewProps> = ({
  currentUser,
  initialEventId,
  onOpenPOS
}) => {
  const companyId = StorageService.getCurrentCompanyId();
  const events = StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId);

  const [selectedEventId, setSelectedEventId] = useState<string>(
    initialEventId || events[0]?.id || ''
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBatch, setEditingBatch] = useState<TicketBatch | null>(null);

  const [formData, setFormData] = useState({
    name: '1º Lote',
    ticketTypeName: 'Pista',
    price: 100.0,
    totalQuantity: 100,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '2026-12-31',
    status: 'active' as BatchStatus
  });

  const batches = StorageService.getBatches(
    currentUser.role === 'MASTER' ? undefined : companyId,
    selectedEventId || undefined
  );

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const handleOpenCreate = () => {
    setEditingBatch(null);
    setFormData({
      name: '1º Lote',
      ticketTypeName: 'Pista',
      price: 100.0,
      totalQuantity: 100,
      startDate: selectedEvent?.date || new Date().toISOString().split('T')[0],
      endDate: selectedEvent?.date || '2026-12-31',
      status: 'active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (batch: TicketBatch) => {
    setEditingBatch(batch);
    setFormData({
      name: batch.name,
      ticketTypeName: batch.ticketTypeName,
      price: batch.price,
      totalQuantity: batch.totalQuantity,
      startDate: batch.startDate,
      endDate: batch.endDate,
      status: batch.status
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    if (editingBatch) {
      StorageService.updateBatch(editingBatch.id, {
        name: formData.name,
        ticketTypeName: formData.ticketTypeName,
        price: Number(formData.price),
        totalQuantity: Number(formData.totalQuantity),
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status
      });
    } else {
      StorageService.saveBatch({
        companyId: selectedEvent?.companyId || companyId,
        eventId: selectedEventId,
        name: formData.name,
        ticketTypeName: formData.ticketTypeName,
        price: Number(formData.price),
        totalQuantity: Number(formData.totalQuantity),
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status
      });
    }

    setIsModalOpen(false);
  };

  const presetTicketTypes = [
    'Pista',
    'VIP',
    'Área Premium',
    'Camarote Open Bar',
    'Lounge Exclusivo',
    'Cortesia',
    'Meia-Entrada Estudante'
  ];

  const presetBatches = [
    'Lote Promocional',
    '1º Lote',
    '2º Lote',
    '3º Lote',
    'Lote Extra',
    'Portaria / Na Hora'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Lotes & Ingressos</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Configure tipos de ingresso, precificação, limites de estoque e controle de esgotamento
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
          >
            {events.map(evt => (
              <option key={evt.id} value={evt.id}>
                {evt.name}
              </option>
            ))}
          </select>

          {(currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>CRIAR LOTE</span>
            </button>
          )}
        </div>
      </div>

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {batches.map(batch => {
          const available = batch.totalQuantity - batch.soldQuantity;
          const isSoldOut = available <= 0 || batch.status === 'exhausted';
          const percentSold = batch.totalQuantity > 0 ? (batch.soldQuantity / batch.totalQuantity) * 100 : 0;

          return (
            <div
              key={batch.id}
              className={`bg-white rounded-2xl border-2 transition-all p-5 shadow-xs flex flex-col justify-between ${
                isSoldOut ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider text-indigo-600">
                      {batch.name}
                    </span>
                    <h3 className="text-lg font-black text-slate-900">{batch.ticketTypeName}</h3>
                  </div>

                  {isSoldOut ? (
                    <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                      INGRESSO ESGOTADO
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                      Ativo
                    </span>
                  )}
                </div>

                <div className="py-2 border-y border-slate-100 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500 font-medium">Valor Unitário:</span>
                  <span className="text-2xl font-black text-slate-900">
                    {batch.price === 0 ? 'Cortesia (R$ 0)' : formatCurrency(batch.price)}
                  </span>
                </div>

                {/* Stock progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Estoque:</span>
                    <span className="font-bold text-slate-800">
                      {batch.soldQuantity} vendidos / {batch.totalQuantity} total
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        isSoldOut ? 'bg-rose-500' : percentSold > 75 ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, percentSold)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Disponíveis p/ venda:</span>
                    <strong className={`font-bold ${available < 10 ? 'text-amber-600' : 'text-slate-700'}`}>
                      {Math.max(0, available)} ingressos
                    </strong>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-300" />
                  <span>Vendas até: {formatDate(batch.endDate)}</span>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                {(currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') && (
                  <button
                    onClick={() => handleOpenEdit(batch)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                )}

                <button
                  disabled={isSoldOut}
                  onClick={() => onOpenPOS(batch.eventId)}
                  className="ml-auto py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Vender no PDV
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create/Edit Batch */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingBatch ? 'Editar Lote' : 'Novo Lote / Tipo de Ingresso'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Lote *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: 1º Lote, Lote Promocional..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {presetBatches.map(pb => (
                    <button
                      key={pb}
                      type="button"
                      onClick={() => setFormData({ ...formData, name: pb })}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      {pb}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Ingresso *
                </label>
                <input
                  type="text"
                  required
                  value={formData.ticketTypeName}
                  onChange={e => setFormData({ ...formData, ticketTypeName: e.target.value })}
                  placeholder="Ex: VIP, Pista, Camarote..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {presetTicketTypes.map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setFormData({ ...formData, ticketTypeName: pt })}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preço (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                  <span className="text-[11px] text-slate-400">Use 0 para cortesias</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quantidade Total *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.totalQuantity}
                    onChange={e => setFormData({ ...formData, totalQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                  <span className="text-[11px] text-slate-400">Limite de estoque</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Início das Vendas
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Término das Vendas
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                >
                  {editingBatch ? 'Salvar Lote' : 'Cadastrar Lote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
