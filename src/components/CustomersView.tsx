import React, { useState } from 'react';
import {
  Users,
  Search,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Ticket,
  Send,
  UserPlus,
  X
} from 'lucide-react';
import { Customer, User } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../services/whatsapp';

interface CustomersViewProps {
  currentUser: User;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ currentUser }) => {
  if (currentUser.role !== 'MASTER' && currentUser.role !== 'ADMIN') {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center space-y-3">
        <p className="text-rose-600 font-bold">Acesso restrito à administração da plataforma.</p>
      </div>
    );
  }

  const companyId = StorageService.getCurrentCompanyId();
  const [customers, setCustomers] = useState<Customer[]>(() =>
    StorageService.getCustomers(currentUser.role === 'MASTER' ? undefined : companyId)
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    cpf: ''
  });

  const filteredCustomers = customers.filter(c => {
    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.cpf && c.cpf.includes(searchTerm))
    );
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.upsertCustomer({
      companyId,
      name: formData.name,
      phone: formData.phone,
      whatsapp: formData.whatsapp || formData.phone.replace(/[^0-9]/g, ''),
      email: formData.email,
      cpf: formData.cpf || undefined,
      amount: 0,
      ticketCount: 0
    });
    setCustomers(StorageService.getCustomers(currentUser.role === 'MASTER' ? undefined : companyId));
    setIsModalOpen(false);
    setFormData({ name: '', phone: '', whatsapp: '', email: '', cpf: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Base de Clientes</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Histórico completo de compras, tickets adquiridos e contato direto via WhatsApp
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, CPF, e-mail..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(customer => {
          const cleanPhone = customer.whatsapp || customer.phone.replace(/[^0-9]/g, '');

          return (
            <div
              key={customer.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{customer.name}</h3>
                    {customer.cpf && (
                      <span className="text-xs text-slate-400 font-mono">CPF: {customer.cpf}</span>
                    )}
                  </div>
                  <a
                    href={`https://api.whatsapp.com/send?phone=55${cleanPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                    title="Conversar no WhatsApp"
                  >
                    <Send className="w-4 h-4" />
                  </a>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                </div>

                {/* History Stats matching requirement #17 */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold block">Total Gasto</span>
                    <strong className="text-emerald-700 font-black text-sm">
                      {formatCurrency(customer.totalSpent)}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold block">Ingressos</span>
                    <strong className="text-indigo-700 font-black text-sm">
                      {customer.totalTickets} un.
                    </strong>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-300" />
                <span>Última compra: {customer.lastPurchaseDate || 'Sem registros'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: New Customer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">Novo Cliente</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do cliente"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp / Telefone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CPF (Opcional)</label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail (Opcional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@email.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
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
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
