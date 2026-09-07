import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  HardDrive, 
  Building2, 
  Hash, 
  FileText,
  Loader2,
  Sparkles,
  Radio,
  Cpu,
  Zap,
  Check,
  AlertTriangle
} from 'lucide-react';
import { 
  DEFAULT_CUSTOMERS, 
  TELTONIKA_DEVICES, 
  CustomerOption,
  VanInventory,
  DEFAULT_INVENTORY
} from '../types';
import { playBeep } from '../lib/audio';

interface InstallationFormProps {
  techUid: string;
  techEmail: string;
  inventoryRemaining: number;
  inventoryBreakdown?: VanInventory;
  customers?: CustomerOption[];
  onAddNewCustomer?: (cust: CustomerOption) => void;
  onSubmitInstallation: (data: {
    customer_name: string;
    device_type: string;
    imei: string;
    sim_number: string;
    relay_installed?: boolean;
    notes?: string;
  }) => Promise<void>;
  onOpenScanner: () => void;
  onOpenSimScanner?: () => void;
  scannedImei: string;
  scannedSim?: string;
  onClearScannedImei: () => void;
  onClearScannedSim?: () => void;
  onOpenRestock: () => void;
}

export const InstallationForm: React.FC<InstallationFormProps> = ({
  inventoryRemaining,
  inventoryBreakdown = DEFAULT_INVENTORY,
  customers = DEFAULT_CUSTOMERS,
  onAddNewCustomer,
  onSubmitInstallation,
  onOpenScanner,
  onOpenSimScanner,
  scannedImei,
  scannedSim,
  onClearScannedImei,
  onClearScannedSim,
  onOpenRestock
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || 'cust-1');
  const [customCustomerName, setCustomCustomerName] = useState<string>('');
  const [customCustomerPhone, setCustomCustomerPhone] = useState<string>('');
  const [isCustomCustomer, setIsCustomCustomer] = useState<boolean>(false);
  
  // Specific Teltonika Models requested by user
  const [deviceType, setDeviceType] = useState<string>('Teltonika FMC920');
  const [imei, setImei] = useState<string>('');
  
  // SIM Number requested by user
  const [simNumber, setSimNumber] = useState<string>('');
  
  // Relay option requested by user (inventory consists of devices, sim, relays etc)
  const [relayInstalled, setRelayInstalled] = useState<boolean>(false);
  
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Sync scanned IMEI if received from scanner
  useEffect(() => {
    if (scannedImei) {
      setImei(scannedImei);
      onClearScannedImei();
    }
  }, [scannedImei, onClearScannedImei]);

  // Sync scanned SIM if received from scanner
  useEffect(() => {
    if (scannedSim) {
      setSimNumber(scannedSim);
      if (onClearScannedSim) onClearScannedSim();
    }
  }, [scannedSim, onClearScannedSim]);

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomCustomer(true);
      setSelectedCustomerId('__custom__');
    } else {
      setIsCustomCustomer(false);
      setSelectedCustomerId(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessNotice(null);

    let customerName = '';
    if (isCustomCustomer) {
      customerName = customCustomerName.trim();
      if (!customerName) {
        setFormError('Please enter a customer or company name.');
        return;
      }
      // Save new customer option locally if provided
      if (onAddNewCustomer) {
        onAddNewCustomer({
          id: `cust_${Date.now()}`,
          name: customerName,
          category: 'Fleet Account',
          phone: customCustomerPhone.trim() || undefined
        });
      }
    } else {
      const match = customers.find((c) => c.id === selectedCustomerId);
      customerName = match ? match.name : selectedCustomerId;
    }

    if (!customerName) {
      setFormError('Please select or specify a customer account.');
      return;
    }

    if (!deviceType.trim()) {
      setFormError('Please select the Teltonika device type.');
      return;
    }

    const cleanImei = imei.trim();
    if (!cleanImei) {
      setFormError('Please provide an IMEI or scan the device barcode.');
      return;
    }

    if (cleanImei.length < 6) {
      setFormError('IMEI / Serial number must be at least 6 characters.');
      return;
    }

    const cleanSim = simNumber.trim();
    if (!cleanSim) {
      setFormError('Please enter the SIM card number (ICCID or phone number).');
      return;
    }

    // Check specific inventory warnings
    const isFmc920 = deviceType.toLowerCase().includes('920');
    const specificDeviceStock = isFmc920 ? inventoryBreakdown.fmc920 : inventoryBreakdown.fmc130;
    
    if (specificDeviceStock <= 0 || inventoryBreakdown.sim_cards <= 0 || (relayInstalled && inventoryBreakdown.relays <= 0)) {
      const confirmProceed = window.confirm(
        `Van Inventory Alert: You are low or out of stock on ${
          specificDeviceStock <= 0 ? deviceType : ''
        }${inventoryBreakdown.sim_cards <= 0 ? ' / SIM Cards' : ''}${
          relayInstalled && inventoryBreakdown.relays <= 0 ? ' / Relays' : ''
        }. Do you still want to submit this installation?`
      );
      if (!confirmProceed) {
        onOpenRestock();
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmitInstallation({
        customer_name: customerName,
        device_type: deviceType.trim(),
        imei: cleanImei,
        sim_number: cleanSim,
        relay_installed: relayInstalled,
        notes: notes.trim()
      });

      playBeep('success');
      setSuccessNotice(`Installation logged! IMEI: ${cleanImei} · SIM: ${cleanSim}`);
      setImei('');
      setSimNumber('');
      setRelayInstalled(false);
      setNotes('');
      if (isCustomCustomer) {
        setIsCustomCustomer(false);
        setCustomCustomerName('');
        setCustomCustomerPhone('');
      }
      setTimeout(() => setSuccessNotice(null), 6000);
    } catch (err: unknown) {
      playBeep('error');
      const msg = err instanceof Error ? err.message : 'Failed to submit installation record.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="installation-form-container"
      className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Log Installation</h2>
            <p className="text-xs text-slate-400">Secure Track Teltonika Hardware & SIM Deployment</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenRestock}
          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-800/60 transition-colors"
        >
          Van Stock: {inventoryRemaining}
        </button>
      </div>

      {/* Success Notification */}
      {successNotice && (
        <div className="mb-4 flex items-center space-x-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 p-3 text-sm text-emerald-300 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-xs sm:text-sm">{successNotice}</p>
            <p className="text-[11px] text-emerald-400/90">Van inventory for Device, SIM & Relay updated automatically.</p>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {formError && (
        <div className="mb-4 flex items-center space-x-2.5 rounded-xl bg-red-950/70 border border-red-500/40 p-3 text-sm text-red-300 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="flex-1 font-medium text-xs">{formError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Selection */}
        <div>
          <label htmlFor="customer-select" className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Customer / Fleet Account
            </span>
            <span className="text-[11px] text-slate-500">{customers.length} accounts</span>
          </label>
          <div className="relative">
            <select
              id="customer-select"
              value={isCustomCustomer ? '__custom__' : selectedCustomerId}
              onChange={handleCustomerChange}
              className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              {customers.map((cust: CustomerOption) => (
                <option key={cust.id} value={cust.id}>
                  {cust.name} {cust.category ? `(${cust.category})` : ''}
                </option>
              ))}
              <option value="__custom__">+ Add / Enter New Customer...</option>
            </select>
          </div>

          {isCustomCustomer && (
            <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-emerald-500/50 space-y-2 animate-fadeIn">
              <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">New Customer Details</p>
              <input
                id="custom-customer-input"
                type="text"
                required
                placeholder="Company / Client name..."
                value={customCustomerName}
                onChange={(e) => setCustomCustomerName(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <input
                id="custom-customer-phone"
                type="tel"
                placeholder="Contact Phone / Fleet Manager (Optional)..."
                value={customCustomerPhone}
                onChange={(e) => setCustomCustomerPhone(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Teltonika Device Type Selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center">
              <HardDrive className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Teltonika Device Type
            </label>
            <span className="text-[11px] text-slate-400">Select model installed</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* FMC 920 Card */}
            <button
              type="button"
              onClick={() => setDeviceType('Teltonika FMC920')}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                deviceType === 'Teltonika FMC920'
                  ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500 shadow-md shadow-emerald-950'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">FMC920</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">2G / 4G</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Teltonika FMC920 Compact</p>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">In stock:</span>
                <span className={`font-mono font-bold ${inventoryBreakdown.fmc920 <= 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {inventoryBreakdown.fmc920} units
                </span>
              </div>
            </button>

            {/* FMC 130 Card */}
            <button
              type="button"
              onClick={() => setDeviceType('Teltonika FMC130')}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                deviceType === 'Teltonika FMC130'
                  ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500 shadow-md shadow-emerald-950'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">FMC130</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">LTE Cat 1</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Teltonika FMC130 Advanced</p>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">In stock:</span>
                <span className={`font-mono font-bold ${inventoryBreakdown.fmc130 <= 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {inventoryBreakdown.fmc130} units
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Device IMEI Barcode Field with Scanner */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="imei-input" className="text-xs font-medium text-slate-300 flex items-center">
              <Hash className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Device IMEI / Serial Number
            </label>
            <span className="text-[11px] text-slate-400 font-mono">15-digit Teltonika barcode</span>
          </div>

          <div className="flex space-x-2">
            <div className="relative flex-1">
              <input
                id="imei-input"
                type="text"
                required
                placeholder="Scan barcode or type IMEI..."
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3.5 py-2.5 text-sm font-mono tracking-wider text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              {imei && (
                <button
                  type="button"
                  onClick={() => setImei('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 p-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Camera Scanner Button */}
            <button
              id="open-scanner-btn"
              type="button"
              onClick={onOpenScanner}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs uppercase tracking-wider shadow-md shadow-emerald-600/25 transition-all shrink-0"
            >
              <Camera className="w-4 h-4" />
              <span>Scan</span>
            </button>
          </div>

          {/* Helper button */}
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Scan Teltonika box or device label</span>
            <button
              type="button"
              onClick={() => setImei(`86047205${Math.floor(1000000 + Math.random() * 9000000)}`)}
              className="text-emerald-400 hover:underline flex items-center"
            >
              <Sparkles className="w-3 h-3 mr-0.5" /> Sample IMEI
            </button>
          </div>
        </div>

        {/* SIM Number Option */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="sim-input" className="text-xs font-medium text-slate-300 flex items-center">
              <Radio className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              SIM Card Number (ICCID or Phone)
            </label>
            <span className="text-[10px] text-emerald-400 font-mono">
              In stock: {inventoryBreakdown.sim_cards} SIMs
            </span>
          </div>

          <div className="flex space-x-2">
            <div className="relative flex-1">
              <input
                id="sim-input"
                type="text"
                required
                placeholder="Scan barcode or type SIM..."
                value={simNumber}
                onChange={(e) => setSimNumber(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3.5 py-2.5 text-sm font-mono tracking-wider text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              {simNumber && (
                <button
                  type="button"
                  onClick={() => setSimNumber('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 p-1"
                >
                  Clear
                </button>
              )}
            </div>

            {onOpenSimScanner && (
              <button
                id="open-sim-scanner-btn"
                type="button"
                onClick={onOpenSimScanner}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs uppercase tracking-wider shadow-md shadow-emerald-600/25 transition-all shrink-0"
                title="Scan SIM barcode / ICCID using camera"
              >
                <Camera className="w-4 h-4" />
                <span>Scan</span>
              </button>
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>ICCID from SIM card packaging</span>
            <button
              type="button"
              onClick={() => setSimNumber(`899710${Math.floor(1000000000000 + Math.random() * 9000000000000)}`)}
              className="text-emerald-400 hover:underline flex items-center"
            >
              <Sparkles className="w-3 h-3 mr-0.5" /> Sample SIM
            </button>
          </div>
        </div>

        {/* Relay Installed Checkbox */}
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${relayInstalled ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">12V/24V Immobilizer Relay Installed</p>
              <p className="text-[11px] text-slate-400">
                Engine cut-off circuit connected · Stock: {inventoryBreakdown.relays} relays
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={relayInstalled}
              onChange={(e) => setRelayInstalled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Installation Notes */}
        <div>
          <label htmlFor="notes-input" className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center">
            <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
            Installation Notes & Vehicle Details (Optional)
          </label>
          <input
            id="notes-input"
            type="text"
            placeholder="e.g. Plate #74921, Toyota Hilux, mounted behind fuse box..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Submit Button */}
        <button
          id="submit-installation-button"
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Registering Installation & Decrementing Stock...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit Installation</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
