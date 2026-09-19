import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
  ArrowRight,
  Ticket,
  HelpCircle,
  MessageCircle,
  Sparkles,
  Compass,
  AlertTriangle
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { Event, User } from '../types';
import { formatDate } from '../services/whatsapp';

interface EventNotFound404ViewProps {
  attemptedSlug?: string | null;
  currentUser?: User | null;
  onSelectEvent?: (slugOrId: string) => void;
  onBackToAdmin?: () => void;
}

export const EventNotFound404View: React.FC<EventNotFound404ViewProps> = ({
  attemptedSlug,
  currentUser,
  onSelectEvent,
  onBackToAdmin
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [allEvents, setAllEvents] = useState<Event[]>(() => StorageService.getEvents());

  useEffect(() => {
    const unsubscribe = StorageService.subscribe(() => {
      setAllEvents(StorageService.getEvents());
    });
    return () => unsubscribe();
  }, []);

  // Get active public events to suggest to the visitor
  const activeEvents = useMemo(() => {
    return allEvents.filter(e => e.status === 'active');
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return activeEvents;
    const q = searchQuery.toLowerCase().trim();
    return activeEvents.filter(e => {
      const nameMatch = e.name.toLowerCase().includes(q);
      const venueMatch = e.venue.toLowerCase().includes(q);
      const cityMatch = e.city.toLowerCase().includes(q);
      const attractionMatch = (e.attractions || []).some(a => a.toLowerCase().includes(q));
      return nameMatch || venueMatch || cityMatch || attractionMatch;
    });
  }, [activeEvents, searchQuery]);

  const handleNavigateToEvent = (event: Event) => {
    const slug = event.slug || event.id;
    if (onSelectEvent) {
      onSelectEvent(slug);
    } else {
      window.location.href = `/evento/${slug}`;
    }
  };

  const handleContactWhatsApp = () => {
    const attempted = attemptedSlug ? ` (link acessado: ${attemptedSlug})` : '';
    const text = `Olá! Tentei acessar a página de um evento pelo link oficial${attempted}, mas a página informou que não foi encontrada. Poderiam me ajudar com o link correto?`;
    window.open(`https://api.whatsapp.com/send?phone=5511987654321&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else if (onBackToAdmin && currentUser) {
      onBackToAdmin();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-black text-sm">
            <Ticket className="w-4 h-4" />
          </div>
          <span className="font-black text-sm tracking-tight text-white">
            Portal de Ingressos Oficiais
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentUser && onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-indigo-600/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Painel do Organizador
            </button>
          )}

          <button
            onClick={handleGoBack}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
        </div>
      </header>

      {/* Main 404 Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
        {/* 404 Card Container */}
        <div className="relative rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/90 p-8 sm:p-12 text-center space-y-6 shadow-2xl overflow-hidden">
          {/* Subtle Ambient Light Effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full"></div>

          {/* 404 Badge & Graphic */}
          <div className="relative space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black tracking-wider uppercase">
              <AlertTriangle className="w-4 h-4" />
              Erro 404 • Página de Evento Inexistente
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Evento Não Encontrado
            </h1>

            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
              O link que você tentou acessar não corresponde a nenhum evento ativo no sistema.
              Ele pode ter sido alterado, encerrado ou o endereço digitado pode conter erros.
            </p>

            {/* Display Attempted Slug if provided */}
            {attemptedSlug && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono max-w-full overflow-x-auto">
                <span className="text-slate-500 select-none">Link acessado:</span>
                <span className="text-rose-400 font-bold break-all">
                  /evento/{attemptedSlug}
                </span>
              </div>
            )}
          </div>

          {/* Action Hub */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleGoBack}
              className="py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Retornar à Página Anterior
            </button>

            <button
              onClick={handleContactWhatsApp}
              className="py-3 px-6 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              Solicitar Link pelo WhatsApp
            </button>
          </div>
        </div>

        {/* Suggested Active Events Section */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Eventos Oficiais Disponíveis Agora
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Confira os eventos com vendas abertas e garanta seus ingressos oficiais
              </p>
            </div>

            {/* Live Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar evento ou local..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Grid of Events */}
          {filteredEvents.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 space-y-2">
              <Compass className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-300">Nenhum evento encontrado para "{searchQuery}".</p>
              <p className="text-slate-500">Tente buscar por outro termo ou limpe o campo de busca.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEvents.map(evt => (
                <div
                  key={evt.id}
                  onClick={() => handleNavigateToEvent(evt)}
                  className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Cover Art */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-800">
                      <img
                        src={evt.coverImage}
                        alt={evt.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute top-2.5 right-2.5">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-slate-950 font-black text-[10px] uppercase tracking-wider backdrop-blur-xs">
                          Vendas Abertas
                        </span>
                      </div>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-4 space-y-2.5">
                      <h3 className="font-black text-sm text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {evt.name}
                      </h3>

                      <div className="space-y-1 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{formatDate(evt.date)}</span>
                          <span className="text-slate-600">•</span>
                          <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{evt.startTime}h</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{evt.venue} ({evt.city}-{evt.state})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action */}
                  <div className="p-4 pt-0">
                    <button
                      type="button"
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-800 group-hover:bg-indigo-600 text-slate-200 group-hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Ver Ingressos e Lotes</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Security & Organization Notice */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>
              Todos os ingressos comercializados nesta plataforma contam com validação antifraude e QR Code criptografado.
            </span>
          </div>
          <button
            onClick={handleContactWhatsApp}
            className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            Falar com a Central de Suporte <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500">
        Plataforma Oficial de Ingressos & Validação em Portaria • Todos os direitos reservados
      </footer>
    </div>
  );
};
