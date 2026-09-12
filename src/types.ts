export type UserRole = 'MASTER' | 'ADMIN' | 'SELLER' | 'CHECKIN' | 'DOORMAN';

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  docNumber?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  supportEmail?: string;
  pixKey?: string;
  pixKeyType?: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria';
  pixRecipientName?: string;
  bankName?: string;
  printFormat?: 'thermal80' | 'thermal58' | 'a4';
  logoUrl?: string;
  plan: 'Básico' | 'Profissional' | 'Enterprise';
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  active?: boolean;
  phone?: string;
  commissionRate?: number; // percentage (e.g. 5 for 5%)
  authorizedEventIds?: string[]; // IDs or ['*']
  createdAt: string;
}

export type EventStatus = 'draft' | 'active' | 'finished' | 'cancelled';

export interface Event {
  id: string;
  companyId: string;
  name: string;
  description: string;
  coverImage: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  venue: string;
  address: string;
  city: string;
  state: string;
  organizerName: string;
  docNumber: string; // CNPJ or CPF
  phone: string;
  whatsapp: string;
  email: string;
  status: EventStatus;
  createdAt: string;
}

export type BatchStatus = 'active' | 'exhausted' | 'inactive';

export interface TicketBatch {
  id: string;
  companyId: string;
  eventId: string;
  name: string; // e.g. "1º Lote", "Lote Promocional"
  ticketTypeName: string; // e.g. "VIP", "Pista", "Camarote", "Cortesia"
  price: number;
  totalQuantity: number;
  soldQuantity: number;
  startDate: string;
  endDate: string;
  status: BatchStatus;
  createdAt: string;
}

export type TicketStatus = 'valid' | 'used' | 'cancelled' | 'blocked';

export interface Ticket {
  id: string;
  companyId: string;
  eventId: string;
  batchId: string;
  ticketTypeName: string;
  batchName: string;
  ticketNumber: string; // e.g. "EVT-2026-000123"
  validationToken: string; // Unique anti-fraud token e.g. "TKT-8F72A9C4-2026-XXXX"
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerDoc?: string;
  price: number;
  paymentMethod: PaymentMethod;
  saleId: string;
  sellerId: string;
  sellerName: string;
  status: TicketStatus;
  purchaseDate: string;
  usedAt?: string;
  usedByUserId?: string;
  usedByUserName?: string;
  cancelledAt?: string;
  cancelReason?: string;
  cancelledByUserName?: string;
  notes?: string;
}

export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'cortesia' | 'outros';

export interface Sale {
  id: string;
  companyId: string;
  saleNumber: string; // e.g. "VND-2026-0045"
  eventId: string;
  eventName: string;
  ticketIds: string[];
  batchId: string;
  ticketTypeName: string;
  batchName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerDoc?: string;
  sellerId: string;
  sellerName: string;
  sellerCommission: number;
  createdAt: string;
  status: 'completed' | 'cancelled';
}

export interface CheckInRecord {
  id: string;
  companyId: string;
  eventId: string;
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  ticketTypeName: string;
  batchName: string;
  checkedInAt: string;
  checkedInByUserId: string;
  checkedInByUserName: string;
  result: 'valid' | 'already_used' | 'invalid' | 'cancelled';
  deviceInfo?: string;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  cpf?: string;
  totalSpent: number;
  totalTickets: number;
  lastPurchaseDate: string;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  ip?: string;
  createdAt: string;
}

export interface ValidationResult {
  valid: boolean;
  status: 'VALID' | 'ALREADY_USED' | 'INVALID' | 'CANCELLED' | 'EVENT_MISMATCH' | 'NON_UNIQUE' | 'BLOCKED';
  message: string;
  ticket?: Ticket;
  event?: Event;
  firstUsedAt?: string;
  firstUsedByName?: string;
  tokenUnique?: boolean;
  checkedAt?: string;
  source?: 'FIRESTORE' | 'LOCAL';
  scannedCode?: string;
}
