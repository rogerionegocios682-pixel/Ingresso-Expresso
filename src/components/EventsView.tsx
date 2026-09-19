import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  Search,
  Filter,
  Users,
  CheckCircle2,
  X,
  Layers,
  ArrowRight,
  Globe,
  Copy,
  Check,
  Share2,
  Sparkles
} from 'lucide-react';
import { Event, EventStatus, User } from '../types';
import { StorageService } from '../services/storage';
import { formatDate } from '../services/whatsapp';

interface EventsViewProps {
  currentUser: User;
  onSelectEvent: (eventId: string) => void;
  onManageBatches: (eventId: string) => void;
  onOpenPOS: (eventId: string) => void;
  onOpenPublicPage?: (slugOrId: string) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  currentUser,
  onSelectEvent,
  onManageBatches,
  onOpenPOS,
  onOpenPublicPage
}) => {
  if (currentUser.role !== 'MASTER' && currentUser.role !== 'ADMIN') {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center space-y-3">
        <p className="text-rose-600 font-bold">Acesso restrito à administração da plataforma.</p>
      </div>
    );
  }

  const companyId = StorageService.getCurrentCompanyId();
  const [events, setEvents] = useState<Event[]>(() =>
    StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId)
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    coverImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1000&auto=format&fit=crop&q=80',
    bannerImage: '',
    slug: '',
    attractionsStr: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '19:00',
    endTime: '23:30',
    venue: '',
    address: '',
    city: 'São Paulo',
    state: 'SP',
    organizerName: '',
    docNumber: '',
    phone: '',
    whatsapp: '',
    email: '',
    status: 'active' as EventStatus
  });

  const refreshEvents = () => {
    setEvents(StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId));
  };

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setFormData({
      name: '',
      description: '',
      coverImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1000&auto=format&fit=crop&q=80',
      bannerImage: '',
      slug: '',
      attractionsStr: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '19:00',
      endTime: '23:30',
      venue: '',
      address: '',
      city: 'São Paulo',
      state: 'SP',
      organizerName: 'Organização do Evento',
      docNumber: '',
      phone: '',
      whatsapp: '',
      email: '',
      status: 'active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (evt: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(evt);
    setFormData({
      name: evt.name,
      description: evt.description,
      coverImage: evt.coverImage,
      bannerImage: evt.bannerImage || '',
      slug: evt.slug || '',
      attractionsStr: (evt.attractions || []).join(', '),
      date: evt.date,
      startTime: evt.startTime,
      endTime: evt.endTime,
      venue: evt.venue,
      address: evt.address,
      city: evt.city,
      state: evt.state,
      organizerName: evt.organizerName,
      docNumber: evt.docNumber,
      phone: evt.phone,
      whatsapp: evt.whatsapp,
      email: evt.email,
      status: evt.status
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const attractions = formData.attractionsStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      name: formData.name,
      description: formData.description,
      coverImage: formData.coverImage,
      bannerImage: formData.bannerImage || undefined,
      slug: formData.slug.trim() || undefined,
      attractions,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      venue: formData.venue,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      organizerName: formData.organizerName,
      docNumber: formData.docNumber,
      phone: formData.phone,
      whatsapp: formData.whatsapp,
      email: formData.email,
      status: formData.status
    };

    if (editingEvent) {
      StorageService.updateEvent(editingEvent.id, payload);
    } else {
      const newEvt = StorageService.saveEvent({
        ...payload,
        companyId
      });
      // Also automatically create 2 initial default batches for convenient immediate selling
      StorageService.saveBatch({
        companyId,
        eventId: newEvt.id,
        name: '1º Lote',
        ticketTypeName: 'Pista Geral',
        price: 80.0,
        totalQuantity: 100,
        startDate: formData.date,
        endDate: formData.date,
        status: 'active'
      });
      StorageService.saveBatch({
        companyId,
        eventId: newEvt.id,
        name: 'Lote Promocional',
        ticketTypeName: 'VIP',
        price: 150.0,
        totalQuantity: 50,
        startDate: formData.date,
        endDate: formData.date,
        status: 'active'
      });
    }

    setIsModalOpen(false);
    refreshEvents();
  };

  const filteredEvents = events.filter(evt => {
    const matchesSearch =
      evt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || evt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Eventos</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Cadastre e gerencie seus eventos, vendas, lotes e portaria
          </p>
        </div>

        {(currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            NOVO EVENTO
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar evento por nome, local..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativo</option>
            <option value="draft">Rascunho</option>
            <option value="finished">Encerrado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredEvents.map(evt => {
          const batches = StorageService.getBatches(undefined, evt.id);
          const totalStock = batches.reduce((a, b) => a + b.totalQuantity, 0);
          const soldStock = batches.reduce((a, b) => a + b.soldQuantity, 0);

          return (
            <div
              key={evt.id}
              onClick={() => onSelectEvent(evt.id)}
              className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={evt.coverImage}
                    alt={evt.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        evt.status === 'active'
                          ? 'bg-emerald-600 text-white'
                          : evt.status === 'draft'
                          ? 'bg-slate-700 text-white'
                          : evt.status === 'finished'
                          ? 'bg-blue-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {evt.status === 'active'
                        ? 'Ativo'
                        : evt.status === 'draft'
                        ? 'Rascunho'
                        : evt.status === 'finished'
                        ? 'Encerrado'
                        : 'Cancelado'}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <h3 className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {evt.name}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatDate(evt.date)} • {evt.startTime}h às {evt.endTime}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{evt.venue} ({evt.city}-{evt.state})</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">{evt.description}</p>
                </div>
              </div>

              <div className="p-5 pt-0 space-y-3">
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>Vendas: <strong>{soldStock}</strong> / {totalStock}</span>
                  <span className="font-bold text-indigo-600">
                    {totalStock > 0 ? ((soldStock / totalStock) * 100).toFixed(0) : 0}% vendido
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onSelectEvent(evt.id);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                  >
                    Painel
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onManageBatches(evt.id);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Lotes
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onOpenPOS(evt.id);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors"
                  >
                    Vender
                  </button>
                </div>

                {/* Link Público do Evento (Requisito #14) */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      if (onOpenPublicPage) {
                        onOpenPublicPage(evt.slug || evt.id);
                      } else {
                        const url = StorageService.getPublicEventUrl(evt);
                        window.open(url, '_blank');
                      }
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    Página Comercial
                  </button>

                  <button
                    type="button"
                    title="Copiar Link Público"
                    onClick={e => {
                      e.stopPropagation();
                      const url = StorageService.getPublicEventUrl(evt);
                      navigator.clipboard.writeText(url);
                      setCopiedId(evt.id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedId === evt.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {copiedId === evt.id ? 'Copiado!' : 'Copiar'}
                    </span>
                  </button>
                </div>

                {(currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={e => handleOpenEdit(evt, e)}
                      className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Editar dados
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Cadastro / Edição de Evento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingEvent ? 'Editar Evento' : 'Novo Evento'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-indigo-600">Informações Principais</h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Evento *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Festival de Verão 2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição do Evento</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalhes, atrações, horários e informações para o público..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">URL da Imagem / Arte Oficial</label>
                  <input
                    type="url"
                    value={formData.coverImage}
                    onChange={e => setFormData({ ...formData, coverImage: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Atrações Confirmadas (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={formData.attractionsStr}
                    onChange={e => setFormData({ ...formData, attractionsStr: e.target.value })}
                    placeholder="Ex: Vintage Culture, Alok, Jorge & Mateus"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Link Amigável do Evento (Slug exclusivo)
                    </label>
                    <span className="text-[10px] text-slate-400">Opcional - gerado automaticamente se vazio</span>
                  </div>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="Ex: mega-festival-de-verao-2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-indigo-600 mt-1 font-mono">
                    URL pública: /evento/{formData.slug || (formData.name ? formData.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') : 'meu-evento')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Data *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hora de Início *</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hora de Término *</label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase text-indigo-600">Localização</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Local / Casa *</label>
                    <input
                      type="text"
                      required
                      value={formData.venue}
                      onChange={e => setFormData({ ...formData, venue: e.target.value })}
                      placeholder="Ex: Arena Parque das Nações"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Av. das Nações Unidas, 14200"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade *</label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      placeholder="São Paulo"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Estado (UF) *</label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      placeholder="SP"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Status do Evento</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as EventStatus })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="active">Ativo</option>
                      <option value="draft">Rascunho</option>
                      <option value="finished">Encerrado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase text-indigo-600">Dados do Organizador</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Organizador / Empresa</label>
                    <input
                      type="text"
                      value={formData.organizerName}
                      onChange={e => setFormData({ ...formData, organizerName: e.target.value })}
                      placeholder="Razão Social ou Nome Fantasia"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ ou CPF</label>
                    <input
                      type="text"
                      value={formData.docNumber}
                      onChange={e => setFormData({ ...formData, docNumber: e.target.value })}
                      placeholder="00.000.000/0001-00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp de Suporte</label>
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                      placeholder="(11) 98765-4321"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Contato</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contato@empresa.com.br"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-xs transition-colors"
                >
                  {editingEvent ? 'Salvar Alterações' : 'Criar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
