import localforage from 'localforage';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  increment, 
  doc, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from './firebase';

export interface QueuedInstallation {
  localId: string;
  tech_id: string;
  tech_email: string;
  customer_name: string;
  device_type: string;
  imei: string;
  sim_number: string;
  relay_installed?: boolean;
  timestamp: string;
  notes?: string;
  queuedAt: string;
  status: 'queued' | 'syncing' | 'synced' | 'failed';
  error?: string;
}

const QUEUE_STORAGE_KEY = 'securetrack_offline_queue_v1';

// Configure localforage instance
const queueStore = localforage.createInstance({
  name: 'SecureTrackPWA',
  storeName: 'installation_queue',
  description: 'Queued technician installations stored while offline'
});

/**
 * Retrieve all items in the offline queue
 */
export async function getQueuedInstallations(): Promise<QueuedInstallation[]> {
  try {
    const items = await queueStore.getItem<QueuedInstallation[]>(QUEUE_STORAGE_KEY);
    return items || [];
  } catch (err) {
    console.error('Failed to read offline queue from localforage:', err);
    return [];
  }
}

/**
 * Save updated queue items to local storage
 */
async function saveQueue(items: QueuedInstallation[]): Promise<void> {
  try {
    await queueStore.setItem(QUEUE_STORAGE_KEY, items);
  } catch (err) {
    console.error('Failed to save offline queue to localforage:', err);
  }
}

/**
 * Queue a new installation when offline or as pre-sync buffer.
 * Handles duplicate detection gracefully by checking existing IMEI & tech_id.
 */
export async function enqueueInstallation(
  record: Omit<QueuedInstallation, 'localId' | 'queuedAt' | 'status'>
): Promise<{ item: QueuedInstallation; isDuplicate: boolean }> {
  const currentQueue = await getQueuedInstallations();

  // Check if identical IMEI is already queued by this technician
  const existingIndex = currentQueue.findIndex(
    (item) => item.imei === record.imei && item.tech_id === record.tech_id
  );

  if (existingIndex !== -1) {
    const existing = currentQueue[existingIndex];
    if (existing.status === 'queued' || existing.status === 'syncing') {
      return { item: existing, isDuplicate: true };
    }
  }

  const newItem: QueuedInstallation = {
    ...record,
    localId: `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    queuedAt: new Date().toISOString(),
    status: 'queued'
  };

  currentQueue.unshift(newItem);
  await saveQueue(currentQueue);

  return { item: newItem, isDuplicate: false };
}

/**
 * Synchronize all queued installations with Firestore.
 * Ensures duplicates in Firestore are checked before adding.
 */
export async function syncQueuedInstallations(
  onItemSynced?: (item: QueuedInstallation) => void
): Promise<{ syncedCount: number; failedCount: number; duplicatesSkipped: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0, duplicatesSkipped: 0 };
  }

  const queue = await getQueuedInstallations();
  const pendingItems = queue.filter((item) => item.status === 'queued' || item.status === 'failed');

  if (pendingItems.length === 0) {
    return { syncedCount: 0, failedCount: 0, duplicatesSkipped: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;
  let duplicatesSkipped = 0;

  for (const item of pendingItems) {
    item.status = 'syncing';
    await saveQueue(queue);

    try {
      // 1. Duplicate check in Firestore by IMEI and tech_id
      const dupQuery = query(
        collection(db, 'installations'),
        where('tech_id', '==', item.tech_id),
        where('imei', '==', item.imei)
      );

      let alreadyInFirestore = false;
      try {
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) {
          alreadyInFirestore = true;
        }
      } catch (checkErr) {
        console.warn('Duplicate check query warning:', checkErr);
      }

      if (alreadyInFirestore) {
        // Mark as synced to skip repeated processing
        item.status = 'synced';
        item.error = 'Already synchronized (duplicate prevented)';
        duplicatesSkipped++;
      } else {
        // 2. Commit to Firestore installations collection
        await addDoc(collection(db, 'installations'), {
          tech_id: item.tech_id,
          tech_email: item.tech_email,
          customer_name: item.customer_name,
          device_type: item.device_type,
          imei: item.imei,
          sim_number: item.sim_number || '',
          relay_installed: Boolean(item.relay_installed),
          timestamp: item.timestamp,
          notes: item.notes || '',
          syncedFromOfflineQueue: true,
          offlineQueuedAt: item.queuedAt
        });

        // 3. Decrement inventory count in technician profile
        try {
          const userDocRef = doc(db, 'users', item.tech_id);
          const updatePayload: Record<string, any> = {
            inventory_count: increment(-1),
            'inventory_breakdown.sim_cards': increment(-1)
          };
          if (item.device_type.toLowerCase().includes('130')) {
            updatePayload['inventory_breakdown.fmc130'] = increment(-1);
          } else {
            updatePayload['inventory_breakdown.fmc920'] = increment(-1);
          }
          if (item.relay_installed) {
            updatePayload['inventory_breakdown.relays'] = increment(-1);
          }
          await updateDoc(userDocRef, updatePayload);
        } catch (invErr) {
          console.warn('Inventory decrement warning during sync:', invErr);
        }

        item.status = 'synced';
        syncedCount++;
      }

      if (onItemSynced) {
        onItemSynced(item);
      }
    } catch (err: unknown) {
      console.error('Error syncing queued item:', err);
      item.status = 'failed';
      item.error = err instanceof Error ? err.message : 'Sync failed';
      failedCount++;
    }
  }

  // Retain recent synced records (up to 30) for history/audit, remove older ones
  const filtered = queue.filter(
    (item) => item.status !== 'synced' || Date.now() - new Date(item.queuedAt).getTime() < 86400000
  );
  await saveQueue(filtered);

  return { syncedCount, failedCount, duplicatesSkipped };
}

/**
 * Remove a single item from the queue
 */
export async function removeQueuedItem(localId: string): Promise<void> {
  const queue = await getQueuedInstallations();
  const updated = queue.filter((i) => i.localId !== localId);
  await saveQueue(updated);
}
