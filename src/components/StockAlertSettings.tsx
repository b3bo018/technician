import { FormEvent, useState } from 'react';
import { Bell, Check, Save } from 'lucide-react';
import { StockAlertSettings } from '../types';

export function StockAlertSettingsPanel({settings,canEdit,onSave}:{settings:StockAlertSettings;canEdit:boolean;onSave:(threshold:number)=>Promise<void>}){
 const [threshold,setThreshold]=useState(settings.threshold);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{await onSave(threshold);setNotice('Low-stock threshold saved.')}catch(err:any){setError(err.message)}finally{setBusy(false)}}
 return <section className="panel"><div className="section-title"><div className="icon-box"><Bell/></div><div><h2>Low-stock alerts</h2><p>SecureTrack alerts the affected technician, HR, Accounts and operations when any device or SIM balance reaches this level.</p></div></div>{error&&<div className="notice error">{error}</div>}{notice&&<div className="notice success"><Check/>{notice}</div>}<form onSubmit={submit}><label>Alert when stock on hand is at or below<input type="number" min="0" max="10000" step="1" disabled={!canEdit} value={threshold} onChange={e=>setThreshold(Math.max(0,Math.min(10000,Number(e.target.value)||0)))} /><small>One shared threshold applies to every device model and SIM network.</small></label>{canEdit?<button className="primary" disabled={busy}><Save/>{busy?'Saving…':'Save threshold'}</button>:<div className="notice info">Only an administrator or Accounts user can change this threshold.</div>}</form></section>;
}
