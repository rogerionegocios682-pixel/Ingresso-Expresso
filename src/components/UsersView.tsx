import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Percent,
  DollarSign,
  Ticket,
  Lock,
  Unlock,
  Edit2,
  X,
  UserCheck
} from 'lucide-react';
import { User, UserRole } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../services/whatsapp';

interface UsersViewProps {
  currentUser: User;
}

export const UsersView: React.FC<UsersViewProps> = ({ currentUser }) => {
  const companyId = StorageService.getCurrentCompanyId();
  const [users, setUsers] = useState<User[]>(() =>
    StorageService.getUsers(currentUser.role === 'MASTER' ? undefined : companyId)
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'SELLER' as UserRole,
    commissionRate: 5, // 5%
    active: true
  });

  const refreshUsers = () => {
    setUsers(StorageService.getUsers(currentUser.role === 'MASTER' ? undefined : companyId));
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'SELLER',
      commissionRate: 5,
      active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      commissionRate: u.commissionRate || 0,
      active: u.active
    });
    setIsModalOpen(true);
  };

  const handleToggleActive = (user: User) => {
    StorageService.updateUser(user.id, { active: !user.active });
    refreshUsers();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      StorageService.updateUser(editingUser.id, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        commissionRate: Number(formData.commissionRate),
        status: formData.active ? 'active' : 'inactive',
        active: formData.active
      });
    } else {
      StorageService.saveUser({
        companyId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        commissionRate: Number(formData.commissionRate),
        status: formData.active ? 'active' : 'inactive',
        active: formData.active
      });
    }

    setIsModalOpen(false);
    refreshUsers();
  };

  // Get sales data for sellers
  const allSales = StorageService.getSales(currentUser.role === 'MASTER' ? undefined : companyId).filter(
    s => s.status === 'completed'
  );

  const getSellerStats = (sellerId: string, rate: number = 0) => {
    const sellerSales = allSales.filter(s => s.sellerId === sellerId);
    const count = sellerSales.reduce((a, b) => a + b.quantity, 0);
    const total = sellerSales.reduce((a, b) => a + b.totalAmount, 0);
    const commission = (total * rate) / 100;
    return { count, total, commission };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Usuários & Vendedores</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Controle de perfis de acesso, comissões de vendedores e operadores de portaria
          </p>
        </div>

        {(currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário / Vendedor
          </button>
        )}
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => {
          const stats = getSellerStats(user.id, user.commissionRate);

          return (
            <div
              key={user.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                !user.active ? 'opacity-60 border-slate-200 bg-slate-50' : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{user.name}</h3>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    {user.phone && <p className="text-xs text-slate-400">{user.phone}</p>}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      user.role === 'MASTER'
                        ? 'bg-purple-100 text-purple-800'
                        : user.role === 'ADMIN'
                        ? 'bg-blue-100 text-blue-800'
                        : user.role === 'SELLER'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {user.role === 'MASTER'
                      ? 'Super Admin'
                      : user.role === 'ADMIN'
                      ? 'Administrador'
                      : user.role === 'SELLER'
                      ? 'Vendedor'
                      : 'Portaria'}
                  </span>
                </div>

                {/* Seller Metrics as requested in #18 */}
                {user.role === 'SELLER' && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-indigo-600" /> Taxa de Comissão:
                      </span>
                      <strong className="font-bold text-slate-900">{user.commissionRate || 0}%</strong>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5 text-blue-600" /> Ingressos Vendidos:
                      </span>
                      <strong className="font-bold text-slate-900">{stats.count} un.</strong>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Total Faturado:
                      </span>
                      <strong className="font-bold text-emerald-700">{formatCurrency(stats.total)}</strong>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold">
                      <span className="text-indigo-950">Comissão a Pagar:</span>
                      <span className="text-sm font-black text-indigo-600">
                        {formatCurrency(stats.commission)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {(currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleToggleActive(user)}
                    className={`flex items-center gap-1 font-semibold ${
                      user.active ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'
                    }`}
                  >
                    {user.active ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Bloquear
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Reativar
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(user)}
                    className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Create / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário / Vendedor'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do colaborador"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Login *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@empresa.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp / Telefone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nível de Acesso *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {currentUser.role === 'MASTER' && <option value="MASTER">Super Admin</option>}
                    <option value="ADMIN">Administrador</option>
                    <option value="SELLER">Vendedor (PDV)</option>
                    <option value="DOORMAN">Portaria (Check-in)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Comissão (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.commissionRate}
                    onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                    disabled={formData.role !== 'SELLER'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:opacity-50"
                  />
                </div>
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
                  {editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
