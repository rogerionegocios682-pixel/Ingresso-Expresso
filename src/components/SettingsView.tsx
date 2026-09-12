import React, { useState } from 'react';
import {
  Settings,
  Building2,
  QrCode,
  Printer,
  MessageSquare,
  ShieldCheck,
  Save,
  CheckCircle2,
  RefreshCw,
  Database
} from 'lucide-react';
import { Company, User } from '../types';
import { StorageService } from '../services/storage';

interface SettingsViewProps {
  currentUser: User;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser }) => {
  if (currentUser.role !== 'MASTER' && currentUser.role !== 'ADMIN') {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center space-y-3">
        <p className="text-rose-600 font-bold">Acesso restrito à administração da plataforma.</p>
      </div>
    );
  }

  const company = StorageService.getCurrentCompany();
  const allCompanies = StorageService.getCompanies();

  const [formData, setFormData] = useState<Company>({ ...company });
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveCompany(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleSwitchCompany = (compId: string) => {
    StorageService.setCurrentCompanyId(compId);
    const updated = StorageService.getCurrentCompany();
    setFormData({ ...updated });
    window.location.reload();
  };

  const handleResetData = () => {
    if (confirm('Atenção: Deseja realmente restaurar os dados de demonstração iniciais? Suas alterações serão redefinidas.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Configurações do Sistema</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Dados da empresa, dados bancários para Pix, padrões de mensagem WhatsApp e impressora
          </p>
        </div>

        {currentUser.role === 'MASTER' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-200">
              Super Admin Multiempresa
            </span>
          </div>
        )}
      </div>

      {/* Multi-company Switcher (for demonstration & Master role) */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm sm:text-base">Empresa Ativa no Sistema: {company.name}</h3>
          </div>
          <p className="text-xs text-slate-300">
            CNPJ: {company.docNumber} • Ambiente Multiempresa com isolamento estrito de dados
          </p>
        </div>

        {allCompanies.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300">Alternar:</span>
            <select
              value={company.id}
              onChange={e => handleSwitchCompany(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold border border-white/20 focus:ring-2 focus:ring-indigo-400"
            >
              {allCompanies.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isSaved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Configurações salvas com sucesso!
        </div>
      )}

      {/* Form matching requirement #5:
          Logo do sistema, Nome da empresa, CNPJ, Telefone, WhatsApp, E-mail de suporte, Chave Pix padrão, Nome titular, Banco */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Dados da Empresa */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold uppercase text-indigo-600 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Dados Cadastrais da Empresa
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Empresa / Fantasia *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ / CPF *</label>
              <input
                type="text"
                required
                value={formData.docNumber}
                onChange={e => setFormData({ ...formData, docNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone Fixo / Comercial</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp de Atendimento *</label>
              <input
                type="text"
                required
                value={formData.whatsapp}
                onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Suporte *</label>
              <input
                type="email"
                required
                value={formData.supportEmail}
                onChange={e => setFormData({ ...formData, supportEmail: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Chave Pix Padrão da Empresa */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold uppercase text-emerald-600 flex items-center gap-2">
            <QrCode className="w-4 h-4" /> Chave Pix Padrão para Recebimento no PDV
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Chave Pix</label>
              <select
                value={formData.pixKeyType}
                onChange={e => setFormData({ ...formData, pixKeyType: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave Aleatória</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chave Pix *</label>
              <input
                type="text"
                required
                value={formData.pixKey}
                onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Titular da Conta</label>
              <input
                type="text"
                value={formData.pixRecipientName}
                onChange={e => setFormData({ ...formData, pixRecipientName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Instituição Bancária</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Padrões de Impressão e WhatsApp */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold uppercase text-slate-700 flex items-center gap-2">
            <Printer className="w-4 h-4" /> Impressão e Mensagens
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Formato de Impressão Padrão</label>
              <select
                value={formData.printFormat}
                onChange={e => setFormData({ ...formData, printFormat: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="thermal80">Impressora Térmica 80mm (Padrão PDV)</option>
                <option value="thermal58">Impressora Térmica 58mm (Bobina estreita)</option>
                <option value="a4">Folha A4 / PDF Completo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Logotipo / URL do Ícone</label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleResetData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Restaurar Dados Demo
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Salvar Configurações
          </button>
        </div>
      </form>
    </div>
  );
};
