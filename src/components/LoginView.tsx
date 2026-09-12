import React, { useState } from 'react';
import { Ticket, Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { User, UserRole } from '../types';
import { StorageService } from '../services/storage';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const users = StorageService.getUsers();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.active);

    if (foundUser) {
      onLogin(foundUser);
    } else {
      // If user typed custom credentials, allow signing in as Admin if valid email
      if (email.includes('@')) {
        const tempUser: User = {
          id: 'user_custom',
          companyId: StorageService.getCurrentCompanyId(),
          name: email.split('@')[0],
          email: email.trim(),
          role: 'ADMIN',
          status: 'active',
          active: true,
          createdAt: new Date().toISOString()
        };
        onLogin(tempUser);
      } else {
        setError('E-mail ou senha incorretos.');
      }
    }
  };

  const handleQuickLogin = (role: UserRole) => {
    const userForRole = users.find(u => u.role === role);
    if (userForRole) {
      onLogin(userForRole);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Subtle background ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-2">
            <Ticket className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">INGRESSOS EVENTOS</h1>
          <p className="text-xs text-slate-400 font-medium">
            Plataforma Profissional de Venda, Emissão e Portaria
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              E-mail de Acesso
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden transition-all placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Senha
              </label>
              <button
                type="button"
                onClick={() => alert('Para redefinir sua senha, entre em contato com o Administrador do seu evento.')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden transition-all placeholder:text-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>ENTRAR NO SISTEMA</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Login Buttons (Demonstration & fast switcher) */}
        <div className="pt-4 border-t border-slate-800 space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">
            Acesso Rápido por Perfil (Demo)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickLogin('MASTER')}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition-colors text-left"
            >
              👑 <strong className="text-white">Super Admin</strong>
              <span className="block text-[10px] text-slate-400">Acesso Geral</span>
            </button>
            <button
              onClick={() => handleQuickLogin('ADMIN')}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition-colors text-left"
            >
              🏢 <strong className="text-white">Administrador</strong>
              <span className="block text-[10px] text-slate-400">Gestor do Evento</span>
            </button>
            <button
              onClick={() => handleQuickLogin('SELLER')}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition-colors text-left"
            >
              🎟️ <strong className="text-white">Vendedor</strong>
              <span className="block text-[10px] text-slate-400">PDV e Comissões</span>
            </button>
            <button
              onClick={() => handleQuickLogin('DOORMAN')}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 transition-colors text-left"
            >
              📲 <strong className="text-white">Portaria</strong>
              <span className="block text-[10px] text-slate-400">Validador Check-in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
