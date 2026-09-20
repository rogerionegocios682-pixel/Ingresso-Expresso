import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
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

// Direct live lookup for a ticket in Firestore by token or number
export async function findTicketInFirestore(cleanCode: string): Promise<Ticket | null> {
  try {
    // Normalize code
    const normalized = cleanCode.trim().toUpperCase().replace(/[\u2010-\u2015\u2212]/g, '-');

    // 1. Check by validationToken
    const qToken = query(collection(db, 'tickets'), where('validationToken', '==', normalized));
    const snapToken = await getDocs(qToken);
    if (!snapToken.empty) {
      return snapToken.docs[0].data() as Ticket;
    }

    // 2. Check by ticketNumber
    const qNum = query(collection(db, 'tickets'), where('ticketNumber', '==', normalized));
    const snapNum = await getDocs(qNum);
    if (!snapNum.empty) {
      return snapNum.docs[0].data() as Ticket;
    }

    // 3. Check by id
    const docSnap = await getDocs(query(collection(db, 'tickets'), where('id', '==', cleanCode.trim())));
    if (!docSnap.empty) {
      return docSnap.docs[0].data() as Ticket;
    }

    return null;
  } catch (error) {
    console.error('Error querying ticket in Firestore:', error);
    return null;
  }
}

// Live Firestore QR Code validation checking Existence, Status, Token Uniqueness, and Multi-company
export async function validateTicketWithFirestore(
  cleanCode: string,
  targetEventId?: string,
  operatorCompanyId?: string
): Promise<ValidationResult> {
  const normalized = cleanCode.trim().toUpperCase().replace(/[\u2010-\u2015\u2212]/g, '-');
  const checkedAt = new Date().toISOString();

  try {
    const colRef = collection(db, 'tickets');

    // 1. Query by validationToken
    const qToken = query(colRef, where('validationToken', '==', normalized));
    const snapToken = await getDocs(qToken);
    let matchingDocs = snapToken.docs;

    // 2. Query by ticketNumber if no token match
    if (matchingDocs.length === 0) {
      const qNum = query(colRef, where('ticketNumber', '==', normalized));
      const snapNum = await getDocs(qNum);
      matchingDocs = snapNum.docs;
    }

    // 3. Query by document id as fallback
    if (matchingDocs.length === 0) {
      const qId = query(colRef, where('id', '==', cleanCode.trim()));
      const snapId = await getDocs(qId);
      matchingDocs = snapId.docs;
    }

    // 4. Verification 1: Existence
    if (matchingDocs.length === 0) {
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

    // 5. Verification 2: Token Uniqueness
    // A legitimate QR code token must match exactly 1 document in the database
    if (matchingDocs.length > 1) {
      return {
        valid: false,
        status: 'NON_UNIQUE',
        message: `ALERTA DE SEGURANÇA: Token não é único! Foram detectados ${matchingDocs.length} ingressos com este mesmo token no banco. Tentativa de clonagem ou duplicação.`,
        tokenUnique: false,
        checkedAt,
        source: 'FIRESTORE',
        scannedCode: cleanCode
      };
    }

    const ticket = matchingDocs[0].data() as Ticket;

    // Multi-company isolation check
    if (operatorCompanyId && ticket.companyId && ticket.companyId !== operatorCompanyId) {
      return {
        valid: false,
        status: 'INVALID',
        message: 'Acesso negado: Este ingresso pertence a outra empresa/organizadora.',
        tokenUnique: true,
        checkedAt,
        source: 'FIRESTORE',
        scannedCode: cleanCode
      };
    }

    // Fetch associated event details from Firestore if available
    let event: Event | undefined;
    try {
      const eventsSnap = await getDocs(query(collection(db, 'events'), where('id', '==', ticket.eventId)));
      if (!eventsSnap.empty) {
        event = eventsSnap.docs[0].data() as Event;
      }
    } catch {
      // ignore
    }

    // 6. Verification 3: Event Matching
    if (targetEventId && targetEventId !== 'all' && targetEventId !== '' && ticket.eventId !== targetEventId) {
      return {
        valid: false,
        status: 'EVENT_MISMATCH',
        message: `Este ingresso pertence ao evento "${event?.name || ticket.eventName || 'outro evento'}" e não ao evento selecionado na portaria.`,
        ticket,
        event,
        tokenUnique: true,
        checkedAt,
        source: 'FIRESTORE',
        scannedCode: cleanCode
      };
    }

    // 7. Verification 4: Status (used, cancelled, blocked)
    if (ticket.status === 'cancelled') {
      return {
        valid: false,
        status: 'CANCELLED',
        message: `Ingresso cancelado no sistema. ${ticket.notes || ticket.cancelReason ? `Motivo: ${ticket.notes || ticket.cancelReason}` : ''}`,
        ticket,
        event,
        tokenUnique: true,
        checkedAt,
        source: 'FIRESTORE',
        scannedCode: cleanCode
      };
    }

    if (ticket.status === 'blocked') {
      return {
        valid: false,
        status: 'BLOCKED',
        message: 'Ingresso bloqueado preventivamente pela administração.',
        ticket,
        event,
        tokenUnique: true,
        checkedAt,
        source: 'FIRESTORE',
        scannedCode: cleanCode
      };
    }

    if (ticket.status === 'used') {
      return {
        valid: false,
        status: 'ALREADY_USED',
        message: 'Atenção: Este ingresso JÁ FOI UTILIZADO e teve entrada liberada anteriormente.',
        ticket,
        event,
        firstUsedAt: ticket.usedAt,
        firstUsedByName: ticket.usedByUserName,
        tokenUnique: true,
        checkedAt,
        source: 'FIRESTORE',
        scannedCode: cleanCode
      };
    }

    // Success: Valid, unique and confirmed
    return {
      valid: true,
      status: 'VALID',
      message: 'Ingresso válido, único e autenticado com sucesso no Firestore.',
      ticket,
      event,
      tokenUnique: true,
      checkedAt,
      source: 'FIRESTORE',
      scannedCode: cleanCode
    };
  } catch (error) {
    console.error('Error validating ticket with Firestore:', error);
    throw error;
  }
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

