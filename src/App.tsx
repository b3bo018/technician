import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  increment, 
  addDoc 
} from 'firebase/firestore';
import { 
  ClipboardList, 
  FileSpreadsheet, 
  CheckCircle2, 
  Zap, 
  Loader2 
} from 'lucide-react';
import { auth, db } from './lib/firebase';
import { 
  Installation, 
  TechnicianUser, 
  VanInventory, 
  DEFAULT_INVENTORY,
  CustomerOption,
  DEFAULT_CUSTOMERS 
} from './types';
import { 
  enqueueInstallation, 
  getQueuedInstallations, 
  syncQueuedInstallations 
} from './lib/offlineQueue';

// Components
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { StatusBar } from './components/StatusBar';
import { InstallationForm } from './components/InstallationForm';
import { InstallationHistory } from './components/InstallationHistory';
import { ImeiScannerModal } from './components/ImeiScannerModal';
import { InventoryModal } from './components/InventoryModal';
import { AdminDashboard } from './components/AdminDashboard';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [localUserSession, setLocalUserSession] = useState<{
    uid: string;
    email: string;
    role: 'admin' | 'technician';
    inventory_count: number;
    inventory_breakdown?: VanInventory;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('securetrack_local_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<TechnicianUser | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [installationsLoading, setInstallationsLoading] = useState<boolean>(true);

  // Customers state (shared across app & ready for imported customer lists)
  const [customers, setCustomers] = useState<CustomerOption[]>(() => {
    try {
      const saved = localStorage.getItem('securetrack_customers_cache');
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOMERS;
    } catch {
      return DEFAULT_CUSTOMERS;
    }
  });

  // Scanner Modal & Target state (IMEI or SIM)
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerTarget, setScannerTarget] = useState<'imei' | 'sim'>('imei');
  const [scannedImei, setScannedImei] = useState<string>('');
  const [scannedSim, setScannedSim] = useState<string>('');

  // Inventory Modal
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState<boolean>(false);

  // Connectivity state for PWA offline detection
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Offline queue state
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Admin View state
  const [isAdminViewOpen, setIsAdminViewOpen] = useState<boolean>(false);

  // PWA beforeinstallprompt handler
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Active view tab for mobile ergonomics
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Load offline queue counter
  const refreshQueueCount = useCallback(async () => {
    try {
      const queued = await getQueuedInstallations();
      const activePending = queued.filter((i) => i.status === 'queued' || i.status === 'failed');
      setPendingQueueCount(activePending.length);
    } catch (e) {
      console.warn('Error reading offline queue:', e);
    }
  }, []);

  // Trigger offline data synchronization to Firestore
  const handleTriggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncingOffline) return;
    setIsSyncingOffline(true);
    try {
      const result = await syncQueuedInstallations();
      if (result.syncedCount > 0 || result.duplicatesSkipped > 0) {
        setSyncNotice(
          `Sync Complete: ${result.syncedCount} queued installation(s) saved to cloud${
            result.duplicatesSkipped > 0 ? ` (${result.duplicatesSkipped} duplicate prevented)` : ''
          }.`
        );
        setTimeout(() => setSyncNotice(null), 5000);
      }
      await refreshQueueCount();
    } catch (err: unknown) {
      console.warn('Auto-sync notice:', err);
    } finally {
      setIsSyncingOffline(false);
    }
  }, [isSyncingOffline, refreshQueueCount]);

  // Online / Offline listeners & PWA Install Prompt Listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleTriggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Initial check of offline queue
    refreshQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [handleTriggerSync, refreshQueueCount]);

  // Listen for Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Effective user ID & email (supports Firebase auth or fallback local session)
  const activeUid = currentUser?.uid || localUserSession?.uid;
  const activeEmail = currentUser?.email || localUserSession?.email || 'itsecuretrack@gmail.com';

  // Sync Technician Profile from 'users' collection in real-time
  useEffect(() => {
    if (!activeUid) {
      setUserProfile(null);
      return;
    }

    const userDocRef = doc(db, 'users', activeUid);

    const unsubscribe = onSnapshot(
      userDocRef,
      async (docSnap) => {
        const isAdminEmail = activeEmail.toLowerCase() === 'itsecuretrack@gmail.com' ||
                             activeEmail.toLowerCase() === 'admin@securetrack.com' ||
                             localUserSession?.role === 'admin';

        if (docSnap.exists()) {
          const data = docSnap.data();
          const fmc920 = data.inventory_breakdown?.fmc920 ?? 15;
          const fmc130 = data.inventory_breakdown?.fmc130 ?? 15;
          const simCards = data.inventory_breakdown?.sim_cards ?? 30;
          const relays = data.inventory_breakdown?.relays ?? 20;

          setUserProfile({
            uid: activeUid,
            email: data.email || activeEmail,
            role: data.role || (isAdminEmail ? 'admin' : 'technician'),
            inventory_count: fmc920 + fmc130,
            inventory_breakdown: {
              fmc920,
              fmc130,
              sim_cards: simCards,
              relays
            },
            displayName: data.displayName,
            created_at: data.created_at
          });
        } else {
          // Initialize user profile in Firestore
          const initialData: TechnicianUser = {
            uid: activeUid,
            email: activeEmail,
            role: isAdminEmail ? 'admin' : 'technician',
            inventory_count: 30,
            inventory_breakdown: DEFAULT_INVENTORY,
            created_at: new Date().toISOString()
          };
          try {
            await setDoc(userDocRef, initialData);
            setUserProfile(initialData);
          } catch (e) {
            console.warn('Unable to initialize user document (local mode fallback active):', e);
            setUserProfile(initialData);
          }
        }
      },
      (error) => {
        console.warn('User profile snapshot warning (offline mode enabled):', error);
      }
    );

    return () => unsubscribe();
  }, [activeUid, activeEmail, localUserSession?.role]);

  // Sync installations for current technician
  useEffect(() => {
    if (!activeUid) {
      setInstallations([]);
      setInstallationsLoading(false);
      return;
    }

    const installationsQuery = query(
      collection(db, 'installations'),
      where('tech_id', '==', activeUid)
    );

    const unsubscribe = onSnapshot(
      installationsQuery,
      async (snapshot) => {
        const records: Installation[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          records.push({
            id: docSnap.id,
            tech_id: data.tech_id,
            tech_email: data.tech_email,
            customer_name: data.customer_name,
            device_type: data.device_type,
            imei: data.imei,
            sim_number: data.sim_number || '',
            relay_installed: Boolean(data.relay_installed),
            timestamp: data.timestamp,
            notes: data.notes
          });
        });

        // Incorporate any un-synced offline queued items
        try {
          const queued = await getQueuedInstallations();
          const techQueued = queued.filter(
            (q) => q.tech_id === activeUid && (q.status === 'queued' || q.status === 'failed')
          );
          for (const q of techQueued) {
            if (!records.some((r) => r.imei === q.imei)) {
              records.push({
                id: q.localId,
                tech_id: q.tech_id,
                tech_email: q.tech_email,
                customer_name: q.customer_name,
                device_type: q.device_type,
                imei: q.imei,
                sim_number: q.sim_number || '',
                relay_installed: Boolean(q.relay_installed),
                timestamp: q.timestamp,
                notes: q.notes ? `${q.notes} (Pending Offline Sync)` : '(Pending Offline Sync)'
              });
            }
          }
        } catch (e) {
          console.warn('Error reading offline queue for history:', e);
        }

        // Sort descending by timestamp
        records.sort((a, b) => {
          const dateA = new Date(a.timestamp).getTime() || 0;
          const dateB = new Date(b.timestamp).getTime() || 0;
          return dateB - dateA;
        });

        setInstallations(records);
        setInstallationsLoading(false);
      },
      (error) => {
        console.warn('Installations query snapshot warning (offline mode enabled):', error);
        setInstallationsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeUid]);

  // Is current user an admin?
  const isUserAdmin = useMemo(() => {
    return (
      userProfile?.role === 'admin' ||
      activeEmail.toLowerCase() === 'itsecuretrack@gmail.com' ||
      activeEmail.toLowerCase() === 'admin@securetrack.com' ||
      localUserSession?.role === 'admin'
    );
  }, [userProfile, activeEmail, localUserSession]);

  // Calculate Real-Time Metrics
  const dailyTotal = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return installations.filter((item) => {
      try {
        const itemDateStr = new Date(item.timestamp).toISOString().slice(0, 10);
        return itemDateStr === todayStr;
      } catch {
        return false;
      }
    }).length;
  }, [installations]);

  const inventoryBreakdown: VanInventory = userProfile?.inventory_breakdown ||
    localUserSession?.inventory_breakdown ||
    DEFAULT_INVENTORY;

  const inventoryRemaining = (inventoryBreakdown.fmc920 || 0) + (inventoryBreakdown.fmc130 || 0);

  // Handle Installation Submission with Robust Teltonika & SIM Tracking
  const handleRecordInstallation = async (formData: {
    customer_name: string;
    device_type: string;
    imei: string;
    sim_number: string;
    relay_installed?: boolean;
    notes?: string;
  }) => {
    if (!activeUid) throw new Error('You must be signed in to log installations.');

    const timestamp = new Date().toISOString();
    const isFmc130 = formData.device_type.toLowerCase().includes('130');

    // Optimistic local stock update function
    const applyOptimisticStock = () => {
      setUserProfile((prev) => {
        if (!prev) return null;
        const oldBd = prev.inventory_breakdown || DEFAULT_INVENTORY;
        const newBd: VanInventory = {
          fmc920: isFmc130 ? oldBd.fmc920 : Math.max(0, oldBd.fmc920 - 1),
          fmc130: isFmc130 ? Math.max(0, oldBd.fmc130 - 1) : oldBd.fmc130,
          sim_cards: Math.max(0, oldBd.sim_cards - 1),
          relays: formData.relay_installed ? Math.max(0, oldBd.relays - 1) : oldBd.relays
        };
        return {
          ...prev,
          inventory_count: newBd.fmc920 + newBd.fmc130,
          inventory_breakdown: newBd
        };
      });
    };

    // 1. If currently offline, queue into localForage directly
    if (!navigator.onLine) {
      const { item, isDuplicate } = await enqueueInstallation({
        tech_id: activeUid,
        tech_email: activeEmail,
        customer_name: formData.customer_name,
        device_type: formData.device_type,
        imei: formData.imei,
        sim_number: formData.sim_number,
        relay_installed: formData.relay_installed,
        timestamp: timestamp,
        notes: formData.notes || ''
      });

      if (isDuplicate) {
        throw new Error(`Device with IMEI ${formData.imei} is already pending in your offline sync queue.`);
      }

      applyOptimisticStock();

      setInstallations((prev) => [
        {
          id: item.localId,
          tech_id: activeUid,
          tech_email: activeEmail,
          customer_name: formData.customer_name,
          device_type: formData.device_type,
          imei: formData.imei,
          sim_number: formData.sim_number,
          relay_installed: formData.relay_installed,
          timestamp: timestamp,
          notes: formData.notes ? `${formData.notes} (Offline)` : '(Offline Queue)'
        },
        ...prev
      ]);

      await refreshQueueCount();
      return;
    }

    // 2. When online, attempt immediate Firestore commit with offline queue fallback
    try {
      await addDoc(collection(db, 'installations'), {
        tech_id: activeUid,
        tech_email: activeEmail,
        customer_name: formData.customer_name,
        device_type: formData.device_type,
        imei: formData.imei,
        sim_number: formData.sim_number,
        relay_installed: Boolean(formData.relay_installed),
        timestamp: timestamp,
        notes: formData.notes || ''
      });

      // Decrement technician hardware, SIM, and relay
      const userDocRef = doc(db, 'users', activeUid);
      const updatePayload: Record<string, any> = {
        inventory_count: increment(-1),
        'inventory_breakdown.sim_cards': increment(-1)
      };
      if (isFmc130) {
        updatePayload['inventory_breakdown.fmc130'] = increment(-1);
      } else {
        updatePayload['inventory_breakdown.fmc920'] = increment(-1);
      }
      if (formData.relay_installed) {
        updatePayload['inventory_breakdown.relays'] = increment(-1);
      }

      await updateDoc(userDocRef, updatePayload);
      applyOptimisticStock();
    } catch (networkOrWriteErr) {
      console.warn('Direct Firestore write failed, saving to localForage offline queue:', networkOrWriteErr);

      await enqueueInstallation({
        tech_id: activeUid,
        tech_email: activeEmail,
        customer_name: formData.customer_name,
        device_type: formData.device_type,
        imei: formData.imei,
        sim_number: formData.sim_number,
        relay_installed: formData.relay_installed,
        timestamp: timestamp,
        notes: formData.notes || ''
      });

      applyOptimisticStock();
      await refreshQueueCount();
    }
  };

  // Handle Multi-Item Stock Restock / Update
  const handleUpdateInventory = async (newBreakdown: VanInventory) => {
    if (!activeUid) return;

    const totalDevs = (newBreakdown.fmc920 || 0) + (newBreakdown.fmc130 || 0);

    setUserProfile((prev) =>
      prev
        ? {
            ...prev,
            inventory_count: totalDevs,
            inventory_breakdown: newBreakdown
          }
        : null
    );

    try {
      const userDocRef = doc(db, 'users', activeUid);
      await updateDoc(userDocRef, {
        inventory_count: totalDevs,
        inventory_breakdown: newBreakdown
      });
    } catch (e) {
      console.warn('Inventory count update saved locally (offline):', e);
    }
  };

  // Customer Management Helpers
  const handleAddNewCustomer = (newCust: CustomerOption) => {
    setCustomers((prev) => {
      const updated = [newCust, ...prev];
      localStorage.setItem('securetrack_customers_cache', JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateCustomers = (newList: CustomerOption[]) => {
    setCustomers(newList);
    localStorage.setItem('securetrack_customers_cache', JSON.stringify(newList));
  };

  // Trigger PWA Installation
  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch {
      // Prompt dismissed
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      localStorage.removeItem('securetrack_local_session');
      setLocalUserSession(null);
      await signOut(auth);
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  // Handle instant local session login (for quick testing / offline fallback)
  const handleLocalSessionLogin = (email: string, role: 'admin' | 'technician') => {
    const session = {
      uid: role === 'admin' ? 'admin_itsecuretrack' : 'tech_field_01',
      email: email,
      role: role,
      inventory_count: 30,
      inventory_breakdown: DEFAULT_INVENTORY
    };
    localStorage.setItem('securetrack_local_session', JSON.stringify(session));
    setLocalUserSession(session);
    if (role === 'admin') {
      setIsAdminViewOpen(true);
    }
  };

  // Loading Screen
  if (authLoading && !localUserSession) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="w-9 h-9 animate-spin text-emerald-500 mb-3" />
        <p className="text-sm font-medium tracking-wide">Initializing SECURE TRACK Terminal...</p>
      </div>
    );
  }

  // If Not Authenticated, show Login Screen
  if (!currentUser && !localUserSession) {
    return <LoginScreen onLocalSessionLogin={handleLocalSessionLogin} />;
  }

  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar with SECURE TRACK Branding, Offline Sync Status & Admin Switcher */}
      <Navbar
        techEmail={activeEmail}
        role={isUserAdmin ? 'admin' : 'technician'}
        isOnline={isOnline}
        onLogout={handleLogout}
        canInstallPwa={Boolean(deferredPrompt)}
        onInstallPwa={handleInstallPwa}
        pendingOfflineCount={pendingQueueCount}
        isSyncingOffline={isSyncingOffline}
        onTriggerSync={handleTriggerSync}
        isAdminViewOpen={isAdminViewOpen}
        onToggleAdminView={() => setIsAdminViewOpen(!isAdminViewOpen)}
      />

      {/* Admin Dashboard View (Accessible to Admin role) */}
      {isAdminViewOpen && isUserAdmin ? (
        <AdminDashboard
          adminEmail={activeEmail}
          onExitAdminView={() => setIsAdminViewOpen(false)}
          customers={customers}
          onUpdateCustomers={handleUpdateCustomers}
        />
      ) : (
        /* Field Technician Mobile-First Main View */
        <main className="flex-1 w-full max-w-lg mx-auto px-3.5 sm:px-4 py-4 space-y-4">
          {/* Offline Sync Success Banner */}
          {syncNotice && (
            <div className="flex items-center space-x-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 p-3 text-xs text-emerald-200 animate-fadeIn shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1 font-medium">{syncNotice}</span>
            </div>
          )}

          {/* Offline Queue Notice Banner when items are pending */}
          {!isOnline && pendingQueueCount > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-amber-950/70 border border-amber-600/40 p-3 text-xs text-amber-200">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Offline Mode Active:</strong> {pendingQueueCount} installation(s) saved locally via localForage.
                </span>
              </div>
            </div>
          )}

          {/* PWA Install Banner */}
          <PwaInstallPrompt
            canInstallPrompt={Boolean(deferredPrompt)}
            onInstall={handleInstallPwa}
          />

          {/* Real-time Status Bar (Daily Total & Multi-Item Van Hardware) */}
          <StatusBar
            dailyTotal={dailyTotal}
            inventoryRemaining={inventoryRemaining}
            inventoryBreakdown={inventoryBreakdown}
            allTimeTotal={installations.length}
            onOpenRestock={() => setIsInventoryModalOpen(true)}
          />

          {/* Mobile Navigation Segmented Control */}
          <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 shadow-inner">
            <button
              id="tab-new-install"
              type="button"
              onClick={() => setActiveTab('form')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all ${
                activeTab === 'form'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Log Install</span>
            </button>
            <button
              id="tab-history-reports"
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>History ({installations.length})</span>
            </button>
          </div>

          {/* Tab 1: Installation Form */}
          {activeTab === 'form' && (
            <div className="space-y-4 animate-fadeIn">
              <InstallationForm
                techUid={activeUid}
                techEmail={activeEmail}
                inventoryRemaining={inventoryRemaining}
                inventoryBreakdown={inventoryBreakdown}
                customers={customers}
                onAddNewCustomer={handleAddNewCustomer}
                onSubmitInstallation={handleRecordInstallation}
                onOpenScanner={() => {
                  setScannerTarget('imei');
                  setIsScannerOpen(true);
                }}
                onOpenSimScanner={() => {
                  setScannerTarget('sim');
                  setIsScannerOpen(true);
                }}
                scannedImei={scannedImei}
                scannedSim={scannedSim}
                onClearScannedImei={() => setScannedImei('')}
                onClearScannedSim={() => setScannedSim('')}
                onOpenRestock={() => setIsInventoryModalOpen(true)}
              />
            </div>
          )}

          {/* Tab 2: Installation History & Excel Reporting */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-fadeIn">
              <InstallationHistory
                installations={installations}
                techEmail={activeEmail}
                isLoading={installationsLoading}
                onUpdateSimNumber={(id, newSim) => {
                  setInstallations((prev) =>
                    prev.map((inst) => (inst.id === id ? { ...inst, sim_number: newSim } : inst))
                  );
                }}
              />
            </div>
          )}
        </main>
      )}

      {/* Barcode Camera Scanner Modal (Supports both Teltonika IMEI & SIM Barcodes) */}
      <ImeiScannerModal
        isOpen={isScannerOpen}
        title={scannerTarget === 'sim' ? 'Scan SIM Barcode / ICCID' : 'Scan Teltonika IMEI'}
        subtitle={
          scannerTarget === 'sim'
            ? 'Align SIM card barcode or ICCID in frame'
            : 'Align 15-digit Teltonika barcode in frame'
        }
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(detectedVal) => {
          if (scannerTarget === 'sim') {
            setScannedSim(detectedVal);
          } else {
            setScannedImei(detectedVal);
          }
          setActiveTab('form');
        }}
      />

      {/* Multi-Item Van Stock Restock / Inventory Adjustment Modal */}
      <InventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        currentBreakdown={inventoryBreakdown}
        onUpdateInventory={handleUpdateInventory}
      />
    </div>
  );
}
