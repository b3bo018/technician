import { FormEvent, useCallback, useRef, useState } from 'react';
import { CheckCircle2, QrCode, ScanBarcode } from 'lucide-react';
import { BarcodeScanner, requestRearCamera } from './BarcodeScanner';
import { DEVICE_MODELS, DeviceModel, PendingOperation, Shift, SIM_PROVIDERS, SimProvider, jobLabel } from '../types';

const clean=(value:string)=>value.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
export function JobCompletion({shift,save,onDone}:{shift:Shift;save:(op:Omit<PendingOperation,'uid'|'captured_at'>)=>Promise<void>;onDone:()=>void}) {
 const needsDevice=shift.job_type!=='sim_change'; const needsSim=shift.job_type!=='device_removal';
 const [model,setModel]=useState<DeviceModel>('FMC920'); const [simProvider,setSimProvider]=useState<SimProvider>('Etisalat'); const [imeis,setImeis]=useState<string[]>(Array(shift.unit_count).fill('')); const [sims,setSims]=useState<string[]>(Array(shift.unit_count).fill(''));
 const [notes,setNotes]=useState('');const [scan,setScan]=useState<{kind:'imei'|'sim';index:number}|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const cameraRequest=useRef<Promise<MediaStream>|null>(null);
 function openScanner(kind:'imei'|'sim',index:number){cameraRequest.current=requestRearCamera();setScan({kind,index})}
 const scanned=useCallback((value:string)=>{if(!scan)return;const next=clean(value);if(scan.kind==='imei')setImeis(v=>v.map((x,i)=>i===scan.index?next:x));else setSims(v=>v.map((x,i)=>i===scan.index?next:x));setScan(null);},[scan]);
 async function submit(e:FormEvent){e.preventDefault();setError('');try{
  const di=needsDevice?imeis.map(clean):[];const sn=needsSim?sims.map(clean):[];
  if(di.some(v=>!/^\d{14,17}$/.test(v)))throw new Error('Each device IMEI must contain 14–17 digits.');
  if(sn.some(v=>!/^\d{18,22}$/.test(v)))throw new Error('Each SIM number must contain 18–22 digits.');
  if(new Set(di).size!==di.length||new Set(sn).size!==sn.length)throw new Error('The same IMEI or SIM number cannot be entered twice.');
  setBusy(true);await save({id:shift.id,kind:'job-completed',shift_id:shift.id,job_type:shift.job_type,device_model:needsDevice?model:'',device_imeis:di,sim_numbers:sn,quantity:['new_installation','sim_device_change'].includes(shift.job_type)?shift.unit_count:0,sim_count:needsSim?shift.unit_count:0,sim_provider:needsSim?simProvider:undefined,customer_ref:shift.company_name||shift.customer_name||shift.site_name,vehicle_ref:(shift.vehicle_numbers?.length?shift.vehicle_numbers:[shift.vehicle_number||'']).filter(Boolean).join(' · '),notes:notes.trim()});onDone();
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <form className="completion-card" onSubmit={submit}><div className="completion-heading"><div><span className="eyebrow">JOB COMPLETION</span><h3>{jobLabel(shift.job_type)} · {shift.unit_count} unit{shift.unit_count===1?'':'s'}</h3></div><CheckCircle2/></div>
  {needsDevice&&<label>Device model<select value={model} onChange={e=>setModel(e.target.value as DeviceModel)}>{DEVICE_MODELS.map(m=><option key={m}>{m}</option>)}</select></label>}
  {needsSim&&<label>SIM network<select value={simProvider} onChange={e=>setSimProvider(e.target.value as SimProvider)}>{SIM_PROVIDERS.map(provider=><option key={provider}>{provider}</option>)}</select><small>All SIMs used for this job will be deducted from this network balance.</small></label>}
  <div className="identifier-grid">{Array.from({length:shift.unit_count},(_,i)=><div className="unit-record" key={i}><strong>Unit {i+1}</strong>
   {needsDevice&&<label>Device IMEI<div className="scan-input"><input required inputMode="numeric" maxLength={17} value={imeis[i]} onChange={e=>setImeis(v=>v.map((x,n)=>n===i?clean(e.target.value):x))} placeholder="Scan QR or enter IMEI"/><button type="button" onClick={()=>openScanner('imei',i)} aria-label={'Scan device IMEI for unit '+(i+1)}><QrCode/></button></div></label>}
   {needsSim&&<label>SIM number<div className="scan-input"><input required inputMode="numeric" maxLength={22} value={sims[i]} onChange={e=>setSims(v=>v.map((x,n)=>n===i?clean(e.target.value):x))} placeholder="Scan barcode or enter ICCID"/><button type="button" onClick={()=>openScanner('sim',i)} aria-label={'Scan SIM number for unit '+(i+1)}><ScanBarcode/></button></div></label>}
  </div>)}</div><label>Completion notes <span className="optional">optional</span><textarea rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Vehicle references, work completed, or site notes"/></label>
  {error&&<div className="notice error" role="alert">{error}</div>}<div className="form-footer"><small>{['new_installation','sim_device_change'].includes(shift.job_type)?`Deducts ${shift.unit_count} device${shift.unit_count===1?'':'s'} and ${shift.unit_count} SIM${shift.unit_count===1?'':'s'}.`:shift.job_type==='sim_change'?`Deducts ${shift.unit_count} SIM${shift.unit_count===1?'':'s'}.`:'Records removed devices without deducting stock.'}</small><button className="primary" disabled={busy}>{busy?'Saving…':'Confirm job completion'}</button></div>
  {scan&&cameraRequest.current&&<BarcodeScanner cameraRequest={cameraRequest.current} label={scan.kind==='imei'?'device QR / IMEI':'SIM barcode'} onScan={scanned} onClose={()=>setScan(null)}/>}</form>;
}
