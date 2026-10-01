import { FormEvent, useState } from 'react';
import { Save, X } from 'lucide-react';
import { DEVICE_MODELS, SIM_STOCK_KEYS, Stock } from '../types';
import { saveCompanyInventory } from '../lib/data';
import { useDeviceModels } from './DeviceManagement';

export function CompanyInventoryEditor({current,userName,userId,onClose}:{current:Stock;userName:string;userId:string;onClose:()=>void}){
 const catalogue=useDeviceModels(true);const models=[...new Set([...DEVICE_MODELS,...catalogue.filter(item=>item.status!=='archived').map(item=>item.name)])];
 const [target,setTarget]=useState<Stock>({...current}),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const field=(key:string,label:string=key)=><label key={key}>{label}<input type="number" min="0" max="100000" step="1" value={target[key]||0} onChange={e=>setTarget(value=>({...value,[key]:Math.max(0,Math.min(100000,Number(e.target.value)||0))}))}/><small>Current: {current[key]||0}</small></label>;
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await saveCompanyInventory(current,target,notes,userName,userId);onClose()}catch(err:any){setError(err.message)}finally{setBusy(false)}}
 return <div className="modal-backdrop" role="presentation"><form className="job-detail-modal inventory-editor" onSubmit={submit}><header><div><span className="eyebrow">OFFICE INVENTORY</span><h2>Update main company stock</h2></div><button type="button" className="icon-button" onClick={onClose}><X/></button></header><p>This is the main stock held by the company. Stock issued to a technician is deducted from this balance automatically.</p><div className="inventory-editor-section"><h3>Devices</h3><div className="inventory-edit-grid">{models.map(key=>field(key))}</div></div><div className="inventory-editor-section sim-editor-section"><h3>SIM cards</h3><div className="inventory-edit-grid">{SIM_STOCK_KEYS.map(key=>field(key,key==='SIM'?'SIM · Unassigned / legacy':key))}</div></div><label>Reason / stock reference<textarea required rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opening stock, supplier delivery, physical count, or correction"/></label>{error&&<div className="notice error">{error}</div>}<div className="form-footer"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}><Save/>{busy?'Saving…':'Save office inventory'}</button></div></form></div>;
}

