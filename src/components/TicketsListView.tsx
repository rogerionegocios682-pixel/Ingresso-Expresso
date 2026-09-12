import React, { useState, useMemo } from 'react';
import {
  Ticket as TicketIcon,
  Search,
  Filter,
  Eye,
  Send,
  Printer,
  Ban,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  AlertCircle
} from 'lucide-react';
import { Ticket, TicketStatus, User } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate, generateWhatsAppMessage, openWhatsAppChat } from '../services/whatsapp';
import { exportToCSV } from '../services/export';
import { TicketDisplayModal } from './TicketDisplayModal';

interface TicketsListViewProps {
  currentUser: User;
}

export const TicketsListView: React.FC<TicketsListViewProps> = ({ currentUser }) => {
  if (currentUser.role !== 'MASTER' && currentUser.role !== 'ADMIN') {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center space-y-3">
        <p className="text-rose-600 font-bold">Acesso restrito à administração da plataforma.</p>
      </div>
    );
  }

  const companyId = StorageService.getCurrentCompanyId();
  const allEvents = StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId);
  const [tickets, setTickets] = useState<Ticket[]>(() =>
    StorageService.getTickets(currentUser.role === 'MASTER' ? undefined : companyId)
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | TicketStatus>('all');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  // Cancel modal
  const [cancellingTicket, setCancellingTicket] = useState<Ticket | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Ticket Modal Preview
  const [previewTicket, setPreviewTicket] = useState<Ticket | null>(null);

  const refreshTickets = () => {
    setTickets(StorageService.getTickets(currentUser.role === 'MASTER' ? undefined : companyId));
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch =
        t.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.validationToken.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.customerPhone && t.customerPhone.includes(searchTerm));

      const matchStatus = statusTab === 'all' || t.status === statusTab;
      const matchEvent = selectedEventId === 'all' || t.eventId === selectedEventId;

      return matchSearch && matchStatus && matchEvent;
    });
  }, [tickets, searchTerm, statusTab, selectedEventId]);

  const handleCancelTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingTicket) return;

    StorageService.cancelTicket(
      cancellingTicket.id,
      cancelReason.trim() || 'Cancelado pela administração',
      currentUser
    );

    setCancellingTicket(null);
    setCancelReason('');
    refreshTickets();
  };

  const handleExportCSV = () => {
    const headers = ['Nº Ingresso', 'Token Antifraude', 'Evento', 'Lote', 'Tipo', 'Cliente', 'WhatsApp', 'Valor', 'Status', 'Data Compra', 'Check-in'];
    const rows = filteredTickets.map(t => {
      const evt = allEvents.find(e => e.id === t.eventId);
      return [
        t.ticketNumber,
        t.validationToken,
        evt?.name || t.eventId,
        t.batchName,
        t.ticketTypeName,
        t.customerName,
        t.customerPhone,
        t.price,
        t.status,
        t.purchaseDate,
        t.usedAt || 'Não utilizado'
      ];
    });
    exportToCSV('ingressos_eventos', headers, rows);
  };

  const counts = useMemo(() => {
    return {
      all: tickets.length,
      valid: tickets.filter(t => t.status === 'valid').length,
      used: tickets.filter(t => t.status === 'used').length,
      cancelled: tickets.filter(t => t.status === 'cancelled').length
    };
  }, [tickets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Gerenciamento de Ingressos</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Consulte identificadores únicos, tokens criptografados e status de uso de cada ingresso
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 py-2 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          Exportar CSV
        </button>
      </div>

      {/* Tabs matching requirement #31: Todos, Válidos, Utilizados, Cancelados */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setStatusTab('all')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            statusTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Todos ({counts.all})
        </button>
        <button
          onClick={() => setStatusTab('valid')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            statusTab === 'valid'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Válidos ({counts.valid})
        </button>
        <button
          onClick={() => setStatusTab('used')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            statusTab === 'used'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Utilizados ({counts.used})
        </button>
        <button
          onClick={() => setStatusTab('cancelled')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            statusTab === 'cancelled'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Cancelados ({counts.cancelled})
        </button>
      </div>

      {/* Search & Event Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por Nº do ingresso, cliente, token..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500">Filtrar Evento:</span>
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800"
          >
            <option value="all">Todos os Eventos</option>
            {allEvents.map(evt => (
              <option key={evt.id} value={evt.id}>
                {evt.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Ingresso / Nº</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Tipo & Lote</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Check-in</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    Nenhum ingresso encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredTickets.map(ticket => {
                  const event = allEvents.find(e => e.id === ticket.eventId);

                  return (
                    <tr key={ticket.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 block">
                          {ticket.ticketNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ticket.validationToken}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">{ticket.customerName}</span>
                        <span className="text-xs text-slate-500">{ticket.customerPhone}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-indigo-700 block">{ticket.ticketTypeName}</span>
                        <span className="text-xs text-slate-400">{ticket.batchName}</span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatCurrency(ticket.price)}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            ticket.status === 'valid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ticket.status === 'used'
                              ? 'bg-indigo-100 text-indigo-800'
                              : ticket.status === 'cancelled'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ticket.status === 'valid'
                            ? 'Válido'
                            : ticket.status === 'used'
                            ? 'Utilizado'
                            : ticket.status === 'cancelled'
                            ? 'Cancelado'
                            : 'Bloqueado'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-600">
                        {ticket.usedAt ? (
                          <div>
                            <span className="font-semibold text-teal-700 block">
                              {new Date(ticket.usedAt).toLocaleTimeString('pt-BR')}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {ticket.usedByUserName || 'Portaria'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pendente</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewTicket(ticket)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors"
                            title="Ver Ingresso / QR Code"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {event && (
                            <button
                              onClick={() => {
                                const msg = generateWhatsAppMessage(ticket, event);
                                openWhatsAppChat(ticket.customerPhone, msg);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 transition-colors"
                              title="Reenviar pelo WhatsApp"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}

                          {ticket.status === 'valid' && (currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') && (
                            <button
                              onClick={() => setCancellingTicket(ticket)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors"
                              title="Cancelar Ingresso"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Modal Confirmation */}
      {cancellingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-50">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Cancelar Ingresso</h3>
            </div>

            <p className="text-xs text-slate-600">
              Tem certeza que deseja cancelar o ingresso{' '}
              <strong className="font-mono text-slate-900">{cancellingTicket.ticketNumber}</strong> de{' '}
              <strong>{cancellingTicket.customerName}</strong>?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo do Cancelamento *
              </label>
              <textarea
                required
                rows={2}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Ex: Cancelamento solicitado pelo cliente dentro do prazo legal..."
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingTicket(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelTicket}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket QR Modal */}
      {previewTicket && (
        <TicketDisplayModal
          tickets={[previewTicket]}
          event={allEvents.find(e => e.id === previewTicket.eventId) || allEvents[0]}
          onClose={() => setPreviewTicket(null)}
          onNewSale={() => setPreviewTicket(null)}
        />
      )}
    </div>
  );
};
