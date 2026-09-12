import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Ticket,
  DollarSign,
  UserCheck,
  Users,
  AlertOctagon,
  TrendingUp,
  CreditCard,
  Clock,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { User, Event } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../services/whatsapp';

interface DashboardViewProps {
  currentUser: User;
  onSelectEvent?: (eventId: string) => void;
  onNavigateToPOS?: () => void;
  onNavigateToCheckIn?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onSelectEvent,
  onNavigateToPOS,
  onNavigateToCheckIn
}) => {
  const companyId = StorageService.getCurrentCompanyId();
  const events = StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  const stats = useMemo(() => {
    return StorageService.getDashboardStats(
      currentUser.role === 'MASTER' ? undefined : companyId,
      selectedEventId === 'all' ? undefined : selectedEventId
    );
  }, [companyId, currentUser.role, selectedEventId]);

  const sales = useMemo(() => {
    return StorageService.getSales(
      currentUser.role === 'MASTER' ? undefined : companyId,
      selectedEventId === 'all' ? undefined : selectedEventId
    ).filter(s => s.status === 'completed');
  }, [companyId, currentUser.role, selectedEventId]);

  const tickets = useMemo(() => {
    return StorageService.getTickets(
      currentUser.role === 'MASTER' ? undefined : companyId,
      selectedEventId === 'all' ? undefined : selectedEventId
    );
  }, [companyId, currentUser.role, selectedEventId]);

  // Payment Methods Breakdown
  const paymentBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    sales.forEach(sale => {
      const pm = sale.paymentMethod;
      if (!counts[pm]) counts[pm] = { count: 0, total: 0 };
      counts[pm].count += sale.quantity;
      counts[pm].total += sale.totalAmount;
    });
    return Object.entries(counts).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total
    }));
  }, [sales]);

  // Sales by Event Breakdown
  const salesByEvent = useMemo(() => {
    const map: Record<string, { name: string; ticketsSold: number; totalRevenue: number }> = {};
    sales.forEach(sale => {
      if (!map[sale.eventId]) {
        map[sale.eventId] = { name: sale.eventName, ticketsSold: 0, totalRevenue: 0 };
      }
      map[sale.eventId].ticketsSold += sale.quantity;
      map[sale.eventId].totalRevenue += sale.totalAmount;
    });
    return Object.values(map);
  }, [sales]);

  // Check-ins by Hour Breakdown
  const checkinsByHour = useMemo(() => {
    const hoursMap: Record<string, number> = {
      '14h-16h': 0,
      '16h-18h': 0,
      '18h-20h': 0,
      '20h-22h': 0,
      '22h-00h': 0
    };
    tickets
      .filter(t => t.status === 'used' && t.usedAt)
      .forEach(t => {
        const d = new Date(t.usedAt!);
        const h = d.getHours();
        if (h >= 14 && h < 16) hoursMap['14h-16h']++;
        else if (h >= 16 && h < 18) hoursMap['16h-18h']++;
        else if (h >= 18 && h < 20) hoursMap['18h-20h']++;
        else if (h >= 20 && h < 22) hoursMap['20h-22h']++;
        else hoursMap['22h-00h']++;
      });
    return Object.entries(hoursMap).map(([hour, count]) => ({ hour, count }));
  }, [tickets]);

  // Tickets by Type
  const ticketsByType = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => {
      if (t.status !== 'cancelled') {
        map[t.ticketTypeName] = (map[t.ticketTypeName] || 0) + 1;
      }
    });
    return Object.entries(map).map(([type, count]) => ({ type, count }));
  }, [tickets]);

  return (
    <div className="space-y-6">
      {/* Top Controls & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Painel em Tempo Real</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitoramento de vendas, faturamento e fluxo de acessos na portaria
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os Eventos</option>
            {events.map(evt => (
              <option key={evt.id} value={evt.id}>
                {evt.name}
              </option>
            ))}
          </select>

          {onNavigateToPOS && (
            <button
              onClick={onNavigateToPOS}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              + Nova Venda PDV
            </button>
          )}

          {onNavigateToCheckIn && (
            <button
              onClick={onNavigateToCheckIn}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              Portaria Check-in
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards as requested in #15 */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Eventos Ativos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Eventos Ativos</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.activeEventsCount}</p>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" /> Eventos em andamento
          </span>
        </div>

        {/* Card 2: Ingressos Vendidos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ingressos Vendidos</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalTicketsSold}</p>
          <span className="text-[11px] text-slate-500 font-medium">
            Disponíveis: <strong className="text-slate-700">{stats.totalTicketsAvailable}</strong>
          </span>
        </div>

        {/* Card 3: Valor Vendido */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Faturamento Bruto</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700">{formatCurrency(stats.totalRevenue)}</p>
          <span className="text-[11px] text-emerald-600 font-medium">
            Em {sales.length} vendas registradas
          </span>
        </div>

        {/* Card 4: Check-ins Realizados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Check-ins Realizados</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.checkInsCompleted}</p>
          <span className="text-[11px] text-slate-500 font-medium">
            Aguardando entrada: <strong className="text-amber-600">{stats.peopleWaiting}</strong>
          </span>
        </div>
      </div>

      {/* Secondary Row of Cards: Waiting count & Cancelled tickets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs uppercase font-semibold text-indigo-300">Pessoas Aguardando Entrada</span>
            <p className="text-3xl font-black">{stats.peopleWaiting}</p>
            <p className="text-xs text-slate-300">Ingressos já emitidos que ainda não passaram pela catraca/portaria</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-indigo-300" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs uppercase font-semibold text-slate-500">Ingressos Cancelados</span>
            <p className="text-3xl font-black text-rose-600">{stats.cancelledCount}</p>
            <p className="text-xs text-slate-500">Bloqueados para entrada e expurgados do total faturado</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6 text-rose-600" />
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Vendas por Forma de Pagamento */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              Formas de Pagamento
            </h3>
            <span className="text-xs text-slate-400">Volume financeiro</span>
          </div>

          <div className="space-y-3">
            {paymentBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma venda concluída ainda.</p>
            ) : (
              paymentBreakdown.map(item => {
                const percent = stats.totalRevenue > 0 ? (item.total / stats.totalRevenue) * 100 : 0;
                return (
                  <div key={item.method} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold uppercase text-slate-700">
                        {item.method} ({item.count} ingressos)
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(item.total)} ({percent.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 2: Vendas por Tipo de Ingresso */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-600" />
              Vendas por Tipo de Ingresso
            </h3>
            <span className="text-xs text-slate-400">Ingressos emitidos</span>
          </div>

          <div className="space-y-3">
            {ticketsByType.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Sem ingressos registrados.</p>
            ) : (
              ticketsByType.map(item => {
                const percent = stats.totalTicketsSold > 0 ? (item.count / stats.totalTicketsSold) * 100 : 0;
                return (
                  <div key={item.type} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700">{item.type}</span>
                      <span className="font-bold text-slate-900">
                        {item.count} un. ({percent.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 3: Vendas por Evento */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Vendas por Evento
            </h3>
            <span className="text-xs text-slate-400">Receita por evento</span>
          </div>

          <div className="space-y-3">
            {salesByEvent.map(evt => {
              const percent = stats.totalRevenue > 0 ? (evt.totalRevenue / stats.totalRevenue) * 100 : 0;
              return (
                <div key={evt.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">{evt.name}</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(evt.totalRevenue)} ({evt.ticketsSold} un.)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 4: Check-ins por Horário */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Check-ins por Horário de Entrada
            </h3>
            <span className="text-xs text-slate-400">Fluxo na portaria</span>
          </div>

          <div className="grid grid-cols-5 gap-2 pt-2">
            {checkinsByHour.map(hourItem => {
              const maxCount = Math.max(...checkinsByHour.map(h => h.count), 1);
              const heightPercent = Math.max(15, (hourItem.count / maxCount) * 100);

              return (
                <div key={hourItem.hour} className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-900">{hourItem.count}</span>
                  <div className="w-full h-24 bg-slate-100 rounded-lg flex items-end p-1">
                    <div
                      className="w-full bg-amber-500 hover:bg-amber-600 rounded-md transition-all duration-300"
                      style={{ height: `${heightPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">{hourItem.hour}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Events Quick List */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            Visão Rápida dos Eventos
          </h3>
          <span className="text-xs text-slate-400">{events.length} eventos cadastrados</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {events.map(event => {
            const eventBatches = StorageService.getBatches(undefined, event.id);
            const totalStock = eventBatches.reduce((a, b) => a + b.totalQuantity, 0);
            const soldStock = eventBatches.reduce((a, b) => a + b.soldQuantity, 0);
            const percentSold = totalStock > 0 ? (soldStock / totalStock) * 100 : 0;

            return (
              <div
                key={event.id}
                onClick={() => onSelectEvent && onSelectEvent(event.id)}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <img
                      src={event.coverImage}
                      alt={event.name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{event.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(event.date)} • {event.startTime}h</p>
                      <p className="text-xs text-slate-400 truncate">{event.venue}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/70 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Ocupação / Vendas</span>
                    <span className="font-bold text-slate-900">{soldStock} / {totalStock} ({percentSold.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${percentSold}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
