import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  Filter,
  Download,
  Calendar,
  CreditCard,
  User,
  CheckCircle2,
  XCircle,
  Eye
} from 'lucide-react';
import { Sale, PaymentMethod, User as UserType } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../services/whatsapp';
import { exportToCSV } from '../services/export';
import { TicketDisplayModal } from './TicketDisplayModal';

interface SalesListViewProps {
  currentUser: UserType;
  onOpenPOS: () => void;
}

export const SalesListView: React.FC<SalesListViewProps> = ({ currentUser, onOpenPOS }) => {
  const companyId = StorageService.getCurrentCompanyId();
  const allEvents = StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId);
  const allSellers = StorageService.getUsers(currentUser.role === 'MASTER' ? undefined : companyId).filter(
    u => u.role === 'SELLER' || u.role === 'ADMIN'
  );

  const sales = StorageService.getSales(currentUser.role === 'MASTER' ? undefined : companyId);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [selectedSellerId, setSelectedSellerId] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Preview tickets from sale
  const [viewingSaleTickets, setViewingSaleTickets] = useState<{ tickets: any[]; event: any } | null>(null);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // If current user is a SELLER, they can only view their own sales unless ADMIN/MASTER
      if (currentUser.role === 'SELLER' && s.sellerId !== currentUser.id) {
        return false;
      }

      const matchSearch =
        s.saleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customerPhone.includes(searchTerm);

      const matchEvent = selectedEventId === 'all' || s.eventId === selectedEventId;
      const matchSeller = selectedSellerId === 'all' || s.sellerId === selectedSellerId;
      const matchPayment = selectedPayment === 'all' || s.paymentMethod === selectedPayment;
      const matchStatus = selectedStatus === 'all' || s.status === selectedStatus;

      return matchSearch && matchEvent && matchSeller && matchPayment && matchStatus;
    });
  }, [sales, searchTerm, selectedEventId, selectedSellerId, selectedPayment, selectedStatus, currentUser]);

  const handleExportCSV = () => {
    const headers = ['Nº Venda', 'Data', 'Cliente', 'WhatsApp', 'Evento', 'Ingresso', 'Qtd', 'Valor Total', 'Forma Pagamento', 'Vendedor', 'Comissão', 'Status'];
    const rows = filteredSales.map(s => [
      s.saleNumber,
      new Date(s.createdAt).toLocaleString('pt-BR'),
      s.customerName,
      s.customerPhone,
      s.eventName,
      s.ticketTypeName,
      s.quantity,
      s.totalAmount,
      s.paymentMethod,
      s.sellerName,
      s.sellerCommission,
      s.status
    ]);
    exportToCSV('vendas_ingressos', headers, rows);
  };

  const handleOpenSaleTickets = (sale: Sale) => {
    const saleTickets = StorageService.getTickets().filter(t => t.saleId === sale.id);
    const evt = allEvents.find(e => e.id === sale.eventId) || allEvents[0];
    if (saleTickets.length > 0 && evt) {
      setViewingSaleTickets({ tickets: saleTickets, event: evt });
    }
  };

  const totalVolume = filteredSales.reduce((a, b) => a + (b.status === 'completed' ? b.totalAmount : 0), 0);
  const totalTickets = filteredSales.reduce((a, b) => a + (b.status === 'completed' ? b.quantity : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Histórico de Vendas</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Registro detalhado de pedidos, canais de venda, formas de pagamento e comissões
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 py-2 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            CSV
          </button>
          <button
            onClick={onOpenPOS}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            + Nova Venda PDV
          </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Total de Vendas</span>
          <p className="text-xl font-black text-slate-900">{filteredSales.length}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Ingressos Vendidos</span>
          <p className="text-xl font-black text-indigo-700">{totalTickets} un.</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Valor Faturado</span>
          <p className="text-xl font-black text-emerald-700">{formatCurrency(totalVolume)}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Ticket Médio</span>
          <p className="text-xl font-black text-slate-900">
            {filteredSales.length > 0 ? formatCurrency(totalVolume / filteredSales.length) : 'R$ 0,00'}
          </p>
        </div>
      </div>

      {/* Filters Bar matching requirement #16 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por nº da venda, cliente, telefone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Event Filter */}
            <select
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800"
            >
              <option value="all">Todos Eventos</option>
              {allEvents.map(evt => (
                <option key={evt.id} value={evt.id}>{evt.name}</option>
              ))}
            </select>

            {/* Seller Filter (only if Admin/Master) */}
            {currentUser.role !== 'SELLER' ? (
              <select
                value={selectedSellerId}
                onChange={e => setSelectedSellerId(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800"
              >
                <option value="all">Todos Vendedores</option>
                {allSellers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : null}

            {/* Payment Method Filter */}
            <select
              value={selectedPayment}
              onChange={e => setSelectedPayment(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800"
            >
              <option value="all">Todas Formas Pag.</option>
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="credito">Cartão de Crédito</option>
              <option value="debito">Cartão de Débito</option>
              <option value="cortesia">Cortesia</option>
              <option value="outros">Outros</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800"
            >
              <option value="all">Todos Status</option>
              <option value="completed">Concluída</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table matching requirement #16:
          Nº venda, Data, Cliente, Evento, Ingresso, Quantidade, Valor, Forma de pagamento, Vendedor, Status */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Nº Venda</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Evento</th>
                <th className="py-3 px-4">Ingresso / Tipo</th>
                <th className="py-3 px-4 text-center">Qtd</th>
                <th className="py-3 px-4">Valor Total</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 italic">
                    Nenhuma venda encontrada para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {sale.saleNumber}
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{sale.customerName}</span>
                      <span className="text-xs text-slate-500">{sale.customerPhone}</span>
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-700 max-w-[160px] truncate">
                      {sale.eventName}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-indigo-700 block">{sale.ticketTypeName}</span>
                      <span className="text-xs text-slate-400">{sale.batchName}</span>
                    </td>

                    <td className="py-3 px-4 text-center font-bold text-slate-900">
                      {sale.quantity}
                    </td>

                    <td className="py-3 px-4 font-black text-emerald-700 whitespace-nowrap">
                      {formatCurrency(sale.totalAmount)}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-slate-100 text-slate-800">
                        {sale.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-600">
                      {sale.sellerName}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          sale.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sale.status === 'completed' ? 'Concluída' : 'Cancelada'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenSaleTickets(sale)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors"
                        title="Ver Ingressos Emitidos"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Modal Preview */}
      {viewingSaleTickets && (
        <TicketDisplayModal
          tickets={viewingSaleTickets.tickets}
          event={viewingSaleTickets.event}
          onClose={() => setViewingSaleTickets(null)}
          onNewSale={() => setViewingSaleTickets(null)}
        />
      )}
    </div>
  );
};
