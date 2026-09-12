import { UserRole } from '../types';

export type NavigationTab =
  | 'dashboard'
  | 'events'
  | 'batches'
  | 'pos'
  | 'checkin'
  | 'sales'
  | 'tickets'
  | 'customers'
  | 'users'
  | 'reports'
  | 'settings';

/**
 * Matriz estrita de permissões de acesso por perfil de usuário
 * - MASTER (Super Admin): Acesso global a todas as telas e multiempresa
 * - ADMIN (Administrador): Acesso a todas as telas da sua empresa
 * - SELLER (Vendedor): Apenas PDV de Vendas e Minhas Vendas (suas próprias comissões)
 * - DOORMAN / CHECKIN (Portaria): Apenas Portaria / Check-in de QR Code
 */
export const ROLE_PERMISSIONS: Record<UserRole, NavigationTab[]> = {
  MASTER: [
    'dashboard',
    'events',
    'batches',
    'pos',
    'checkin',
    'sales',
    'tickets',
    'customers',
    'users',
    'reports',
    'settings'
  ],
  ADMIN: [
    'dashboard',
    'events',
    'batches',
    'pos',
    'checkin',
    'sales',
    'tickets',
    'customers',
    'users',
    'reports',
    'settings'
  ],
  SELLER: [
    'pos',
    'sales'
  ],
  DOORMAN: [
    'checkin'
  ],
  CHECKIN: [
    'checkin'
  ]
};

/**
 * Retorna se o perfil tem permissão para acessar a aba informada
 */
export function isTabAllowedForRole(role: UserRole, tab: NavigationTab): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  if (!allowed) return false;
  return allowed.includes(tab);
}

/**
 * Retorna a aba inicial padrão adequada para cada perfil
 */
export function getDefaultTabForRole(role: UserRole): NavigationTab {
  switch (role) {
    case 'SELLER':
      return 'pos';
    case 'DOORMAN':
    case 'CHECKIN':
      return 'checkin';
    case 'ADMIN':
    case 'MASTER':
    default:
      return 'dashboard';
  }
}

/**
 * Nome amigável de cada perfil
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'MASTER':
      return 'Super Admin';
    case 'ADMIN':
      return 'Administrador';
    case 'SELLER':
      return 'Vendedor';
    case 'DOORMAN':
    case 'CHECKIN':
      return 'Portaria';
    default:
      return role;
  }
}

/**
 * Permissões granulares de operações
 */
export function canManageEvents(role: UserRole): boolean {
  return role === 'MASTER' || role === 'ADMIN';
}

export function canManageBatches(role: UserRole): boolean {
  return role === 'MASTER' || role === 'ADMIN';
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'MASTER' || role === 'ADMIN';
}

export function canViewReports(role: UserRole): boolean {
  return role === 'MASTER' || role === 'ADMIN';
}

export function canManageSettings(role: UserRole): boolean {
  return role === 'MASTER' || role === 'ADMIN';
}

export function canCancelTickets(role: UserRole): boolean {
  return role === 'MASTER' || role === 'ADMIN';
}

export function canManageCustomers(role: UserRole): boolean {
  return role === 'MASTER' || role === 'ADMIN';
}

export function canViewGlobalDashboard(role: UserRole): boolean {
  return role === 'MASTER' || role === 'ADMIN';
}
