import React from 'react';
import { 
  CalendarCheck, 
  Package, 
  AlertTriangle, 
  PlusCircle, 
  TrendingUp,
  Radio,
  Zap,
  HardDrive
} from 'lucide-react';
import { VanInventory, DEFAULT_INVENTORY } from '../types';

interface StatusBarProps {
  dailyTotal: number;
  inventoryRemaining: number;
  inventoryBreakdown?: VanInventory;
  allTimeTotal: number;
  onOpenRestock: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  dailyTotal,
  inventoryRemaining,
  inventoryBreakdown = DEFAULT_INVENTORY,
  allTimeTotal,
  onOpenRestock
}) => {
  const isLowInventory = inventoryRemaining <= 4 && inventoryRemaining > 0;
  const isOutOfStock = inventoryRemaining <= 0;

  return (
    <div id="technician-status-bar" className="w-full space-y-2.5">
      {/* Top Cards: Daily Total & Total Devices */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Daily Total Card */}
        <div
          id="stat-daily-total"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-3.5 border border-slate-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Daily Total</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{dailyTotal}</span>
            <span className="text-xs text-slate-400">today</span>
          </div>
          <div className="mt-1 flex items-center text-[11px] text-slate-500">
            <TrendingUp className="w-3 h-3 mr-1 text-emerald-400" />
            <span>{allTimeTotal} lifetime installs</span>
          </div>
          {/* Background glow */}
          <div className="pointer-events-none absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-emerald-500/10 blur-xl" />
        </div>

        {/* Van Devices Remaining Card */}
        <div
          id="stat-inventory-remaining"
          className={`relative overflow-hidden rounded-2xl p-3.5 border shadow-sm transition-colors ${
            isOutOfStock
              ? 'bg-gradient-to-br from-red-950/40 to-slate-950 border-red-800/60'
              : isLowInventory
              ? 'bg-gradient-to-br from-amber-950/30 to-slate-950 border-amber-800/50'
              : 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Van Hardware</span>
            <button
              id="restock-inventory-button"
              type="button"
              onClick={onOpenRestock}
              title="Restock or adjust inventory"
              className="p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                isOutOfStock ? 'text-red-400' : isLowInventory ? 'text-amber-400' : 'text-white'
              }`}
            >
              {inventoryRemaining}
            </span>
            <span className="text-xs text-slate-400">devices</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            {isOutOfStock ? (
              <span className="flex items-center text-red-400 font-medium">
                <AlertTriangle className="w-3 h-3 mr-1" /> Out of stock
              </span>
            ) : isLowInventory ? (
              <span className="flex items-center text-amber-400 font-medium">
                <AlertTriangle className="w-3 h-3 mr-1" /> Low stock
              </span>
            ) : (
              <span className="flex items-center text-emerald-400">
                <Package className="w-3 h-3 mr-1" /> Ready for install
              </span>
            )}
            <button
              type="button"
              onClick={onOpenRestock}
              className="text-emerald-400 hover:underline text-[10px] uppercase font-bold"
            >
              Adjust
            </button>
          </div>
          {/* Subtle glow */}
          <div
            className={`pointer-events-none absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-xl ${
              isOutOfStock ? 'bg-red-500/15' : isLowInventory ? 'bg-amber-500/15' : 'bg-emerald-500/10'
            }`}
          />
        </div>
      </div>

      {/* Itemized Van Stock Ribbon: FMC920, FMC130, SIMs, Relays */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-2.5 px-3 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1 sm:space-x-3 overflow-x-auto scrollbar-none w-full justify-between">
          {/* FMC920 */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-slate-400">FMC920:</span>
            <span className="font-mono font-bold text-white">{inventoryBreakdown.fmc920}</span>
          </div>

          <span className="text-slate-700">|</span>

          {/* FMC130 */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-slate-400">FMC130:</span>
            <span className="font-mono font-bold text-white">{inventoryBreakdown.fmc130}</span>
          </div>

          <span className="text-slate-700">|</span>

          {/* SIM Cards */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-slate-400">SIMs:</span>
            <span className="font-mono font-bold text-white">{inventoryBreakdown.sim_cards}</span>
          </div>

          <span className="text-slate-700">|</span>

          {/* Relays */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-slate-400">Relays:</span>
            <span className="font-mono font-bold text-white">{inventoryBreakdown.relays}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
