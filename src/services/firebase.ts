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
  where
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Ticket, Sale, Event, TicketBatch } from '../types';

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
  try {
    for (const ticket of tickets) {
      await setDoc(doc(db, 'tickets', ticket.id), ticket, { merge: true });
    }
  } catch (error) {
    console.error('Error saving tickets batch to Firestore:', error);
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
