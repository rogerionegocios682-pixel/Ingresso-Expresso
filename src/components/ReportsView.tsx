import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  DollarSign,
  Ticket,
  UserCheck,
  TrendingUp,
  Percent,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { User, Event, Sale } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../services/whatsapp';
import { exportToCSV } from '../services/export';

interface ReportsViewProps {
  currentUser: User;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUser }) => {
  const companyId = StorageService.getCurrentCompanyId();
  const allEvents = StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId);
  const allUsers = StorageService.getUsers(currentUser.role === 'MASTER' ? undefined : companyId);

  const [activeReportType, setActiveReportType] = useState<
    'general' | 'sales' | 'financial' | 'checkin' | 'cancelled' | 'seller'
  >('general');

  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');

  const sales = StorageService.getSales(
    currentUser.role === 'MASTER' ? undefined : companyId,
    selectedEventId === 'all' ? undefined : selectedEventId
  );

  const tickets = StorageService.getTickets(
    currentUser.role === 'MASTER' ? undefined : companyId,
    selectedEventId === 'all' ? undefined : selectedEventId
  );

  const stats = StorageService.getDashboardStats(
    currentUser.role === 'MASTER' ? undefined : companyId,
    selectedEventId === 'all' ? undefined : selectedEventId
  );

  // Financial calculations
  const financialTotals = useMemo(() => {
    let pix = 0;
    let dinheiro = 0;
    let credito = 0;
    let debito = 0;
    let cortesia = 0;
    let outros = 0;
    let totalGross = 0;
    let totalCommissions = 0;

    sales.forEach(s => {
      if (s.status === 'completed') {
        totalGross += s.totalAmount;
        totalCommissions += s.sellerCommission;

        if (s.paymentMethod === 'pix') pix += s.totalAmount;
        else if (s.paymentMethod === 'dinheiro') dinheiro += s.totalAmount;
        else if (s.paymentMethod === 'credito') credito += s.totalAmount;
        else if (s.paymentMethod === 'debito') debito += s.totalAmount;
        else if (s.paymentMethod === 'cortesia') cortesia += s.totalAmount;
        else outros += s.totalAmount;
      }
    });

    const netRevenue = totalGross - totalCommissions;

    return {
      totalGross,
      totalCommissions,
      netRevenue,
      pix,
      dinheiro,
      credito,
      debito,
      cortesia,
      outros
    };
  }, [sales]);

  // Seller Performance
  const sellerStats = useMemo(() => {
    const sellers = allUsers.filter(u => u.role === 'SELLER' || u.role === 'ADMIN');
    return sellers.map(seller => {
      const sSales = sales.filter(s => s.sellerId === seller.id && s.status === 'completed');
      const ticketsCount = sSales.reduce((a, b) => a + b.quantity, 0);
      const totalAmount = sSales.reduce((a, b) => a + b.totalAmount, 0);
      const commission = sSales.reduce((a, b) => a + b.sellerCommission, 0);
      return {
        seller,
        ticketsCount,
        totalAmount,
        commission
      };
    });
  }, [allUsers, sales]);

  const handleExport = () => {
    if (activeReportType === 'sales') {
      const headers = ['Nº Venda', 'Data', 'Cliente', 'Evento', 'Ingresso', 'Qtd', 'Valor Total', 'Forma Pagamento', 'Vendedor'];
      const rows = sales.map(s => [
        s.saleNumber,
        new Date(s.createdAt).toLocaleString('pt-BR'),
        s.customerName,
        s.eventName,
        s.ticketTypeName,
        s.quantity,
        s.totalAmount,
        s.paymentMethod,
        s.sellerName
      ]);
      exportToCSV('relatorio_vendas', headers, rows);
    } else if (activeReportType === 'checkin') {
      const headers = ['Nº Ingresso', 'Token', 'Cliente', 'Evento', 'Status', 'Hora Check-in', 'Operador Portaria'];
      const rows = tickets.map(t => [
        t.ticketNumber,
        t.validationToken,
        t.customerName,
        t.eventId,
        t.status,
        t.usedAt || 'Pendente',
        t.usedByUserName || '-'
      ]);
      exportToCSV('relatorio_checkins', headers, rows);
    } else if (activeReportType === 'cancelled') {
      const cancelled = tickets.filter(t => t.status === 'cancelled');
      const headers = ['Nº Ingresso', 'Cliente', 'Valor', 'Data Cancelamento', 'Motivo', 'Cancelado Por'];
      const rows = cancelled.map(t => [
        t.ticketNumber,
        t.customerName,
        t.price,
        t.cancelledAt || '-',
        t.cancelReason || '-',
        t.cancelledByUserName || '-'
      ]);
      exportToCSV('relatorio_cancelados', headers, rows);
    } else {
      // General
      const headers = ['Métrica', 'Valor'];
      const rows = [
        ['Eventos Ativos', stats.activeEventsCount],
        ['Total Ingressos Vendidos', stats.totalTicketsSold],
        ['Total Ingressos Disponíveis', stats.totalTicketsAvailable],
        ['Faturamento Bruto', formatCurrency(stats.totalRevenue)],
        ['Check-ins Concluídos', stats.checkInsCompleted],
        ['Aguardando Entrada', stats.peopleWaiting],
        ['Ingressos Cancelados', stats.cancelledCount]
      ];
      exportToCSV('relatorio_geral_eventos', headers, rows);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Relatórios Gerenciais</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Relatórios completos de auditoria de vendas, faturamento financeiro, portaria e comissões
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Imprimir / PDF
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Report Types Tabs matching requirement #19:
          Geral do evento, Vendas, Financeiro, Check-in, Ingressos cancelados, Por vendedor */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 print:hidden">
        <button
          onClick={() => setActiveReportType('general')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeReportType === 'general' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveReportType('sales')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeReportType === 'sales' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Vendas
        </button>
        <button
          onClick={() => setActiveReportType('financial')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeReportType === 'financial' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Financeiro
        </button>
        <button
          onClick={() => setActiveReportType('checkin')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeReportType === 'checkin' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Portaria / Check-in
        </button>
        <button
          onClick={() => setActiveReportType('cancelled')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeReportType === 'cancelled' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Cancelados
        </button>
        <button
          onClick={() => setActiveReportType('seller')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeReportType === 'seller' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Por Vendedor
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap gap-3 items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Evento:</span>
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
          >
            <option value="all">Todos os Eventos</option>
            {allEvents.map(evt => (
              <option key={evt.id} value={evt.id}>{evt.name}</option>
            ))}
          </select>
        </div>

        {activeReportType === 'sales' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Forma de Pagamento:</span>
            <select
              value={selectedPayment}
              onChange={e => setSelectedPayment(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
            >
              <option value="all">Todas</option>
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="credito">Cartão de Crédito</option>
              <option value="debito">Cartão de Débito</option>
              <option value="cortesia">Cortesia</option>
            </select>
          </div>
        )}
      </div>

      {/* Content for active report */}

      {/* 1. VISÃO GERAL */}
      {activeReportType === 'general' && (
        <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Relatório Consolidado do Evento</h2>
            <p className="text-xs text-slate-500">Data de emissão: {new Date().toLocaleString('pt-BR')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-xs text-slate-500 font-semibold block">Total Ingressos</span>
              <strong className="text-2xl font-black text-slate-900">{stats.totalTicketsSold + stats.totalTicketsAvailable}</strong>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/60">
              <span className="text-xs text-emerald-700 font-semibold block">Ingressos Vendidos</span>
              <strong className="text-2xl font-black text-emerald-800">{stats.totalTicketsSold}</strong>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200/60">
              <span className="text-xs text-blue-700 font-semibold block">Receita Bruta</span>
              <strong className="text-2xl font-black text-blue-900">{formatCurrency(stats.totalRevenue)}</strong>
            </div>
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200/60">
              <span className="text-xs text-teal-700 font-semibold block">Taxa de Presença</span>
              <strong className="text-2xl font-black text-teal-800">
                {stats.totalTicketsSold > 0 ? ((stats.checkInsCompleted / stats.totalTicketsSold) * 100).toFixed(1) : 0}%
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 2. RELATÓRIO FINANCEIRO */}
      {activeReportType === 'financial' && (
        <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Demonstrativo Financeiro e Formas de Pagamento</h2>
            <p className="text-xs text-slate-500">Detalhamento de faturamento líquido e deduções de comissões</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs font-bold text-emerald-800 uppercase block">Faturamento Bruto</span>
              <p className="text-2xl font-black text-emerald-900">{formatCurrency(financialTotals.totalGross)}</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-xs font-bold text-rose-800 uppercase block">Comissões de Vendedores</span>
              <p className="text-2xl font-black text-rose-700">- {formatCurrency(financialTotals.totalCommissions)}</p>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
              <span className="text-xs font-bold text-indigo-800 uppercase block">Receita Líquida</span>
              <p className="text-2xl font-black text-indigo-950">{formatCurrency(financialTotals.netRevenue)}</p>
            </div>
          </div>

          <div className="pt-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Receita por Meio de Pagamento</h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-3.5 flex justify-between text-xs bg-slate-50 font-bold text-slate-600">
                <span>Forma de Pagamento</span>
                <span>Subtotal Faturado</span>
              </div>
              <div className="p-3.5 flex justify-between text-xs">
                <span>Pix Instantâneo</span>
                <strong className="font-mono text-slate-900">{formatCurrency(financialTotals.pix)}</strong>
              </div>
              <div className="p-3.5 flex justify-between text-xs">
                <span>Cartão de Crédito</span>
                <strong className="font-mono text-slate-900">{formatCurrency(financialTotals.credito)}</strong>
              </div>
              <div className="p-3.5 flex justify-between text-xs">
                <span>Cartão de Débito</span>
                <strong className="font-mono text-slate-900">{formatCurrency(financialTotals.debito)}</strong>
              </div>
              <div className="p-3.5 flex justify-between text-xs">
                <span>Dinheiro em Espécie</span>
                <strong className="font-mono text-slate-900">{formatCurrency(financialTotals.dinheiro)}</strong>
              </div>
              <div className="p-3.5 flex justify-between text-xs">
                <span>Cortesias e Parcerias (R$ 0)</span>
                <strong className="font-mono text-slate-900">{formatCurrency(financialTotals.cortesia)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. RELATÓRIO DE VENDAS */}
      {activeReportType === 'sales' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Listagem Completa de Vendas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Nº Venda</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Evento</th>
                  <th className="p-3">Ingresso</th>
                  <th className="p-3 text-center">Qtd</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Pagamento</th>
                  <th className="p-3">Vendedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map(s => (
                  <tr key={s.id}>
                    <td className="p-3 font-mono font-bold">{s.saleNumber}</td>
                    <td className="p-3 text-slate-500">{new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3 font-medium text-slate-900">{s.customerName}</td>
                    <td className="p-3 text-slate-600">{s.eventName}</td>
                    <td className="p-3 text-indigo-600 font-semibold">{s.ticketTypeName}</td>
                    <td className="p-3 text-center font-bold">{s.quantity}</td>
                    <td className="p-3 font-bold text-emerald-700">{formatCurrency(s.totalAmount)}</td>
                    <td className="p-3 uppercase text-[10px]">{s.paymentMethod}</td>
                    <td className="p-3 text-slate-600">{s.sellerName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. RELATÓRIO DE CHECK-IN */}
      {activeReportType === 'checkin' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900">Relatório de Portaria e Entradas</h3>
              <p className="text-xs text-slate-500">{stats.checkInsCompleted} check-ins realizados</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Ingresso</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Hora Entrada</th>
                  <th className="p-3">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map(t => (
                  <tr key={t.id}>
                    <td className="p-3 font-mono font-bold">{t.ticketNumber}</td>
                    <td className="p-3 font-medium">{t.customerName}</td>
                    <td className="p-3 text-indigo-700">{t.ticketTypeName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        t.status === 'used' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.status === 'used' ? 'Entrou' : 'Pendente'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">
                      {t.usedAt ? new Date(t.usedAt).toLocaleTimeString('pt-BR') : '-'}
                    </td>
                    <td className="p-3 text-slate-500">{t.usedByUserName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. INGRESSOS CANCELADOS */}
      {activeReportType === 'cancelled' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Relatório de Ingressos Cancelados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Ingresso</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Data Cancelamento</th>
                  <th className="p-3">Motivo</th>
                  <th className="p-3">Cancelado Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.filter(t => t.status === 'cancelled').length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                      Nenhum ingresso cancelado registrado.
                    </td>
                  </tr>
                ) : (
                  tickets.filter(t => t.status === 'cancelled').map(t => (
                    <tr key={t.id}>
                      <td className="p-3 font-mono font-bold text-rose-600">{t.ticketNumber}</td>
                      <td className="p-3 font-medium">{t.customerName}</td>
                      <td className="p-3 font-bold">{formatCurrency(t.price)}</td>
                      <td className="p-3 text-slate-600">
                        {t.cancelledAt ? new Date(t.cancelledAt).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="p-3 text-slate-700 italic">{t.cancelReason || 'Não informado'}</td>
                      <td className="p-3 text-slate-500">{t.cancelledByUserName || 'Admin'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. POR VENDEDOR */}
      {activeReportType === 'seller' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Desempenho e Comissões de Vendedores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Vendedor</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3 text-center">Taxa (%)</th>
                  <th className="p-3 text-center">Ingressos Vendidos</th>
                  <th className="p-3">Total Faturado</th>
                  <th className="p-3 font-bold text-indigo-900">Comissão a Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sellerStats.map(item => (
                  <tr key={item.seller.id}>
                    <td className="p-3 font-bold text-slate-900">{item.seller.name}</td>
                    <td className="p-3 text-slate-500">{item.seller.email}</td>
                    <td className="p-3 text-center">{item.seller.commissionRate || 0}%</td>
                    <td className="p-3 text-center font-bold">{item.ticketsCount}</td>
                    <td className="p-3 font-bold text-emerald-700">{formatCurrency(item.totalAmount)}</td>
                    <td className="p-3 font-black text-indigo-700">{formatCurrency(item.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
