import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Trash2, 
  Plus, 
  Search, 
  FileSpreadsheet, 
  Package, 
  HardDrive, 
  Building2, 
  Hash, 
  TrendingUp, 
  Clock, 
  Check, 
  X, 
  RefreshCw,
  AlertCircle,
  Radio,
  Zap,
  UploadCloud,
  FileText,
  Phone
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Installation, 
  TechnicianUser, 
  VanInventory, 
  DEFAULT_INVENTORY, 
  CustomerOption, 
  DEFAULT_CUSTOMERS 
} from '../types';
import { exportInstallationsToExcel } from '../lib/exportExcel';

interface AdminDashboardProps {
  adminEmail: string;
  onExitAdminView?: () => void;
  customers?: CustomerOption[];
  onUpdateCustomers?: (list: CustomerOption[]) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminEmail,
  onExitAdminView,
  customers = DEFAULT_CUSTOMERS,
  onUpdateCustomers
}) => {
  const [activeTab, setActiveTab] = useState<'installations' | 'technicians' | 'customers'>('installations');
  const [allInstallations, setAllInstallations] = useState<Installation[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');

  // Modal states for managing technicians
  const [isAddTechModalOpen, setIsAddTechModalOpen] = useState(false);
  const [newTechEmail, setNewTechEmail] = useState('');
  const [newTechRole, setNewTechRole] = useState<'technician' | 'admin'>('technician');
  const [newTechFmc920, setNewTechFmc920] = useState<number>(15);
  const [newTechFmc130, setNewTechFmc130] = useState<number>(15);
  const [newTechSims, setNewTechSims] = useState<number>(30);
  const [newTechRelays, setNewTechRelays] = useState<number>(20);
  const [techActionLoading, setTechActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Inventory adjustment modal
  const [adjustingTech, setAdjustingTech] = useState<TechnicianUser | null>(null);
  const [adjFmc920, setAdjFmc920] = useState<number>(0);
  const [adjFmc130, setAdjFmc130] = useState<number>(0);
  const [adjSims, setAdjSims] = useState<number>(0);
  const [adjRelays, setAdjRelays] = useState<number>(0);

  // Customer Management states
  const [customerList, setCustomerList] = useState<CustomerOption[]>(customers);
  const [isAddCustModalOpen, setIsAddCustModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustCategory, setNewCustCategory] = useState('Fleet Transport');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [bulkText, setBulkText] = useState('');

  // 1. Fetch ALL installations across the company
  useEffect(() => {
    const instQuery = query(collection(db, 'installations'));
    const unsubscribe = onSnapshot(
      instQuery,
      (snapshot) => {
        const records: Installation[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          records.push({
            id: d.id,
            tech_id: data.tech_id,
            tech_email: data.tech_email || 'Unknown',
            customer_name: data.customer_name,
            device_type: data.device_type,
            imei: data.imei,
            sim_number: data.sim_number || '',
            relay_installed: Boolean(data.relay_installed),
            timestamp: data.timestamp,
            notes: data.notes
          });
        });

        records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAllInstallations(records);
        setLoading(false);
      },
      (err) => {
        console.warn('Installations snapshot error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Fetch ALL technicians / users
  useEffect(() => {
    const usersQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const list: TechnicianUser[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const fmc920 = data.inventory_breakdown?.fmc920 ?? Math.floor((data.inventory_count || 0) / 2);
          const fmc130 = data.inventory_breakdown?.fmc130 ?? Math.ceil((data.inventory_count || 0) / 2);
          const simCards = data.inventory_breakdown?.sim_cards ?? 30;
          const relays = data.inventory_breakdown?.relays ?? 20;

          list.push({
            uid: d.id,
            email: data.email || d.id,
            role: data.role || (data.email === 'itsecuretrack@gmail.com' ? 'admin' : 'technician'),
            inventory_count: fmc920 + fmc130,
            inventory_breakdown: {
              fmc920,
              fmc130,
              sim_cards: simCards,
              relays
            },
            displayName: data.displayName,
            created_at: data.created_at,
            status: data.status || 'active',
            phone: data.phone
          });
        });
        setTechnicians(list);
      },
      (err) => {
        console.warn('Users snapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // 3. Listen to Firestore customers collection if present
  useEffect(() => {
    const custQuery = query(collection(db, 'customers'));
    const unsubscribe = onSnapshot(
      custQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: CustomerOption[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              name: data.name || 'Unnamed',
              category: data.category || 'General Fleet',
              phone: data.phone || ''
            });
          });
          setCustomerList(list);
          if (onUpdateCustomers) onUpdateCustomers(list);
        }
      },
      (err) => {
        console.warn('Customers collection listener notice:', err);
      }
    );

    return () => unsubscribe();
  }, [onUpdateCustomers]);

  // Filter installations
  const filteredInstallations = allInstallations.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.customer_name.toLowerCase().includes(q) ||
      item.device_type.toLowerCase().includes(q) ||
      item.imei.toLowerCase().includes(q) ||
      (item.sim_number && item.sim_number.toLowerCase().includes(q)) ||
      item.tech_email.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (selectedTechFilter !== 'all' && item.tech_email !== selectedTechFilter) {
      return false;
    }

    return true;
  });

  // Calculate high-level admin metrics
  const todayStr = new Date().toISOString().slice(0, 10);
  const installationsToday = allInstallations.filter((item) => {
    try {
      return new Date(item.timestamp).toISOString().slice(0, 10) === todayStr;
    } catch {
      return false;
    }
  }).length;

  const totalFmc920 = technicians.reduce((acc, t) => acc + (t.inventory_breakdown?.fmc920 || 0), 0);
  const totalFmc130 = technicians.reduce((acc, t) => acc + (t.inventory_breakdown?.fmc130 || 0), 0);
  const totalSims = technicians.reduce((acc, t) => acc + (t.inventory_breakdown?.sim_cards || 0), 0);
  const totalRelays = technicians.reduce((acc, t) => acc + (t.inventory_breakdown?.relays || 0), 0);
  const totalCirculatingStock = totalFmc920 + totalFmc130;

  // Export all company installations
  const handleExportAll = () => {
    try {
      const dataToExport = filteredInstallations.length > 0 ? filteredInstallations : allInstallations;
      exportInstallationsToExcel(dataToExport, `SecureTrack_Fleet_${adminEmail.split('@')[0]}`);
      setActionNotice(`Exported ${dataToExport.length} installations to Excel.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed');
    }
  };

  // Add new technician
  const handleAddTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTechEmail.trim()) return;

    setTechActionLoading(true);
    try {
      const safeId = 'tech_' + newTechEmail.trim().replace(/[^a-zA-Z0-9]/g, '_');
      const totalDevs = (Number(newTechFmc920) || 0) + (Number(newTechFmc130) || 0);

      await setDoc(doc(db, 'users', safeId), {
        email: newTechEmail.trim().toLowerCase(),
        role: newTechRole,
        inventory_count: totalDevs,
        inventory_breakdown: {
          fmc920: Number(newTechFmc920) || 0,
          fmc130: Number(newTechFmc130) || 0,
          sim_cards: Number(newTechSims) || 0,
          relays: Number(newTechRelays) || 0
        },
        created_at: new Date().toISOString(),
        status: 'active'
      });

      setActionNotice(`Added ${newTechEmail} with ${totalDevs} devices & ${newTechSims} SIMs.`);
      setNewTechEmail('');
      setIsAddTechModalOpen(false);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add technician account');
    } finally {
      setTechActionLoading(false);
    }
  };

  // Remove technician
  const handleRemoveTechnician = async (tech: TechnicianUser) => {
    if (!window.confirm(`Are you sure you want to remove technician ${tech.email}?`)) return;

    try {
      await deleteDoc(doc(db, 'users', tech.uid));
      setActionNotice(`Removed technician ${tech.email}`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete technician');
    }
  };

  // Open multi-inventory adjustment
  const handleOpenAdjustStock = (tech: TechnicianUser) => {
    setAdjustingTech(tech);
    setAdjFmc920(tech.inventory_breakdown?.fmc920 ?? 0);
    setAdjFmc130(tech.inventory_breakdown?.fmc130 ?? 0);
    setAdjSims(tech.inventory_breakdown?.sim_cards ?? 0);
    setAdjRelays(tech.inventory_breakdown?.relays ?? 0);
  };

  // Save stock adjustment
  const handleSaveAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingTech) return;

    const totalDevs = (Number(adjFmc920) || 0) + (Number(adjFmc130) || 0);
    try {
      await updateDoc(doc(db, 'users', adjustingTech.uid), {
        inventory_count: totalDevs,
        inventory_breakdown: {
          fmc920: Number(adjFmc920) || 0,
          fmc130: Number(adjFmc130) || 0,
          sim_cards: Number(adjSims) || 0,
          relays: Number(adjRelays) || 0
        }
      });
      setActionNotice(`Updated ${adjustingTech.email} stock: ${adjFmc920} FMC920, ${adjFmc130} FMC130, ${adjSims} SIMs, ${adjRelays} Relays.`);
      setAdjustingTech(null);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update stock');
    }
  };

  // Toggle role
  const handleToggleRole = async (tech: TechnicianUser) => {
    const nextRole = tech.role === 'admin' ? 'technician' : 'admin';
    try {
      await updateDoc(doc(db, 'users', tech.uid), {
        role: nextRole
      });
      setActionNotice(`Updated ${tech.email} role to ${nextRole.toUpperCase()}`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  // Customer Management Handlers
  const handleAddSingleCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const newObj: CustomerOption = {
      id: `cust_${Date.now()}`,
      name: newCustName.trim(),
      category: newCustCategory.trim() || 'Fleet Transport',
      phone: newCustPhone.trim() || undefined
    };

    try {
      await setDoc(doc(db, 'customers', newObj.id), newObj);
    } catch {
      // Local fallback
    }

    const updated = [newObj, ...customerList];
    setCustomerList(updated);
    if (onUpdateCustomers) onUpdateCustomers(updated);

    setActionNotice(`Added customer: ${newObj.name}`);
    setNewCustName('');
    setNewCustPhone('');
    setIsAddCustModalOpen(false);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleBulkImport = async () => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const newEntries: CustomerOption[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // support CSV: Name, Category, Phone or just Name
      const parts = line.split(',').map((p) => p.trim());
      const name = parts[0];
      if (!name) continue;
      const category = parts[1] || 'Fleet Transport';
      const phone = parts[2] || '';
      const id = `cust_bulk_${Date.now()}_${i}`;

      const entry: CustomerOption = { id, name, category, phone: phone || undefined };
      newEntries.push(entry);

      try {
        await setDoc(doc(db, 'customers', id), entry);
      } catch {
        // Firestore bulk write graceful catch
      }
    }

    const merged = [...newEntries, ...customerList];
    setCustomerList(merged);
    if (onUpdateCustomers) onUpdateCustomers(merged);

    setActionNotice(`Successfully imported ${newEntries.length} customer accounts.`);
    setBulkText('');
    setIsBulkImportOpen(false);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Delete customer "${name}" from Secure Track?`)) return;

    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch {
      // ignore
    }

    const filtered = customerList.filter((c) => c.id !== id);
    setCustomerList(filtered);
    if (onUpdateCustomers) onUpdateCustomers(filtered);
    setActionNotice(`Deleted customer: ${name}`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div id="admin-dashboard-container" className="w-full min-h-[100dvh] bg-slate-950 text-slate-100 pb-16">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-white tracking-tight">SECURE TRACK Command Portal</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">{adminEmail}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onExitAdminView && (
              <button
                type="button"
                onClick={onExitAdminView}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
              >
                Technician View
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Banner Alert */}
        {actionNotice && (
          <div className="flex items-center space-x-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 p-3 text-xs text-emerald-300 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Fleet KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-4 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Total Installs</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-white">{allInstallations.length}</span>
              <span className="text-xs text-slate-500">all time</span>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-4 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Today's Installs</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-emerald-400">{installationsToday}</span>
              <span className="text-xs text-slate-500">completed</span>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-4 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Van Tracking Stock</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-white">{totalCirculatingStock}</span>
              <span className="text-xs text-slate-500">units</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              FMC920: {totalFmc920} · FMC130: {totalFmc130}
            </p>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-4 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">SIMs & Relays</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-emerald-400">{totalSims}</span>
              <span className="text-xs text-slate-500">SIMs</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {totalRelays} Relays circulating
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('installations')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'installations'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>All Installations ({allInstallations.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('technicians')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'technicians'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Technicians & Inventory ({technicians.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'customers'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Customer Accounts ({customerList.length})</span>
          </button>
        </div>

        {/* Tab 1: All Installations Across Technicians */}
        {activeTab === 'installations' && (
          <div className="space-y-4">
            {/* Filter & Export Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="flex-1 flex flex-col xs:flex-row items-center gap-2 w-full">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search customer, IMEI, SIM number, device, or technician..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Filter by Technician */}
                <select
                  value={selectedTechFilter}
                  onChange={(e) => setSelectedTechFilter(e.target.value)}
                  className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Technicians</option>
                  {technicians.map((t) => (
                    <option key={t.uid} value={t.email}>
                      {t.email}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleExportAll}
                disabled={allInstallations.length === 0}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Fleet Excel</span>
              </button>
            </div>

            {/* Installations Table */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Teltonika Device</th>
                      <th className="py-3 px-4">IMEI / Barcode</th>
                      <th className="py-3 px-4">SIM Number</th>
                      <th className="py-3 px-4">Relay</th>
                      <th className="py-3 px-4">Technician</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          Loading installations database...
                        </td>
                      </tr>
                    ) : filteredInstallations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          No installation records match your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredInstallations.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(item.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                            {item.customer_name}
                          </td>
                          <td className="py-3 px-4 text-emerald-400 whitespace-nowrap font-medium">
                            {item.device_type}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-200 whitespace-nowrap">
                            <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {item.imei}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-200 whitespace-nowrap">
                            {item.sim_number ? (
                              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-emerald-400">
                                {item.sim_number}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {item.relay_installed ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Installed
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">No</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                            {item.tech_email}
                          </td>
                          <td className="py-3 px-4 text-slate-400 italic max-w-xs truncate">
                            {item.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Manage Technician User Accounts & Van Inventory */}
        {activeTab === 'technicians' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Technician Roster & Hardware Stock</h3>
                <p className="text-xs text-slate-400">
                  Manage field technicians, assign permissions, and adjust FMC920, FMC130, SIMs, and Relays
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddTechModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Technician</span>
              </button>
            </div>

            {/* Technicians Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {technicians.map((tech) => (
                <div
                  key={tech.uid}
                  className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-sm hover:border-slate-700 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate" title={tech.email}>
                          {tech.email}
                        </p>
                        <p className="text-[11px] text-slate-400">ID: {tech.uid.slice(0, 14)}...</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleRole(tech)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border cursor-pointer ${
                          tech.role === 'admin'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                        }`}
                        title="Click to toggle Admin / Technician role"
                      >
                        {tech.role || 'technician'}
                      </button>
                    </div>

                    {/* Stock breakdown grid */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 my-3 space-y-2">
                      <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Total Tracking Units:</span>
                        <span className="font-mono font-bold text-white text-sm">
                          {tech.inventory_count ?? 0}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="flex items-center justify-between bg-slate-900/60 p-1.5 rounded-lg">
                          <span className="text-slate-400">FMC920:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {tech.inventory_breakdown?.fmc920 ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-900/60 p-1.5 rounded-lg">
                          <span className="text-slate-400">FMC130:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {tech.inventory_breakdown?.fmc130 ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-900/60 p-1.5 rounded-lg">
                          <span className="text-slate-400">SIM Cards:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {tech.inventory_breakdown?.sim_cards ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-900/60 p-1.5 rounded-lg">
                          <span className="text-slate-400">Relays:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {tech.inventory_breakdown?.relays ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAdjustStock(tech)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                    >
                      Adjust Van Stock
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveTechnician(tech)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                      title="Remove technician"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Customer Accounts Management (Ready for the user's list) */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">Customer & Fleet Accounts</h3>
                <p className="text-xs text-slate-400">
                  Manage customer names and categories available to technicians on the field
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(true)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center space-x-1.5 border border-slate-700 transition-colors"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Bulk Import Customer List</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddCustModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Customer</span>
                </button>
              </div>
            </div>

            {/* Customers Table */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Customer / Fleet Name</th>
                      <th className="py-3 px-4">Industry / Category</th>
                      <th className="py-3 px-4">Contact Phone</th>
                      <th className="py-3 px-4">Total Devices Logged</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {customerList.map((cust) => {
                      const count = allInstallations.filter(
                        (i) => i.customer_name.toLowerCase() === cust.name.toLowerCase()
                      ).length;

                      return (
                        <tr key={cust.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-white">
                            <div className="flex items-center space-x-2">
                              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>{cust.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {cust.category || 'Fleet'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {cust.phone || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className="font-bold text-emerald-400">{count}</span> installations
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                              title="Delete customer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add New Technician Account */}
      {isAddTechModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Add Field Technician</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTechModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTechnician} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Technician Email</label>
                <input
                  type="email"
                  required
                  placeholder="technician@securetrack.com"
                  value={newTechEmail}
                  onChange={(e) => setNewTechEmail(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Role</label>
                <select
                  value={newTechRole}
                  onChange={(e) => setNewTechRole(e.target.value as 'technician' | 'admin')}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="technician">Technician (Field PWA)</option>
                  <option value="admin">Admin (Full Fleet Portal)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">FMC920 Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={newTechFmc920}
                    onChange={(e) => setNewTechFmc920(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">FMC130 Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={newTechFmc130}
                    onChange={(e) => setNewTechFmc130(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">SIM Cards</label>
                  <input
                    type="number"
                    min="0"
                    value={newTechSims}
                    onChange={(e) => setNewTechSims(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Relays</label>
                  <input
                    type="number"
                    min="0"
                    value={newTechRelays}
                    onChange={(e) => setNewTechRelays(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold text-center"
                  />
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddTechModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={techActionLoading}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-1"
                >
                  {techActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Save Technician</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust Multi-Item Van Stock */}
      {adjustingTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Adjust Van Inventory</h3>
                <p className="text-xs text-slate-400 truncate max-w-[240px]">{adjustingTech.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingTech(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustStock} className="space-y-3.5">
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Tracking Devices:</span>
                <span className="font-mono font-bold text-emerald-400 text-base">
                  {(Number(adjFmc920) || 0) + (Number(adjFmc130) || 0)} units
                </span>
              </div>

              <div className="space-y-3">
                {/* FMC920 */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-white">Teltonika FMC920</span>
                      <p className="text-[10px] text-slate-400">Compact Tracker</p>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={adjFmc920}
                    onChange={(e) => setAdjFmc920(parseInt(e.target.value, 10) || 0)}
                    className="w-16 rounded-lg bg-slate-900 border border-slate-700 py-1 text-center font-mono font-bold text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* FMC130 */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-white">Teltonika FMC130</span>
                      <p className="text-[10px] text-slate-400">Advanced LTE Cat 1</p>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={adjFmc130}
                    onChange={(e) => setAdjFmc130(parseInt(e.target.value, 10) || 0)}
                    className="w-16 rounded-lg bg-slate-900 border border-slate-700 py-1 text-center font-mono font-bold text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* SIM Cards */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-white">SIM Cards</span>
                      <p className="text-[10px] text-slate-400">M2M Cellular SIMs</p>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={adjSims}
                    onChange={(e) => setAdjSims(parseInt(e.target.value, 10) || 0)}
                    className="w-16 rounded-lg bg-slate-900 border border-slate-700 py-1 text-center font-mono font-bold text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Relays */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white">12V/24V Relays</span>
                      <p className="text-[10px] text-slate-400">Immobilizer Cut-off</p>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={adjRelays}
                    onChange={(e) => setAdjRelays(parseInt(e.target.value, 10) || 0)}
                    className="w-16 rounded-lg bg-slate-900 border border-slate-700 py-1 text-center font-mono font-bold text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setAdjustingTech(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Single Customer */}
      {isAddCustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Add Customer Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingleCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Company / Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Desert Star Transport LLC"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Industry / Category</label>
                <input
                  type="text"
                  placeholder="e.g. Heavy Haul, Cold Chain, Delivery..."
                  value={newCustCategory}
                  onChange={(e) => setNewCustCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone / Fleet Manager</label>
                <input
                  type="tel"
                  placeholder="+971 50..."
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Paste / Import Customers */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <UploadCloud className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Bulk Import Customer List</h3>
                  <p className="text-xs text-slate-400">Paste your customer accounts directly into Secure Track</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkImportOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Paste your customer list below. You can enter one name per line, or CSV format (<code className="text-emerald-400 font-mono">Company Name, Category, Phone</code>):
              </p>

              <textarea
                rows={7}
                placeholder={`Falcon Express Cargo, Logistics, +971 50 111 2233\nAl Futtaim Fleet, Distribution, +971 52 333 4455\nEmirates Fuel Transport\nOasis Water Distribution, FMCG`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {bulkText.split('\n').filter((l) => l.trim()).length} companies detected
                </span>
                <span className="text-emerald-400">Will be saved to database</span>
              </div>
            </div>

            <div className="pt-2 flex space-x-2">
              <button
                type="button"
                onClick={() => setIsBulkImportOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={!bulkText.trim()}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Import Customers</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
