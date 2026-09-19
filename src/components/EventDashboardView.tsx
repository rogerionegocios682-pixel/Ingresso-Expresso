import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  DollarSign,
  UserCheck,
  Users,
  ChevronLeft,
  ShoppingCart,
  QrCode,
  Layers,
  ArrowRight,
  Globe,
  Copy,
  Check,
  Share2,
  ExternalLink
} from 'lucide-react';
import { Event, User } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../services/whatsapp';

interface EventDashboardViewProps {
  eventId: string;
  currentUser: User;
  onBack: () => void;
  onNavigateToPOS: () => void;
  onNavigateToCheckIn: () => void;
  onNavigateToBatches: () => void;
  onOpenPublicPage?: (slugOrId: string) => void;
}

export const EventDashboardView: React.FC<EventDashboardViewProps> = ({
  eventId,
  currentUser,
  onBack,
  onNavigateToPOS,
  onNavigateToCheckIn,
  onNavigateToBatches,
  onOpenPublicPage
}) => {
  const event = StorageService.getEventById(eventId);
  const companyId = StorageService.getCurrentCompanyId();
  const [copiedLink, setCopiedLink] = useState(false);

  if (!event) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-600 mb-4">Evento não encontrado.</p>
        <button onClick={onBack} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold">
          Voltar
        </button>
      </div>
    );
  }

  const stats = StorageService.getDashboardStats(companyId, eventId);
  const batches = StorageService.getBatches(companyId, eventId);
  const tickets = StorageService.getTickets(companyId, eventId);
  const sales = StorageService.getSales(companyId, eventId).filter(s => s.status === 'completed');

  // Check-ins by hour
  const checkinsByHour: Record<string, number> = {
    '15h-17h': 0,
    '17h-19h': 0,
    '19h-21h': 0,
    '21h-23h': 0,
    '23h+': 0
  };

  tickets.filter(t => t.status === 'used' && t.usedAt).forEach(t => {
    const h = new Date(t.usedAt!).getHours();
    if (h >= 15 && h < 17) checkinsByHour['15h-17h']++;
    else if (h >= 17 && h < 19) checkinsByHour['17h-19h']++;
    else if (h >= 19 && h < 21) checkinsByHour['19h-21h']++;
    else if (h >= 21 && h < 23) checkinsByHour['21h-23h']++;
    else checkinsByHour['23h+']++;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para Lista de Eventos
      </button>

      {/* Header Banner matching requirement #32 */}
      <div className="relative bg-slate-900 text-white rounded-2xl overflow-hidden shadow-md">
        <div className="absolute inset-0 opacity-25">
          <img src={event.coverImage} alt={event.name} className="w-full h-full object-cover" />
        </div>
        <div className="relative p-6 sm:p-8 space-y-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 font-black uppercase">
              {event.status === 'active' ? 'Evento Ativo' : event.status}
            </span>
            <span className="text-slate-300">Organizador: {event.organizerName}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{event.name}</h1>

          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-200 font-medium pt-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              {formatDate(event.date)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              {event.startTime}h às {event.endTime}h
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-400" />
              {event.venue} ({event.address}, {event.city} - {event.state})
            </span>
          </div>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={onNavigateToPOS}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              Vender Ingressos no PDV
            </button>
            <button
              onClick={onNavigateToCheckIn}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              Check-in da Portaria
            </button>
            <button
              onClick={onNavigateToBatches}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              Gerenciar Lotes
            </button>
          </div>
        </div>
      </div>

      {/* Seção Exclusiva: LINK PÚBLICO DO EVENTO (Requisito #14) */}
      <div className="bg-white rounded-2xl border border-indigo-200/80 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                Link Público Exclusivo do Evento
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase">
                  Página Comercial
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Divulgue este link no WhatsApp, Instagram e redes sociais. Seus clientes compram ingressos diretamente sem acesso ao painel admin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
            <button
              type="button"
              onClick={() => {
                const url = StorageService.getPublicEventUrl(event);
                navigator.clipboard.writeText(url);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2500);
              }}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
            </button>

            <button
              type="button"
              onClick={() => {
                const url = StorageService.getPublicEventUrl(event);
                const text = `Ingressos disponíveis para *${event.name}*!\n\nGaranta seu ingresso pelo link oficial:\n${url}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors cursor-pointer border border-emerald-200"
            >
              <Share2 className="w-3.5 h-3.5" /> Divulgar WhatsApp
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenPublicPage) {
                  onOpenPublicPage(event.slug || event.id);
                } else {
                  const url = StorageService.getPublicEventUrl(event);
                  window.open(url, '_blank');
                }
              }}
              className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Abrir Página
            </button>
          </div>
        </div>

        {/* Display URL in Monospace Box */}
        <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 select-all overflow-x-auto">
          <span className="text-indigo-600 font-bold select-none">URL:</span>
          <span className="truncate">{StorageService.getPublicEventUrl(event)}</span>
        </div>
      </div>

      {/* Cards requested in #32:
          🎟️ Ingressos vendidos
          🎫 Disponíveis
          💰 Faturamento
          📲 Check-ins
          👥 Pessoas aguardando entrada */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vendidos</span>
            <span className="text-base">🎟️</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalTicketsSold}</p>
          <span className="text-[10px] text-slate-500">Ingressos emitidos</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Disponíveis</span>
            <span className="text-base">🎫</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalTicketsAvailable}</p>
          <span className="text-[10px] text-slate-500">Em estoque nos lotes</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Faturamento</span>
            <span className="text-base">💰</span>
          </div>
          <p className="text-xl font-black text-emerald-700 truncate">{formatCurrency(stats.totalRevenue)}</p>
          <span className="text-[10px] text-slate-500">Total arrecadado</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Check-ins</span>
            <span className="text-base">📲</span>
          </div>
          <p className="text-2xl font-black text-teal-700">{stats.checkInsCompleted}</p>
          <span className="text-[10px] text-slate-500">Entradas liberadas</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Aguardando</span>
            <span className="text-base">👥</span>
          </div>
          <p className="text-2xl font-black text-indigo-700">{stats.peopleWaiting}</p>
          <span className="text-[10px] text-slate-500">Pessoas a entrar</span>
        </div>
      </div>

      {/* Graphs for Event as requested in #32 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lotes & Vendas Progress */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-indigo-600" />
              Desempenho por Lote de Ingressos
            </h3>
            <span className="text-xs text-slate-400">{batches.length} lotes</span>
          </div>

          <div className="space-y-4">
            {batches.map(batch => {
              const available = batch.totalQuantity - batch.soldQuantity;
              const percent = batch.totalQuantity > 0 ? (batch.soldQuantity / batch.totalQuantity) * 100 : 0;

              return (
                <div key={batch.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{batch.ticketTypeName}</span>
                      <span className="text-slate-500 ml-2">({batch.name})</span>
                    </div>
                    <span className="font-black text-slate-900">
                      {batch.price === 0 ? 'Cortesia' : formatCurrency(batch.price)}
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${percent >= 100 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Vendidos: <strong>{batch.soldQuantity}</strong> ({percent.toFixed(0)}%)</span>
                    <span>Restam: <strong>{available}</strong> un.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Check-ins by Hour Graph */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              Fluxo de Check-in na Portaria
            </h3>
            <span className="text-xs text-slate-400">Tempo real</span>
          </div>

          <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2">
            {Object.entries(checkinsByHour).map(([slot, count]) => {
              const max = Math.max(...Object.values(checkinsByHour), 1);
              const height = Math.max(15, (count / max) * 100);

              return (
                <div key={slot} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-xs font-bold text-slate-800">{count}</span>
                  <div className="w-full bg-slate-100 rounded-lg p-1 flex items-end h-32">
                    <div
                      className="w-full bg-teal-500 hover:bg-teal-600 rounded-md transition-all duration-300"
                      style={{ height: `${height}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">{slot}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
