import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { User } from '../types';
import { getDefaultTabForRole, getRoleDisplayName, NavigationTab } from '../services/permissions';

interface AccessDeniedViewProps {
  currentUser: User;
  onNavigateToAllowedTab: (tab: NavigationTab) => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  currentUser,
  onNavigateToAllowedTab
}) => {
  const defaultTab = getDefaultTabForRole(currentUser.role);

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-rose-200 shadow-sm text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-slate-900">Acesso Restrito</h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Seu perfil de <strong>{getRoleDisplayName(currentUser.role)}</strong> não tem permissão para acessar este módulo.
        </p>
      </div>

      <div className="pt-3">
        <button
          onClick={() => onNavigateToAllowedTab(defaultTab)}
          className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Minha Área</span>
        </button>
      </div>
    </div>
  );
};
