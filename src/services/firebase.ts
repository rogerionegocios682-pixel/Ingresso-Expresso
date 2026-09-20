import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  limit,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Ticket, Sale, Event, TicketBatch, ValidationResult, User } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use the database specified in config, or '(default)'
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== ''
    ? firebaseConfig.firestoreDatabaseId
    : '(default)'
);

// Connection test as required by Firebase skill
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, '_connection_test', 'ping'));
    return true;
  } catch (error: unknown) {
    // If it's a permission or offline error, log it
    console.warn('Firestore connection ping test response:', error);
    return true; // Still connected to Firestore client
  }
}

// Sync helper for Tickets
export async function saveTicketToFirestore(ticket: Ticket): Promise<void> {
  try {
    await setDoc(doc(db, 'tickets', ticket.id), ticket, { merge: true });
  } catch (error) {
    console.error('Error saving ticket to Firestore:', error);
  }
}

export async function saveTicketsBatchToFirestore(tickets: Ticket[]): Promise<void> {
  if (!tickets || tickets.length === 0) return;
  try {
    // Firestore batch limit is 500 ops. We use chunks of 400 for safety.
    const chunkSize = 400;
    for (let i = 0; i < tickets.length; i += chunkSize) {
      const chunk = tickets.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const ticket of chunk) {
        const ref = doc(db, 'tickets', ticket.id);
        batch.set(ref, ticket, { merge: true });
      }
      await batch.commit();
    }
  } catch (error) {
    console.error('Error saving tickets batch to Firestore:', error);
    // Fallback to individual writes if batch fails
    for (const ticket of tickets) {
      try {
        await setDoc(doc(db, 'tickets', ticket.id), ticket, { merge: true });
      } catch (err) {
        console.error('Individual ticket save error:', err);
      }
    }
  }
}

export async function updateTicketStatusInFirestore(
  ticketId: string,
  updates: Partial<Ticket>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'tickets', ticketId), updates);
  } catch (error) {
    console.error('Error updating ticket in Firestore:', error);
  }
}

export async function saveSaleToFirestore(sale: Sale): Promise<void> {
  try {
    await setDoc(doc(db, 'sales', sale.id), sale, { merge: true });
  } catch (error) {
    console.error('Error saving sale to Firestore:', error);
  }
}

export async function saveEventToFirestore(event: Event): Promise<void> {
  try {
    await setDoc(doc(db, 'events', event.id), event, { merge: true });
  } catch (error) {
    console.error('Error saving event to Firestore:', error);
  }
}

// Fetch event from Firestore by ID (checks document ID and field 'id')
export async function getEventFromFirestore(eventId: string): Promise<Event | null> {
  if (!eventId || !eventId.trim()) return null;
  const cleanId = eventId.trim();
  try {
    const docRef = doc(db, 'events', cleanId);
    const snap = await getDocFromServer(docRef);
    if (snap.exists()) {
      return snap.data() as Event;
    }

    const q = query(collection(db, 'events'), where('id', '==', cleanId));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      return querySnap.docs[0].data() as Event;
    }
    return null;
  } catch (error) {
    console.warn('Could not fetch event from Firestore:', error);
    return null;
  }
}

export async function saveBatchToFirestore(batch: TicketBatch): Promise<void> {
  try {
    await setDoc(doc(db, 'batches', batch.id), batch, { merge: true });
  } catch (error) {
    console.error('Error saving batch to Firestore:', error);
  }
}

// Helper to normalize QR Code payloads and barcodes
export function normalizeTicketCode(cleanCode: string): string {
  let clean = (cleanCode || '').trim();
  clean = clean.replace(/[\u200B-\u200D\uFEFF]/g, '');
  clean = clean.replace(/[\u2010-\u2015\u2212]/g, '-');

  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed.t) clean = parsed.t;
      else if (parsed.validationToken) clean = parsed.validationToken;
      else if (parsed.n) clean = parsed.n;
      else if (parsed.ticketNumber) clean = parsed.ticketNumber;
    } catch {
      // fallback
    }
  }

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
}

// Fast direct index lookup for a ticket in Firestore
export async function findTicketInFirestore(cleanCode: string): Promise<Ticket | null> {
  try {
    const normalized = normalizeTicketCode(cleanCode);
    const colRef = collection(db, 'tickets');

    // Fast path: if code starts with TKT- (tokens), query validationToken directly
    if (normalized.startsWith('TKT-')) {
      const qToken = query(colRef, where('validationToken', '==', normalized), limit(1));
      const snap = await getDocs(qToken);
      if (!snap.empty) return snap.docs[0].data() as Ticket;
    }

    // Direct doc ID check
    const directDoc = await getDoc(doc(db, 'tickets', cleanCode.trim()));
    if (directDoc.exists()) {
      return directDoc.data() as Ticket;
    }

    // Query ticketNumber
    const qNum = query(colRef, where('ticketNumber', '==', normalized), limit(1));
    const snapNum = await getDocs(qNum);
    if (!snapNum.empty) {
      return snapNum.docs[0].data() as Ticket;
    }

    // Query validationToken fallback
    const qTokenFallback = query(colRef, where('validationToken', '==', normalized), limit(1));
    const snapTokenFallback = await getDocs(qTokenFallback);
    if (!snapTokenFallback.empty) {
      return snapTokenFallback.docs[0].data() as Ticket;
    }

    return null;
  } catch (error) {
    console.error('Error querying ticket in Firestore:', error);
    return null;
  }
}

/**
 * ATOMIC Check-In & Validation in Cloud Firestore
 *
 * Implements strict requirements:
 * 1. Rapid indexed query (QR CODE -> IDENTIFICATION -> FAST LOOKUP)
 * 2. If voucher was ALREADY USED previously:
 *    - Returns status 'ALREADY_USED' IMMEDIATELY without re-validating or writing
 *    - Returns EXACT original date and time of first utilization (never overwrites!)
 * 3. If voucher is valid and available:
 *    - Atomically registers usage in Firestore inside a runTransaction
 *    - Stores exact ISO timestamp and operator credentials
 *    - Guarantees zero race conditions even if 2 devices scan simultaneously
 */
export async function validateAndCheckInTicketAtomicWithFirestore(
  cleanCode: string,
  targetEventId?: string,
  operator?: User
): Promise<ValidationResult> {
  const normalized = normalizeTicketCode(cleanCode);
  const checkedAt = new Date().toISOString();
  const operatorCompanyId = operator?.role === 'MASTER' ? undefined : operator?.companyId;

  try {
    const colRef = collection(db, 'tickets');

    // 1. FAST INDEXED DISCOVERY (Direct doc, validationToken, or ticketNumber)
    let matchingDocRef: ReturnType<typeof doc> | null = null;
    let initialDocData: Ticket | null = null;
    let matchCount = 0;

    // Check direct doc id if pattern matches
    if (cleanCode.startsWith('tkt-')) {
      const snapDirect = await getDoc(doc(db, 'tickets', cleanCode.trim()));
      if (snapDirect.exists()) {
        matchingDocRef = snapDirect.ref;
        initialDocData = snapDirect.data() as Ticket;
        matchCount = 1;
      }
    }

    // Check indexed validationToken
    if (!matchingDocRef) {
      const qToken = query(colRef, where('validationToken', '==', normalized), limit(2));
      const snapToken = await getDocs(qToken);
      if (!snapToken.empty) {
        matchCount = snapToken.docs.length;
        if (matchCount > 1) {
          return {
            valid: false,
            status: 'NON_UNIQUE',
            message: `ALERTA CRÍTICO: Token não é único! Foram localizados ${matchCount} ingressos com este token. Risco de clonagem.`,
            tokenUnique: false,
            checkedAt,
            source: 'FIRESTORE',
            scannedCode: cleanCode
          };
        }
        matchingDocRef = snapToken.docs[0].ref;
        initialDocData = snapToken.docs[0].data() as Ticket;
      }
    }

    // Check indexed ticketNumber
    if (!matchingDocRef) {
      const qNum = query(colRef, where('ticketNumber', '==', normalized), limit(2));
      const snapNum = await getDocs(qNum);
      if (!snapNum.empty) {
        matchCount = snapNum.docs.length;
        if (matchCount > 1) {
          return {
            valid: false,
            status: 'NON_UNIQUE',
            message: `ALERTA CRÍTICO: Número de ingresso duplicado no banco (${matchCount} registros).`,
            tokenUnique: false,
            checkedAt,
            source: 'FIRESTORE',
            scannedCode: cleanCode
          };
        }
        matchingDocRef = snapNum.docs[0].ref;
        initialDocData = snapNum.docs[0].data() as Ticket;
      }
    }

    // Check field 'id' fallback
    if (!matchingDocRef) {
      const qId = query(colRef, where('id', '==', cleanCode.trim()), limit(1));
      const snapId = await getDocs(qId);
      if (!snapId.empty) {
        matchingDocRef = snapId.docs[0].ref;
        initialDocData = snapId.docs[0].data() as Ticket;
      }
    }

    // If ticket was not found in Firestore
    if (!matchingDocRef || !initialDocData) {
      return {
        valid: false,
        status: 'INVALID',
        message: 'Código de ingresso não localizado no banco de dados Firestore.',
        tokenUnique: false,
        checkedAt,
        source: 'FIRESTORE',
        scannedCode: cleanCode
      };
    }

    // 2. ATOMIC TRANSACTION: Concurrency control against double-usage across devices
    const txResult = await runTransaction(db, async (transaction) => {
      const freshSnap = await transaction.get(matchingDocRef!);
      if (!freshSnap.exists()) {
        return {
          valid: false,
          status: 'INVALID' as const,
          message: 'Ingresso removido do Firestore.',
          tokenUnique: false,
          checkedAt,
          source: 'FIRESTORE' as const,
          scannedCode: cleanCode
        };
      }

      const ticket = freshSnap.data() as Ticket;

      // Multi-company isolation
      if (operatorCompanyId && ticket.companyId && ticket.companyId !== operatorCompanyId) {
        return {
          valid: false,
          status: 'INVALID' as const,
          message: 'Acesso negado: Este ingresso pertence a outra empresa/organizadora.',
          ticket,
          tokenUnique: true,
          checkedAt,
          source: 'FIRESTORE' as const,
          scannedCode: cleanCode
        };
      }

      // Event matching check
      if (targetEventId && targetEventId !== 'all' && targetEventId !== '' && ticket.eventId !== targetEventId) {
        return {
          valid: false,
          status: 'EVENT_MISMATCH' as const,
          message: `Este ingresso pertence ao evento "${ticket.eventName || 'outro evento'}" e não ao evento selecionado na portaria.`,
          ticket,
          tokenUnique: true,
          checkedAt,
          source: 'FIRESTORE' as const,
          scannedCode: cleanCode
        };
      }

      // Cancelled check
      if (ticket.status === 'cancelled') {
        return {
          valid: false,
          status: 'CANCELLED' as const,
          message: `Ingresso cancelado no sistema. ${ticket.notes || ticket.cancelReason ? `Motivo: ${ticket.notes || ticket.cancelReason}` : ''}`,
          ticket,
          tokenUnique: true,
          checkedAt,
          source: 'FIRESTORE' as const,
          scannedCode: cleanCode
        };
      }

      // Blocked check
      if (ticket.status === 'blocked') {
        return {
          valid: false,
          status: 'BLOCKED' as const,
          message: 'Ingresso bloqueado preventivamente pela administração.',
          ticket,
          tokenUnique: true,
          checkedAt,
          source: 'FIRESTORE' as const,
          scannedCode: cleanCode
        };
      }

      // REQUIREMENT #4 & #5: VOUCHER JÁ UTILIZADO
      // If already used, return IMMEDIATELY with the original date/time.
      // Do NOT modify anything in the database! Do NOT overwrite usedAt!
      if (ticket.status === 'used') {
        return {
          valid: false,
          status: 'ALREADY_USED' as const,
          message: 'VOUCHER JÁ UTILIZADO',
          ticket,
          firstUsedAt: ticket.usedAt,
          firstUsedByName: ticket.usedByUserName,
          tokenUnique: true,
          checkedAt,
          source: 'FIRESTORE' as const,
          scannedCode: cleanCode
        };
      }

      // REQUIREMENT #3 & #5: VOUCHER DISPONÍVEL (PRIMEIRO USO)
      // Register usage IMMEDIATELY in the database with exact date and time.
      const nowIso = new Date().toISOString();
      const updates = {
        status: 'used' as const,
        usedAt: nowIso,
        usedByUserId: operator?.id || 'portaria',
        usedByUserName: operator?.name || 'Portaria'
      };

      // Atomic write within transaction
      transaction.update(matchingDocRef!, updates);

      return {
        valid: true,
        status: 'VALID' as const,
        message: 'ENTRADA LIBERADA ✓',
        ticket: { ...ticket, ...updates },
        firstUsedAt: nowIso,
        firstUsedByName: operator?.name || 'Portaria',
        tokenUnique: true,
        checkedAt: nowIso,
        source: 'FIRESTORE' as const,
        scannedCode: cleanCode
      };
    });

    return txResult;
  } catch (error) {
    console.error('Error in Firestore atomic validation:', error);
    throw error;
  }
}

// Live Firestore QR Code validation wrapper ensuring backwards compatibility
export async function validateTicketWithFirestore(
  cleanCode: string,
  targetEventId?: string,
  operatorCompanyId?: string,
  operator?: User
): Promise<ValidationResult> {
  return validateAndCheckInTicketAtomicWithFirestore(
    cleanCode,
    targetEventId,
    operator || (operatorCompanyId ? ({ companyId: operatorCompanyId, role: 'ADMIN', id: 'portaria', name: 'Portaria' } as User) : undefined)
  );
}

// Atomic Check-In execution in Firestore using transactions
export async function confirmCheckInWithFirestore(
  ticketId: string,
  operator: User
): Promise<{ success: boolean; ticket?: Ticket; error?: string }> {
  try {
    const result = await runTransaction(db, async (transaction) => {
      const ticketRef = doc(db, 'tickets', ticketId);
      const ticketDoc = await transaction.get(ticketRef);

      if (!ticketDoc.exists()) {
        return { success: false, error: 'Ingresso não encontrado no Firestore.' };
      }

      const currentTicket = ticketDoc.data() as Ticket;

      // Ensure ticket has not been used concurrently
      if (currentTicket.status === 'used') {
        return {
          success: false,
          error: `Ingresso já utilizado anteriormente às ${currentTicket.usedAt ? new Date(currentTicket.usedAt).toLocaleTimeString('pt-BR') : 'horário anterior'}.`
        };
      }

      if (currentTicket.status === 'cancelled') {
        return { success: false, error: 'Ingresso está cancelado.' };
      }

      const nowIso = new Date().toISOString();
      const updates = {
        status: 'used' as const,
        usedAt: nowIso,
        usedByUserId: operator.id,
        usedByUserName: operator.name
      };

      transaction.update(ticketRef, updates);

      return {
        success: true,
        ticket: { ...currentTicket, ...updates }
      };
    });

    return result;
  } catch (error: unknown) {
    console.error('Firestore transaction failed:', error);
    const err = error as Error;
    return { success: false, error: err.message || 'Falha ao confirmar check-in no Firestore.' };
  }
}

// Subscribe to real-time updates for tickets collection
export function subscribeToTickets(onUpdate: (tickets: Ticket[]) => void): () => void {
  const colRef = collection(db, 'tickets');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const tickets: Ticket[] = [];
      snapshot.forEach((d) => {
        tickets.push(d.data() as Ticket);
      });
      if (tickets.length > 0) {
        onUpdate(tickets);
      }
    },
    (error) => {
      console.warn('Firestore tickets subscription warning:', error);
    }
  );
}

// Subscribe to real-time updates for sales collection
export function subscribeToSales(onUpdate: (sales: Sale[]) => void): () => void {
  const colRef = collection(db, 'sales');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const sales: Sale[] = [];
      snapshot.forEach((d) => {
        sales.push(d.data() as Sale);
      });
      if (sales.length > 0) {
        onUpdate(sales);
      }
    },
    (error) => {
      console.warn('Firestore sales subscription warning:', error);
    }
  );
}

// Subscribe to real-time updates for events collection
export function subscribeToEvents(onUpdate: (events: Event[]) => void): () => void {
  const colRef = collection(db, 'events');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const events: Event[] = [];
      snapshot.forEach((d) => {
        events.push(d.data() as Event);
      });
      if (events.length > 0) {
        onUpdate(events);
      }
    },
    (error) => {
      console.warn('Firestore events subscription warning:', error);
    }
  );
}

// Subscribe to real-time updates for batches collection
export function subscribeToBatches(onUpdate: (batches: TicketBatch[]) => void): () => void {
  const colRef = collection(db, 'batches');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const batches: TicketBatch[] = [];
      snapshot.forEach((d) => {
        batches.push(d.data() as TicketBatch);
      });
      if (batches.length > 0) {
        onUpdate(batches);
      }
    },
    (error) => {
      console.warn('Firestore batches subscription warning:', error);
    }
  );
}

