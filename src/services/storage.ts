import {
  Company,
  User,
  Event,
  TicketBatch,
  Ticket,
  Sale,
  Customer,
  AuditLog,
  ValidationResult,
  PaymentMethod
} from '../types';
import {
  INITIAL_COMPANIES,
  INITIAL_USERS,
  INITIAL_EVENTS,
  INITIAL_BATCHES,
  INITIAL_TICKETS,
  INITIAL_SALES,
  INITIAL_CUSTOMERS,
  INITIAL_AUDIT_LOGS
} from '../data/initialData';
import {
  saveTicketToFirestore,
  saveTicketsBatchToFirestore,
  updateTicketStatusInFirestore,
  saveSaleToFirestore,
  saveEventToFirestore,
  saveBatchToFirestore,
  findTicketInFirestore,
  validateTicketWithFirestore,
  confirmCheckInWithFirestore,
  subscribeToTickets,
  subscribeToSales,
  subscribeToEvents,
  testFirestoreConnection
} from './firebase';

const STORAGE_KEYS = {
  COMPANIES: 'ie_companies',
  USERS: 'ie_users',
  CURRENT_USER: 'ie_current_user',
  CURRENT_COMPANY_ID: 'ie_current_company_id',
  EVENTS: 'ie_events',
  BATCHES: 'ie_batches',
  TICKETS: 'ie_tickets',
  SALES: 'ie_sales',
  CUSTOMERS: 'ie_customers',
  AUDIT_LOGS: 'ie_audit_logs'
};

type Listener = () => void;
const listeners: Set<Listener> = new Set();

let firestoreSyncStarted = false;

export function initFirestoreSync() {
  if (firestoreSyncStarted) return;
  firestoreSyncStarted = true;

  testFirestoreConnection();

  // 1. Real-time subscription to cloud tickets
  subscribeToTickets((remoteTickets) => {
    if (!remoteTickets || remoteTickets.length === 0) return;
    const localTickets = getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
    const remoteMap = new Map<string, Ticket>();
    remoteTickets.forEach(t => remoteMap.set(t.id, t));

    // Upload any local tickets created offline to Firestore
    const localOnly: Ticket[] = [];
    localTickets.forEach(lt => {
      if (!remoteMap.has(lt.id)) {
        localOnly.push(lt);
        remoteMap.set(lt.id, lt);
      }
    });

    if (localOnly.length > 0) {
      saveTicketsBatchToFirestore(localOnly);
    }

    const merged = Array.from(remoteMap.values());
    setItem(STORAGE_KEYS.TICKETS, merged);
  });

  // 2. Real-time subscription to cloud sales
  subscribeToSales((remoteSales) => {
    if (!remoteSales || remoteSales.length === 0) return;
    const localSales = getItem<Sale[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
    const remoteMap = new Map<string, Sale>();
    remoteSales.forEach(s => remoteMap.set(s.id, s));

    const localOnly: Sale[] = [];
    localSales.forEach(ls => {
      if (!remoteMap.has(ls.id)) {
        localOnly.push(ls);
        remoteMap.set(ls.id, ls);
      }
    });

    if (localOnly.length > 0) {
      localOnly.forEach(s => saveSaleToFirestore(s));
    }

    const merged = Array.from(remoteMap.values());
    setItem(STORAGE_KEYS.SALES, merged);
  });

  // 3. Seed initial default tickets to cloud if needed
  const initialLocalTickets = getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
  saveTicketsBatchToFirestore(initialLocalTickets);
}

function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch (e) {
      console.error('Listener error', e);
    }
  });
}

export function subscribeToStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const val = localStorage.getItem(key);
    if (!val) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(val) as T;
  } catch (e) {
    console.error(`Error reading ${key}`, e);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyListeners();
  } catch (e) {
    console.error(`Error writing ${key}`, e);
  }
}

// Generate random secure hex token
export function generateValidationToken(ticketNumber: string): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');
  const year = new Date().getFullYear();
  const cleanNumber = ticketNumber.replace(/[^0-9]/g, '').slice(-5);
  return `TKT-${hex}-${year}-${cleanNumber || '00001'}`;
}

export const StorageService = {
  // Real-time store subscription
  subscribe(listener: Listener): () => void {
    return subscribeToStore(listener);
  },

  // Auth & Session
  getCurrentUser(): User {
    const stored = getItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (stored) return stored;
    // Default to Admin for ready demonstration
    const defaultUser = INITIAL_USERS[1]; // Renata Admin
    setItem(STORAGE_KEYS.CURRENT_USER, defaultUser);
    setItem(STORAGE_KEYS.CURRENT_COMPANY_ID, defaultUser.companyId);
    return defaultUser;
  },

  setCurrentUser(user: User | null): void {
    setItem(STORAGE_KEYS.CURRENT_USER, user);
    if (user) {
      setItem(STORAGE_KEYS.CURRENT_COMPANY_ID, user.companyId);
      this.addAuditLog(user.companyId, user.id, user.name, user.role, 'Login no Sistema', `Usuário efetuou login com perfil ${user.role}`);
    }
  },

  getCurrentCompanyId(): string {
    const current = getItem<string>(STORAGE_KEYS.CURRENT_COMPANY_ID, 'comp-01');
    return current;
  },

  setCurrentCompanyId(companyId: string): void {
    setItem(STORAGE_KEYS.CURRENT_COMPANY_ID, companyId);
  },

  getCurrentCompany(): Company {
    const compId = this.getCurrentCompanyId();
    const companies = this.getCompanies();
    return companies.find(c => c.id === compId) || companies[0] || INITIAL_COMPANIES[0];
  },

  // Companies
  getCompanies(): Company[] {
    return getItem<Company[]>(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
  },

  saveCompany(companyData: Partial<Company> & { name: string }): Company {
    const companies = this.getCompanies();
    if (companyData.id) {
      const idx = companies.findIndex(c => c.id === companyData.id);
      if (idx !== -1) {
        companies[idx] = { ...companies[idx], ...companyData } as Company;
        setItem(STORAGE_KEYS.COMPANIES, companies);
        return companies[idx];
      }
    }
    const newCompany: Company = {
      plan: 'Profissional',
      status: 'active',
      cnpj: '',
      email: '',
      phone: '',
      ...companyData,
      id: companyData.id || `comp-${Date.now()}`,
      createdAt: companyData.createdAt || new Date().toISOString()
    };
    companies.push(newCompany);
    setItem(STORAGE_KEYS.COMPANIES, companies);
    return newCompany;
  },

  updateCompany(id: string, updates: Partial<Company>): Company | null {
    const companies = this.getCompanies();
    const idx = companies.findIndex(c => c.id === id);
    if (idx === -1) return null;
    companies[idx] = { ...companies[idx], ...updates };
    setItem(STORAGE_KEYS.COMPANIES, companies);
    return companies[idx];
  },

  // Users
  getUsers(companyId?: string): User[] {
    const users = getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    if (companyId) {
      return users.filter(u => u.companyId === companyId || u.role === 'MASTER');
    }
    return users;
  },

  saveUser(userData: Omit<User, 'id' | 'createdAt'>): User {
    const users = getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const isActive = userData.active !== undefined ? userData.active : userData.status === 'active';
    const newUser: User = {
      ...userData,
      status: isActive ? 'active' : 'inactive',
      active: isActive,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    setItem(STORAGE_KEYS.USERS, users);
    return newUser;
  },

  updateUser(id: string, updates: Partial<User>): User | null {
    const users = getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    const current = users[idx];
    const isActive = updates.active !== undefined ? updates.active : (updates.status ? updates.status === 'active' : (current.active ?? (current.status === 'active')));
    users[idx] = {
      ...current,
      ...updates,
      status: isActive ? 'active' : 'inactive',
      active: isActive
    };
    setItem(STORAGE_KEYS.USERS, users);

    // If updating currently logged user, sync
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === id) {
      setItem(STORAGE_KEYS.CURRENT_USER, users[idx]);
    }

    return users[idx];
  },

  // Events
  getEvents(companyId?: string): Event[] {
    const events = getItem<Event[]>(STORAGE_KEYS.EVENTS, INITIAL_EVENTS);
    if (companyId) {
      return events.filter(e => e.companyId === companyId);
    }
    return events;
  },

  getEventById(id: string): Event | undefined {
    return this.getEvents().find(e => e.id === id);
  },

  saveEvent(eventData: Omit<Event, 'id' | 'createdAt'>): Event {
    const events = getItem<Event[]>(STORAGE_KEYS.EVENTS, INITIAL_EVENTS);
    const newEvent: Event = {
      ...eventData,
      id: `evt-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    events.unshift(newEvent);
    setItem(STORAGE_KEYS.EVENTS, events);

    const currentUser = this.getCurrentUser();
    this.addAuditLog(
      newEvent.companyId,
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'Criação de Evento',
      `Criou o evento "${newEvent.name}" em ${newEvent.venue}`
    );

    return newEvent;
  },

  updateEvent(id: string, updates: Partial<Event>): Event | null {
    const events = getItem<Event[]>(STORAGE_KEYS.EVENTS, INITIAL_EVENTS);
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    events[idx] = { ...events[idx], ...updates };
    setItem(STORAGE_KEYS.EVENTS, events);

    const currentUser = this.getCurrentUser();
    this.addAuditLog(
      events[idx].companyId,
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'Alteração de Evento',
      `Atualizou dados do evento "${events[idx].name}"`
    );

    return events[idx];
  },

  // Batches (Lotes)
  getBatches(companyId?: string, eventId?: string): TicketBatch[] {
    let batches = getItem<TicketBatch[]>(STORAGE_KEYS.BATCHES, INITIAL_BATCHES);
    if (companyId) {
      batches = batches.filter(b => b.companyId === companyId);
    }
    if (eventId) {
      batches = batches.filter(b => b.eventId === eventId);
    }
    return batches;
  },

  saveBatch(batchData: Omit<TicketBatch, 'id' | 'createdAt' | 'soldQuantity'>): TicketBatch {
    const batches = getItem<TicketBatch[]>(STORAGE_KEYS.BATCHES, INITIAL_BATCHES);
    const newBatch: TicketBatch = {
      ...batchData,
      id: `batch-${Date.now()}`,
      soldQuantity: 0,
      createdAt: new Date().toISOString()
    };
    batches.push(newBatch);
    setItem(STORAGE_KEYS.BATCHES, batches);
    return newBatch;
  },

  updateBatch(id: string, updates: Partial<TicketBatch>): TicketBatch | null {
    const batches = getItem<TicketBatch[]>(STORAGE_KEYS.BATCHES, INITIAL_BATCHES);
    const idx = batches.findIndex(b => b.id === id);
    if (idx === -1) return null;
    batches[idx] = { ...batches[idx], ...updates };
    setItem(STORAGE_KEYS.BATCHES, batches);
    return batches[idx];
  },

  // Tickets
  getTickets(companyId?: string, eventId?: string): Ticket[] {
    let tickets = getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
    if (companyId) {
      tickets = tickets.filter(t => t.companyId === companyId);
    }
    if (eventId) {
      tickets = tickets.filter(t => t.eventId === eventId);
    }
    return tickets;
  },

  getTicketById(id: string): Ticket | undefined {
    return getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS).find(t => t.id === id);
  },

  getTicketByToken(token: string): Ticket | undefined {
    const cleanToken = token.trim();
    return getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS).find(
      t => t.validationToken.toUpperCase() === cleanToken.toUpperCase() || t.ticketNumber.toUpperCase() === cleanToken.toUpperCase()
    );
  },

  cancelTicket(ticketId: string, reason: string, operator: User): Ticket | null {
    const tickets = getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) return null;

    tickets[idx].status = 'cancelled';
    tickets[idx].cancelledAt = new Date().toISOString();
    tickets[idx].cancelReason = reason;
    tickets[idx].cancelledByUserName = operator.name;
    tickets[idx].notes = reason;
    setItem(STORAGE_KEYS.TICKETS, tickets);

    updateTicketStatusInFirestore(ticketId, {
      status: 'cancelled',
      cancelledAt: tickets[idx].cancelledAt,
      cancelReason: reason,
      cancelledByUserName: operator.name,
      notes: reason
    });

    this.addAuditLog(
      tickets[idx].companyId,
      operator.id,
      operator.name,
      operator.role,
      'Cancelamento de Ingresso',
      `Ingresso ${tickets[idx].ticketNumber} cancelado. Motivo: ${reason}`
    );

    return tickets[idx];
  },

  // Sales
  getSales(companyId?: string, eventId?: string): Sale[] {
    let sales = getItem<Sale[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
    if (companyId) {
      sales = sales.filter(s => s.companyId === companyId);
    }
    if (eventId) {
      sales = sales.filter(s => s.eventId === eventId);
    }
    return sales;
  },

  // Fast POS Sale Transaction
  createSale(params: {
    companyId: string;
    eventId: string;
    batchId: string;
    quantity: number;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerDoc?: string;
    paymentMethod: PaymentMethod;
    seller: User;
  }): { sale: Sale; tickets: Ticket[] } {
    const batches = getItem<TicketBatch[]>(STORAGE_KEYS.BATCHES, INITIAL_BATCHES);
    const batch = batches.find(b => b.id === params.batchId);
    if (!batch) {
      throw new Error('Lote de ingressos não encontrado.');
    }

    const available = batch.totalQuantity - batch.soldQuantity;
    if (available < params.quantity) {
      throw new Error(`Quantidade solicitada indisponível. Restam apenas ${available} ingressos.`);
    }

    const event = this.getEventById(params.eventId);
    if (!event) {
      throw new Error('Evento não encontrado.');
    }

    const sales = getItem<Sale[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
    const allTickets = getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);

    // Increment batch sold quantity
    batch.soldQuantity += params.quantity;
    if (batch.soldQuantity >= batch.totalQuantity) {
      batch.status = 'exhausted';
    }
    setItem(STORAGE_KEYS.BATCHES, batches);

    // Next sale number
    const saleSeq = (sales.length + 1).toString().padStart(4, '0');
    const saleNumber = `VND-${new Date().getFullYear()}-${saleSeq}`;
    const saleId = `sale-${Date.now()}`;

    // Calculate commission
    const unitPrice = batch.price;
    const totalAmount = unitPrice * params.quantity;
    const commissionPercent = params.seller.commissionRate || 0;
    const sellerCommission = (totalAmount * commissionPercent) / 100;

    const generatedTickets: Ticket[] = [];
    const ticketIds: string[] = [];

    for (let i = 0; i < params.quantity; i++) {
      const ticketSeq = (allTickets.length + i + 1).toString().padStart(6, '0');
      const ticketNumber = `EVT-${new Date().getFullYear()}-${ticketSeq}`;
      const token = generateValidationToken(ticketNumber);
      const ticketId = `tkt-${Date.now()}-${i}`;

      const ticket: Ticket = {
        id: ticketId,
        companyId: params.companyId,
        eventId: params.eventId,
        batchId: params.batchId,
        ticketTypeName: batch.ticketTypeName,
        batchName: batch.name,
        ticketNumber,
        validationToken: token,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        customerEmail: params.customerEmail,
        customerDoc: params.customerDoc,
        price: unitPrice,
        paymentMethod: params.paymentMethod,
        saleId,
        sellerId: params.seller.id,
        sellerName: params.seller.name,
        status: 'valid',
        purchaseDate: new Date().toISOString()
      };

      generatedTickets.push(ticket);
      ticketIds.push(ticketId);
    }

    // Save tickets locally and to Firestore
    allTickets.push(...generatedTickets);
    setItem(STORAGE_KEYS.TICKETS, allTickets);
    saveTicketsBatchToFirestore(generatedTickets);

    // Create Sale record
    const newSale: Sale = {
      id: saleId,
      companyId: params.companyId,
      saleNumber,
      eventId: params.eventId,
      eventName: event.name,
      ticketIds,
      batchId: params.batchId,
      ticketTypeName: batch.ticketTypeName,
      batchName: batch.name,
      quantity: params.quantity,
      unitPrice,
      totalAmount,
      paymentMethod: params.paymentMethod,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      customerDoc: params.customerDoc,
      sellerId: params.seller.id,
      sellerName: params.seller.name,
      sellerCommission,
      createdAt: new Date().toISOString(),
      status: 'completed'
    };

    sales.unshift(newSale);
    setItem(STORAGE_KEYS.SALES, sales);
    saveSaleToFirestore(newSale);

    // Save or update Customer
    this.upsertCustomer({
      companyId: params.companyId,
      name: params.customerName,
      phone: params.customerPhone,
      whatsapp: params.customerPhone.replace(/[^0-9]/g, ''),
      email: params.customerEmail || '',
      cpf: params.customerDoc,
      amount: totalAmount,
      ticketCount: params.quantity
    });

    // Audit log
    this.addAuditLog(
      params.companyId,
      params.seller.id,
      params.seller.name,
      params.seller.role,
      'Venda de Ingresso',
      `Venda ${saleNumber} realizada: ${params.quantity}x ${batch.ticketTypeName} para ${params.customerName} (${params.paymentMethod.toUpperCase()}) - Total: R$ ${totalAmount.toFixed(2)}`
    );

    return { sale: newSale, tickets: generatedTickets };
  },

  // Customers
  getCustomers(companyId?: string): Customer[] {
    const customers = getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    if (companyId) {
      return customers.filter(c => c.companyId === companyId);
    }
    return customers;
  },

  upsertCustomer(data: {
    companyId: string;
    name: string;
    phone: string;
    whatsapp: string;
    email: string;
    cpf?: string;
    amount: number;
    ticketCount: number;
  }): void {
    const customers = getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    const existing = customers.find(c => c.companyId === data.companyId && (c.phone === data.phone || (data.cpf && c.cpf === data.cpf)));

    if (existing) {
      existing.name = data.name;
      existing.totalSpent += data.amount;
      existing.totalTickets += data.ticketCount;
      existing.lastPurchaseDate = new Date().toISOString().split('T')[0];
      if (data.email) existing.email = data.email;
    } else {
      customers.push({
        id: `cust-${Date.now()}`,
        companyId: data.companyId,
        name: data.name,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        cpf: data.cpf,
        totalSpent: data.amount,
        totalTickets: data.ticketCount,
        lastPurchaseDate: new Date().toISOString().split('T')[0]
      });
    }

    setItem(STORAGE_KEYS.CUSTOMERS, customers);
  },

  // Anti-fraud & QR Check-In Engine
  normalizeScannedCode(raw: string): string {
    let clean = (raw || '').trim();
    // Remove zero-width / invisible chars
    clean = clean.replace(/[\u200B-\u200D\uFEFF]/g, '');
    // Replace unicode hyphens with standard ASCII dash
    clean = clean.replace(/[\u2010-\u2015\u2212]/g, '-');

    // If QR payload was JSON string (e.g. {"t":"TKT-...", "n":"EVT-..."})
    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.t) clean = parsed.t;
        else if (parsed.validationToken) clean = parsed.validationToken;
        else if (parsed.n) clean = parsed.n;
        else if (parsed.ticketNumber) clean = parsed.ticketNumber;
      } catch {
        // use raw
      }
    }

    // If URL with parameter (e.g. https://.../?token=TKT-... or ?t=TKT-...)
    if (clean.includes('?') && (clean.includes('token=') || clean.includes('t=') || clean.includes('code='))) {
      try {
        const url = new URL(clean);
        const p = url.searchParams.get('token') || url.searchParams.get('t') || url.searchParams.get('code');
        if (p) clean = p;
      } catch {
        // fallback
      }
    }

    return clean.trim().toUpperCase().replace(/[\u2010-\u2015\u2212]/g, '-');
  },

  validateTicket(
    tokenOrNumber: string,
    targetEventId?: string,
    operator?: User
  ): ValidationResult {
    const clean = this.normalizeScannedCode(tokenOrNumber);
    const tickets = getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
    const ticket = tickets.find(
      t =>
        t.validationToken.toUpperCase().replace(/[\u2010-\u2015\u2212]/g, '-') === clean ||
        t.ticketNumber.toUpperCase().replace(/[\u2010-\u2015\u2212]/g, '-') === clean ||
        t.id === clean
    );

    if (!ticket) {
      if (operator) {
        this.addAuditLog(
          operator.companyId,
          operator.id,
          operator.name,
          operator.role,
          'Tentativa Ingresso Inválido',
          `Tentativa de leitura de código inexistente: "${clean}"`
        );
      }
      return {
        valid: false,
        status: 'INVALID',
        message: 'Código de ingresso não localizado no banco de dados.'
      };
    }

    const event = this.getEventById(ticket.eventId);

    // Event check if restricted to specific event
    if (targetEventId && targetEventId !== 'all' && targetEventId !== '' && ticket.eventId !== targetEventId) {
      return {
        valid: false,
        status: 'EVENT_MISMATCH',
        message: `Este ingresso pertence ao evento "${event?.name || 'outro evento'}" e não ao evento selecionado na portaria.`,
        ticket,
        event
      };
    }

    // Cancelled check
    if (ticket.status === 'cancelled') {
      if (operator) {
        this.addAuditLog(
          ticket.companyId,
          operator.id,
          operator.name,
          operator.role,
          'Tentativa Ingresso Cancelado',
          `Ingresso cancelado ${ticket.ticketNumber} apresentado por ${ticket.customerName}. Motivo original: ${ticket.notes || 'Nenhum'}`
        );
      }
      return {
        valid: false,
        status: 'CANCELLED',
        message: `Ingresso cancelado no sistema. ${ticket.notes ? `Motivo: ${ticket.notes}` : ''}`,
        ticket,
        event
      };
    }

    // Blocked check
    if (ticket.status === 'blocked') {
      return {
        valid: false,
        status: 'INVALID',
        message: 'Ingresso bloqueado preventivamente pela administração.',
        ticket,
        event
      };
    }

    // Already used check (anti-fraud double entry prevention)
    if (ticket.status === 'used') {
      if (operator) {
        this.addAuditLog(
          ticket.companyId,
          operator.id,
          operator.name,
          operator.role,
          'Tentativa Ingresso Duplicado',
          `ALERTA DE FRAUDE: Segunda tentativa de uso do ingresso ${ticket.ticketNumber} (${ticket.customerName}). Primeiro check-in foi às ${ticket.usedAt ? new Date(ticket.usedAt).toLocaleTimeString('pt-BR') : 'Horário registrado'}`
        );
      }
      return {
        valid: false,
        status: 'ALREADY_USED',
        message: 'Atenção: Este ingresso JÁ FOI UTILIZADO e teve entrada liberada anteriormente.',
        ticket,
        event,
        firstUsedAt: ticket.usedAt,
        firstUsedByName: ticket.usedByUserName
      };
    }

    // Valid
    return {
      valid: true,
      status: 'VALID',
      message: 'Ingresso válido e liberado para entrada.',
      ticket,
      event
    };
  },

  async validateTicketAsync(
    tokenOrNumber: string,
    targetEventId?: string,
    operator?: User
  ): Promise<ValidationResult> {
    const clean = this.normalizeScannedCode(tokenOrNumber);

    try {
      // 1. Authoritative check against Cloud Firestore for existence, status, and token uniqueness
      const firestoreResult = await validateTicketWithFirestore(clean, targetEventId);

      // If ticket found in Firestore, sync/update local cache
      if (firestoreResult.ticket) {
        const tickets = getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
        const idx = tickets.findIndex(t => t.id === firestoreResult.ticket!.id);
        if (idx >= 0) {
          tickets[idx] = firestoreResult.ticket;
        } else {
          tickets.push(firestoreResult.ticket);
        }
        setItem(STORAGE_KEYS.TICKETS, tickets);
      }

      // Security audit logging
      if (firestoreResult.status === 'ALREADY_USED' && operator && firestoreResult.ticket) {
        this.addAuditLog(
          firestoreResult.ticket.companyId,
          operator.id,
          operator.name,
          operator.role,
          'Tentativa Ingresso Duplicado (Firestore)',
          `ALERTA DE FRAUDE: Tentativa de reuso do ingresso ${firestoreResult.ticket.ticketNumber} (${firestoreResult.ticket.customerName}). Primeiro check-in foi às ${firestoreResult.firstUsedAt ? new Date(firestoreResult.firstUsedAt).toLocaleTimeString('pt-BR') : 'horário registrado'}.`
        );
      } else if (firestoreResult.status === 'NON_UNIQUE' && operator) {
        this.addAuditLog(
          'comp-1',
          operator.id,
          operator.name,
          operator.role,
          'Alerta Unicidade de Token',
          `ALERTA CRÍTICO: Token não é único no Firestore para o código ${clean}. Risco de clonagem.`
        );
      }

      return firestoreResult;
    } catch (err) {
      console.warn('Firestore live validation failed, using local cache fallback:', err);
      // Fallback to local storage validation if Firestore network request fails
      const localResult = this.validateTicket(clean, targetEventId, operator);
      return {
        ...localResult,
        source: 'LOCAL',
        tokenUnique: localResult.valid,
        scannedCode: clean
      };
    }
  },

  async confirmCheckInAsync(
    ticketId: string,
    operator: User
  ): Promise<{ success: boolean; ticket?: Ticket; error?: string }> {
    try {
      // Execute atomic transaction directly in Cloud Firestore
      const firestoreResult = await confirmCheckInWithFirestore(ticketId, operator);

      if (firestoreResult.success && firestoreResult.ticket) {
        // Update local state cache with the updated ticket
        const tickets = getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
        const idx = tickets.findIndex(t => t.id === ticketId);
        if (idx >= 0) {
          tickets[idx] = firestoreResult.ticket;
        } else {
          tickets.push(firestoreResult.ticket);
        }
        setItem(STORAGE_KEYS.TICKETS, tickets);

        // Audit log
        this.addAuditLog(
          firestoreResult.ticket.companyId,
          operator.id,
          operator.name,
          operator.role,
          'Check-in Confirmado (Firestore)',
          `Entrada autorizada com sucesso via transação Firestore para ${firestoreResult.ticket.customerName} (${firestoreResult.ticket.ticketNumber} - ${firestoreResult.ticket.ticketTypeName})`
        );

        return firestoreResult;
      } else if (!firestoreResult.success) {
        return firestoreResult;
      }
    } catch (e) {
      console.warn('Firestore check-in transaction error, using local fallback:', e);
    }

    // Fallback if Firestore was unreachable
    return this.confirmCheckIn(ticketId, operator);
  },

  confirmCheckIn(ticketId: string, operator: User): { success: boolean; ticket?: Ticket; error?: string } {
    const tickets = getItem<Ticket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) {
      return { success: false, error: 'Ingresso não encontrado.' };
    }

    if (tickets[idx].status === 'used') {
      return { success: false, error: 'Ingresso já foi utilizado anteriormente.' };
    }

    if (tickets[idx].status === 'cancelled') {
      return { success: false, error: 'Ingresso está cancelado.' };
    }

    const nowIso = new Date().toISOString();
    tickets[idx].status = 'used';
    tickets[idx].usedAt = nowIso;
    tickets[idx].usedByUserId = operator.id;
    tickets[idx].usedByUserName = operator.name;

    setItem(STORAGE_KEYS.TICKETS, tickets);

    // Sync check-in to Cloud Firestore
    updateTicketStatusInFirestore(tickets[idx].id, {
      status: 'used',
      usedAt: nowIso,
      usedByUserId: operator.id,
      usedByUserName: operator.name
    });

    // Audit log
    this.addAuditLog(
      tickets[idx].companyId,
      operator.id,
      operator.name,
      operator.role,
      'Check-in Confirmado',
      `Entrada autorizada com sucesso para ${tickets[idx].customerName} (${tickets[idx].ticketNumber} - ${tickets[idx].ticketTypeName})`
    );

    return { success: true, ticket: tickets[idx] };
  },

  // Audit Logs
  getAuditLogs(companyId?: string): AuditLog[] {
    const logs = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    if (companyId) {
      return logs.filter(l => l.companyId === companyId);
    }
    return logs;
  },

  addAuditLog(
    companyId: string,
    userId: string,
    userName: string,
    userRole: User['role'],
    action: string,
    details: string
  ): void {
    const logs = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    logs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId,
      userId,
      userName,
      userRole,
      action,
      details,
      ip: '127.0.0.1 (Web Cloud)',
      createdAt: new Date().toISOString()
    });
    // Keep max 500 logs
    if (logs.length > 500) {
      logs.pop();
    }
    setItem(STORAGE_KEYS.AUDIT_LOGS, logs);
  },

  // Dashboard & Metrics Calculation
  getDashboardStats(companyId?: string, eventId?: string) {
    const events = this.getEvents(companyId);
    const targetEvents = eventId ? events.filter(e => e.id === eventId) : events;
    const activeEventsCount = targetEvents.filter(e => e.status === 'active').length;

    const batches = this.getBatches(companyId, eventId);
    const tickets = this.getTickets(companyId, eventId);
    const sales = this.getSales(companyId, eventId).filter(s => s.status === 'completed');

    const totalTicketsAvailable = batches.reduce((acc, b) => acc + (b.totalQuantity - b.soldQuantity), 0);
    const totalTicketsSold = tickets.filter(t => t.status !== 'cancelled').length;
    const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const checkInsCompleted = tickets.filter(t => t.status === 'used').length;
    const peopleWaiting = totalTicketsSold - checkInsCompleted;
    const cancelledCount = tickets.filter(t => t.status === 'cancelled').length;

    return {
      activeEventsCount,
      totalTicketsSold,
      totalTicketsAvailable,
      totalRevenue,
      checkInsCompleted,
      peopleWaiting: peopleWaiting < 0 ? 0 : peopleWaiting,
      cancelledCount
    };
  }
};
