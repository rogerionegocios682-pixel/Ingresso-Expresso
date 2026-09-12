import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  ShoppingCart,
  QrCode,
  Receipt,
  Ticket,
  Users,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronRight
} from 'lucide-react';
import { User, UserRole } from '../types';
import { StorageService } from '../services/storage';
import { NavigationTab, isTabAllowedForRole, getRoleDisplayName } from '../services/permissions';

export type { NavigationTab };

interface LayoutProps {
  currentUser: User;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentUser,
  activeTab,
  onSelectTab,
  onLogout,
  children
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const company = StorageService.getCurrentCompany();

  // Menu items matching requirement #31 and strict role permissions
  const menuItems = [
    { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'events' as NavigationTab, label: 'Eventos', icon: Calendar },
    { id: 'batches' as NavigationTab, label: 'Lotes / Ingressos', icon: Layers },
    { id: 'pos' as NavigationTab, label: 'PDV / Vender', icon: ShoppingCart },
    { id: 'checkin' as NavigationTab, label: 'Portaria / Check-in', icon: QrCode },
    {
      id: 'sales' as NavigationTab,
      label: currentUser.role === 'SELLER' ? 'Minhas Vendas' : 'Vendas',
      icon: Receipt
    },
    { id: 'tickets' as NavigationTab, label: 'Ingressos', icon: Ticket },
    { id: 'customers' as NavigationTab, label: 'Clientes', icon: Users },
    { id: 'users' as NavigationTab, label: 'Usuários / Vendedores', icon: UserCog },
    { id: 'reports' as NavigationTab, label: 'Relatórios', icon: BarChart3 },
    { id: 'settings' as NavigationTab, label: 'Configurações', icon: Settings }
  ];

  // Filter menu items by user role strictly based on permissions matrix
  const allowedMenuItems = menuItems.filter(item => isTabAllowedForRole(currentUser.role, item.id));

  const handleTabClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-800">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-sm tracking-tight">INGRESSOS EVENTOS</span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Desktop Sidebar / Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col justify-between transition-transform duration-300 md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } shrink-0 shadow-xl h-screen`}
      >
        {/* Top Branding & Company Info */}
        <div className="p-5 border-b border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-sm tracking-tight text-white leading-none">
                INGRESSOS EVENTOS
              </h2>
              <span className="text-[10px] text-slate-400 font-medium">SaaS Multiempresa</span>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2 text-xs">
            <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-200 truncate">{company.name}</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {allowedMenuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-indigo-200" />}
              </button>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-indigo-400">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
              <span className="inline-block text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {getRoleDisplayName(currentUser.role)}
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
};
