import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Clock, 
  HardDrive, 
  Building2, 
  Hash, 
  Filter, 
  CheckCircle2, 
  Calendar,
  Radio,
  Zap,
  LayoutGrid,
  Table as TableIcon,
  Plus,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Installation } from '../types';
import { exportInstallationsToExcel } from '../lib/exportExcel';

interface InstallationHistoryProps {
  installations: Installation[];
  techEmail: string;
  isLoading: boolean;
  onUpdateSimNumber?: (installationId: string, newSim: string) => void;
}

export const InstallationHistory: React.FC<InstallationHistoryProps> = ({
  installations,
  techEmail,
  isLoading,
  onUpdateSimNumber
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today'>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Quick edit / add SIM state
  const [editingItem, setEditingItem] = useState<Installation | null>(null);
  const [newSimInput, setNewSimInput] = useState<string>('');
  const [simSaving, setSimSaving] = useState<boolean>(false);

  // Filter installations
  const filteredInstallations = installations.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.customer_name.toLowerCase().includes(q) ||
      item.device_type.toLowerCase().includes(q) ||
      item.imei.toLowerCase().includes(q) ||
      (item.sim_number && item.sim_number.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterPeriod === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const itemDateStr = new Date(item.timestamp).toISOString().slice(0, 10);
      return todayStr === itemDateStr;
    }

    return true;
  });

  const handleExportExcel = () => {
    try {
      const toExport = filteredInstallations.length > 0 ? filteredInstallations : installations;
      exportInstallationsToExcel(toExport, techEmail);
      setExportNotice(`Exported ${toExport.length} installations with SIM numbers to Excel.`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  const handleOpenSimEditor = (item: Installation) => {
    setEditingItem(item);
    setNewSimInput(item.sim_number || '');
  };

  const handleSaveSimNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const trimmed = newSimInput.trim();
    setSimSaving(true);

    try {
      if (editingItem.id) {
        const docRef = doc(db, 'installations', editingItem.id);
        await updateDoc(docRef, { sim_number: trimmed });
      }
      if (onUpdateSimNumber) {
        onUpdateSimNumber(editingItem.id, trimmed);
      }
      // Mutate locally for immediate feedback
      editingItem.sim_number = trimmed;
      setExportNotice(`Updated SIM number for ${editingItem.customer_name} (${editingItem.imei})`);
      setEditingItem(null);
      setTimeout(() => setExportNotice(null), 3000);
    } catch (e) {
      console.warn('Could not update SIM in Firestore directly, updated locally:', e);
      if (onUpdateSimNumber) {
        onUpdateSimNumber(editingItem.id, trimmed);
      }
      editingItem.sim_number = trimmed;
      setEditingItem(null);
    } finally {
      setSimSaving(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' +
        d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div id="installation-history-section" className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-3.5 sm:p-5 shadow-lg space-y-4">
      {/* Header and Excel Export CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center">
            <Clock className="w-4 h-4 mr-2 text-emerald-400" />
            Installation History & Reports
          </h3>
          <p className="text-xs text-slate-400">
            {installations.length} records logged by {techEmail}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View mode toggle: Table / Cards */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
                viewMode === 'table'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Table View with explicit SIM Number column"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
                viewMode === 'cards'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Cards</span>
            </button>
          </div>

          {/* Excel Export Button */}
          <button
            id="export-excel-btn"
            type="button"
            onClick={handleExportExcel}
            disabled={installations.length === 0}
            className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Download complete technician installation report as an .xlsx Excel spreadsheet with SIM column"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="flex items-center space-x-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 p-2.5 text-xs text-emerald-300 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col xs:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="search-installations-input"
            type="text"
            placeholder="Search by customer, IMEI, SIM number, or device..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 self-end xs:self-center shrink-0">
          <button
            type="button"
            onClick={() => setFilterPeriod('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterPeriod === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterPeriod('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 ${
              filterPeriod === 'today'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Today</span>
          </button>
        </div>
      </div>

      {/* View Mode 1: Table View with Dedicated Column for SIM Number */}
      {viewMode === 'table' && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-md">
          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Customer</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Device</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">IMEI Number</th>
                  {/* Dedicated Column for Adding & Viewing SIM Number */}
                  <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-950/40 text-emerald-400 border-x border-emerald-900/40">
                    <div className="flex items-center space-x-1 font-bold">
                      <Radio className="w-3.5 h-3.5" />
                      <span>SIM Number (Add / View)</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Relay</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                      Loading installations...
                    </td>
                  </tr>
                ) : filteredInstallations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  filteredInstallations.map((item) => (
                    <tr key={item.id || item.imei} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                        {formatDate(item.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-sans font-semibold text-white">
                        {item.customer_name}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-sans text-emerald-400">
                        {item.device_type}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">
                        <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {item.imei}
                        </span>
                      </td>

                      {/* SIM Number Column with direct add/edit button */}
                      <td className="py-2.5 px-3 whitespace-nowrap bg-emerald-950/20 border-x border-emerald-900/30">
                        {item.sim_number ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-emerald-400 font-bold">
                              {item.sim_number}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenSimEditor(item)}
                              className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-emerald-900/40 transition-colors"
                              title="Edit SIM Number"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenSimEditor(item)}
                            className="px-2 py-0.5 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[10px] font-sans font-semibold flex items-center space-x-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add SIM</span>
                          </button>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                        {item.relay_installed ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Relay Yes
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">No</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-sans text-slate-400 italic max-w-[140px] truncate" title={item.notes}>
                        {item.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Mode 2: Card List */}
      {viewMode === 'cards' && (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading installation history...</div>
          ) : filteredInstallations.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 p-6">
              <Filter className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">No installations found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {searchQuery
                  ? 'Try clearing your search query.'
                  : 'Log your first device installation using the form above.'}
              </p>
            </div>
          ) : (
            filteredInstallations.map((item) => (
              <div
                key={item.id || item.imei}
                className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-3 hover:border-slate-700 transition-colors shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-white">
                      <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{item.customer_name}</span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-medium">{item.device_type}</span>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-400 shrink-0 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                    {formatDate(item.timestamp)}
                  </span>
                </div>

                {/* Hardware telemetry badges: IMEI, SIM, Relay */}
                <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5 text-xs">
                  {/* IMEI */}
                  <div className="flex items-center space-x-1 font-mono text-slate-300 text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    <Hash className="w-3 h-3 text-emerald-400" />
                    <span>{item.imei}</span>
                  </div>

                  {/* SIM Number Badge / Add Button */}
                  {item.sim_number ? (
                    <button
                      type="button"
                      onClick={() => handleOpenSimEditor(item)}
                      className="flex items-center space-x-1 font-mono text-emerald-400 text-[11px] bg-emerald-950/40 hover:bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-800/50 transition-colors"
                      title="Click to edit SIM Number"
                    >
                      <Radio className="w-3 h-3" />
                      <span>SIM: {item.sim_number}</span>
                      <Edit2 className="w-2.5 h-2.5 text-slate-400 ml-1" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenSimEditor(item)}
                      className="flex items-center space-x-1 text-emerald-400 text-[10px] bg-emerald-950/40 hover:bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-500/40 font-semibold transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Add SIM Number</span>
                    </button>
                  )}

                  {/* Relay */}
                  {item.relay_installed && (
                    <div className="flex items-center space-x-1 text-amber-300 text-[10px] bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60 font-semibold">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Relay Cut-off</span>
                    </div>
                  )}

                  {item.notes && (
                    <span className="text-[11px] text-slate-400 italic truncate max-w-[160px] ml-auto" title={item.notes}>
                      "{item.notes}"
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Add / Edit SIM Number for an Installation Record */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Radio className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Add / Update SIM Number</h3>
                  <p className="text-xs text-slate-400 truncate max-w-[200px]">
                    {editingItem.customer_name} ({editingItem.imei})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSimNumber} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  SIM Card Number (ICCID or Phone)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. 8997101234567890123"
                  value={newSimInput}
                  onChange={(e) => setNewSimInput(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simSaving || !newSimInput.trim()}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-1 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save SIM</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
