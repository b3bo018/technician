import { FormEvent, useState } from 'react';
import { Save, X } from 'lucide-react';
import { DEVICE_MODELS, SIM_STOCK_KEYS, Stock, Technician } from '../types';
import { adjustInventory } from '../lib/data';

export function InventoryEditor({technician,current,onClose}:{technician:Technician;current:Stock;onClose:()=>void}){
 const [target,setTarget]=useState<Stock>({...current});const [notes,setNotes]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await adjustInventory(technician,current,target,notes);onClose()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <div className="modal-backdrop" role="presentation"><form className="job-detail-modal inventory-editor" onSubmit={submit}><header><div><span className="eyebrow">INVENTORY CORRECTION</span><h2>{technician.displayName||technician.email}</h2></div><button type="button" className="icon-button" onClick={onClose}><X/></button></header><p>Enter the verified physical balance. SecureTrack records only the differences in the audit history.</p><div className="inventory-edit-grid">{[...DEVICE_MODELS,...SIM_STOCK_KEYS].map(key=><label key={key}>{key}<input type="number" min="0" max="10000" step="1" value={target[key]} onChange={e=>setTarget(value=>({...value,[key]:Math.max(0,Math.min(10000,Number(e.target.value)||0))}))}/><small>Current: {current[key]}</small></label>)}</div><label>Reason for correction<textarea required rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Physical stock count, returned item, or correction reference"/></label>{error&&<div className="notice error">{error}</div>}<div className="form-footer"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}><Save/>{busy?'Saving…':'Save corrected inventory'}</button></div></form></div>
}
