import React, { useState, useEffect } from 'react';
import { 
  X, 
  PackagePlus, 
  Check, 
  AlertCircle, 
  HardDrive, 
  Radio, 
  Zap, 
  Plus, 
  Minus,
  Loader2
} from 'lucide-react';
import { VanInventory, DEFAULT_INVENTORY } from '../types';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBreakdown: VanInventory;
  onUpdateInventory: (breakdown: VanInventory) => Promise<void>;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  currentBreakdown = DEFAULT_INVENTORY,
  onUpdateInventory
}) => {
  const [fmc920, setFmc920] = useState<number>(currentBreakdown.fmc920 || 0);
  const [fmc130, setFmc130] = useState<number>(currentBreakdown.fmc130 || 0);
  const [simCards, setSimCards] = useState<number>(currentBreakdown.sim_cards || 0);
  const [relays, setRelays] = useState<number>(currentBreakdown.relays || 0);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFmc920(currentBreakdown.fmc920 || 0);
      setFmc130(currentBreakdown.fmc130 || 0);
      setSimCards(currentBreakdown.sim_cards || 0);
      setRelays(currentBreakdown.relays || 0);
    }
  }, [isOpen, currentBreakdown]);

  if (!isOpen) return null;

  const totalDevices = (Number(fmc920) || 0) + (Number(fmc130) || 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const updated: VanInventory = {
      fmc920: Math.max(0, Number(fmc920) || 0),
      fmc130: Math.max(0, Number(fmc130) || 0),
      sim_cards: Math.max(0, Number(simCards) || 0),
      relays: Math.max(0, Number(relays) || 0)
    };

    setIsSaving(true);
    try {
      await onUpdateInventory(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update van inventory.');
    } finally {
      setIsSaving(false);
    }
  };

  const adjustValue = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number) => {
    setter((prev) => Math.max(0, (Number(prev) || 0) + delta));
  };

  return (
    <div
      id="inventory-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Van Hardware & Stock Restock</h3>
              <p className="text-xs text-slate-400">Manage Teltonika devices, SIM cards & relays</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center space-x-2 rounded-xl bg-red-950/60 border border-red-500/30 p-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Summary Banner */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Total Tracking Devices:</span>
              <span className="ml-2 font-mono font-bold text-emerald-400 text-sm">{totalDevices} units</span>
            </div>
            <div className="text-slate-400">
              <span>{simCards} SIMs</span> · <span>{relays} Relays</span>
            </div>
          </div>

          {/* 1. Teltonika FMC920 */}
          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-xs font-bold text-white">Teltonika FMC920</span>
                  <p className="text-[10px] text-slate-400">Compact GPS Tracker (2G/4G)</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => adjustValue(setFmc920, -1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={fmc920}
                  onChange={(e) => setFmc920(parseInt(e.target.value, 10) || 0)}
                  className="w-14 rounded-lg bg-slate-900 border border-slate-700 py-1 text-center font-mono font-bold text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustValue(setFmc920, 1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(setFmc920, 5)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400"
                >
                  +5
                </button>
              </div>
            </div>
          </div>

          {/* 2. Teltonika FMC130 */}
          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-xs font-bold text-white">Teltonika FMC130</span>
                  <p className="text-[10px] text-slate-400">Advanced 4G LTE Cat 1 with I/O</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => adjustValue(setFmc130, -1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={fmc130}
                  onChange={(e) => setFmc130(parseInt(e.target.value, 10) || 0)}
                  className="w-14 rounded-lg bg-slate-900 border border-slate-700 py-1 text-center font-mono font-bold text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustValue(setFmc130, 1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(setFmc130, 5)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400"
                >
                  +5
                </button>
              </div>
            </div>
          </div>

          {/* 3. SIM Cards */}
          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-xs font-bold text-white">SIM Cards (M2M / IoT)</span>
                  <p className="text-[10px] text-slate-400">Cellular data ICCID cards</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => adjustValue(setSimCards, -1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={simCards}
                  onChange={(e) => setSimCards(parseInt(e.target.value, 10) || 0)}
                  className="w-14 rounded-lg bg-slate-900 border border-slate-700 py-1 text-center font-mono font-bold text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustValue(setSimCards, 1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(setSimCards, 10)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400"
                >
                  +10
                </button>
              </div>
            </div>
          </div>

          {/* 4. Relays */}
          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-xs font-bold text-white">12V/24V Relays</span>
                  <p className="text-[10px] text-slate-400">Immobilizer & starter cut relays</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => adjustValue(setRelays, -1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={relays}
                  onChange={(e) => setRelays(parseInt(e.target.value, 10) || 0)}
                  className="w-14 rounded-lg bg-slate-900 border border-slate-700 py-1 text-center font-mono font-bold text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustValue(setRelays, 1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(setRelays, 5)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-400"
                >
                  +5
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-inventory-button"
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Van Stock</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
