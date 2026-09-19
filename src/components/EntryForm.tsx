import { FormEvent, useState } from 'react';
import { ArrowDownLeft, Check, PackagePlus, Wrench } from 'lucide-react';
import { DEVICE_MODELS, DeviceModel, PendingOperation, SIM_PROVIDERS, SimProvider } from '../types';
import { validateOperation } from '../lib/domain';
export function EntryForm({ installation, save }: { installation: boolean; save: (op: Omit<PendingOperation, 'uid' | 'id' | 'captured_at'>) => Promise<void> }) {
 const [type, setType] = useState<'received' | 'sim-used'>('received'); const [model, setModel] = useState<DeviceModel | ''>('FMC920');
 const [quantity, setQuantity] = useState(1); const [sims, setSims] = useState(0); const [simProvider,setSimProvider]=useState<SimProvider>('Etisalat'); const [customer, setCustomer] = useState(''); const [vehicle, setVehicle] = useState(''); const [notes, setNotes] = useState('');
 const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
 async function submit(e: FormEvent) {
  e.preventDefault(); setError(''); setSuccess('');
  const op = { kind: installation ? 'installed' as const : type, device_model: !installation && (type === 'sim-used' || quantity === 0) ? '' as const : model, quantity: installation ? 1 : type === 'sim-used' ? 0 : quantity, sim_count: sims, sim_provider:sims?simProvider:undefined, customer_ref: customer.trim(), vehicle_ref: vehicle.trim(), notes: notes.trim() };
  try { validateOperation(op); setBusy(true); await save(op); setSuccess('Entry saved. Check the sync indicator for cloud confirmation.'); setSims(0); setNotes(''); if (installation) { setCustomer(''); setVehicle(''); } }
  catch (e: any) { setError(e.message); } finally { setBusy(false); }
 }
 return <section className="panel form-panel"><div className="section-title"><div className="icon-box">{installation ? <Wrench size={21}/> : <PackagePlus size={21}/>}</div><div><h2>{installation ? 'Log an installation' : 'Issue stock to technician'}</h2><p>{installation ? 'One device per installation. No scanning required.' : 'Issued devices and SIMs are added to the selected technician’s stock.'}</p></div></div>
 <form onSubmit={submit}>
 {false && <div className="segmented"><button type="button" className={type === 'received' ? 'selected' : ''} onClick={() => setType('received')}><ArrowDownLeft size={16}/>Stock received</button><button type="button" className={type === 'sim-used' ? 'selected' : ''} onClick={() => setType('sim-used')}>SIMs used separately</button></div>}
 {(installation || type === 'received') && <div className="form-row"><label>Device model<select value={model} onChange={e => { setModel(e.target.value as DeviceModel | ''); if (!e.target.value) setQuantity(0); else if (quantity === 0) setQuantity(1); }}>{!installation && <option value="">SIM cards only</option>}{DEVICE_MODELS.map(m => <option key={m}>{m}</option>)}</select></label>{!installation && <label>Device quantity<input type="number" min={model ? 1 : 0} max="10000" step="1" disabled={!model} value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label>}</div>}
 {installation ? <label className="checkbox"><input type="checkbox" checked={sims === 1} onChange={e => setSims(e.target.checked ? 1 : 0)}/><span>Use one SIM card from my stock</span></label> : <label>SIM quantity {type === 'received' ? 'received' : 'used'}<input type="number" min={type === 'sim-used' ? 1 : 0} max="10000" step="1" value={sims} onChange={e => setSims(Number(e.target.value))}/><small>SIM quantities only. No SIM number is collected.</small></label>}
 {sims>0&&<label>SIM network<select value={simProvider} onChange={e=>setSimProvider(e.target.value as SimProvider)}>{SIM_PROVIDERS.map(provider=><option key={provider}>{provider}</option>)}</select></label>}
 {installation && <div className="form-row"><label>Customer / job reference<input required maxLength={160} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Company or work order"/></label><label>Vehicle reference <span className="optional">optional</span><input maxLength={160} value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="Plate number or fleet ID"/></label></div>}
 <label>Notes <span className="optional">optional</span><textarea rows={3} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder={installation ? 'Installation details, relay fitted, or anything the team should know' : 'Delivery reference or reason for SIM usage'}/></label>
 {error && <div className="notice error" role="alert">{error}</div>}{success && <div className="notice success" role="status"><Check size={16}/>{success}</div>}
 <div className="form-footer"><small>{installation ? 'Deducts 1 device' + (sims ? ' + 1 SIM' : '') : 'Every entry is linked to your account and timestamped.'}</small><button className="primary" disabled={busy}>{busy ? 'Saving…' : installation ? 'Save installation' : 'Save stock entry'}</button></div></form></section>;
}
