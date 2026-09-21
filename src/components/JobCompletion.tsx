import { FormEvent, useCallback, useRef, useState } from 'react';
import { CheckCircle2, MapPin, QrCode, ScanBarcode } from 'lucide-react';
import { BarcodeScanner, requestRearCamera } from './BarcodeScanner';
import { DEVICE_MODELS, DeviceModel, InspectionAction, PendingOperation, Shift, SIM_PROVIDERS, SimProvider, inspectionLabel, jobLabel } from '../types';
import { captureLocation } from '../lib/location';

const clean=(value:string)=>value.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
export function JobCompletion({shift,save,onDone}:{shift:Shift;save:(op:Omit<PendingOperation,'uid'|'captured_at'>)=>Promise<void>;onDone:()=>void}) {
 const [inspectionAction,setInspectionAction]=useState<InspectionAction>('check_only');
 const effectiveAction=shift.job_type==='inspection'?inspectionAction:shift.job_type;
 const needsDevice=['new_installation','sim_device_change','device_removal','device_change'].includes(effectiveAction);
 const needsSim=['new_installation','sim_change','sim_device_change'].includes(effectiveAction);
 const deductDevice=['new_installation','sim_device_change','device_change'].includes(effectiveAction);
 const [model,setModel]=useState<DeviceModel>('FMC920'); const [simProvider,setSimProvider]=useState<SimProvider>('Etisalat'); const [imeis,setImeis]=useState<string[]>(Array(shift.unit_count).fill('')); const [sims,setSims]=useState<string[]>(Array(shift.unit_count).fill(''));
 const [notes,setNotes]=useState('');const [scan,setScan]=useState<{kind:'imei'|'sim';index:number}|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const cameraRequest=useRef<Promise<MediaStream>|null>(null);
 function openScanner(kind:'imei'|'sim',index:number){cameraRequest.current=requestRearCamera();setScan({kind,index})}
 const scanned=useCallback((value:string)=>{if(!scan)return;const next=clean(value);if(scan.kind==='imei')setImeis(v=>v.map((x,i)=>i===scan.index?next:x));else setSims(v=>v.map((x,i)=>i===scan.index?next:x));setScan(null);},[scan]);
 async function submit(e:FormEvent){e.preventDefault();setError('');try{
  const di=needsDevice?imeis.map(clean):[];const sn=needsSim?sims.map(clean):[];
  if(di.some(v=>!/^[0-9]{14,17}$/.test(v)))throw new Error('Each device IMEI must contain 14–17 digits.');
  if(sn.some(v=>!/^[0-9]{18,22}$/.test(v)))throw new Error('Each SIM number must contain 18–22 digits.');
  if(new Set(di).size!==di.length||new Set(sn).size!==sn.length)throw new Error('The same IMEI or SIM number cannot be entered twice.');
  setBusy(true);const location=await captureLocation();
  await save({id:shift.id,kind:'job-completed',shift_id:shift.id,job_type:shift.job_type,inspection_action:shift.job_type==='inspection'?inspectionAction:undefined,device_model:needsDevice?model:'',device_imeis:di,sim_numbers:sn,quantity:deductDevice?shift.unit_count:0,sim_count:needsSim?shift.unit_count:0,sim_provider:needsSim?simProvider:undefined,customer_ref:shift.company_name||shift.customer_name||shift.site_name,vehicle_ref:(shift.vehicle_numbers?.length?shift.vehicle_numbers:[shift.vehicle_number||'']).filter(Boolean).join(' · '),notes:notes.trim(),completion_latitude:location.latitude,completion_longitude:location.longitude,completion_accuracy_m:location.accuracy_m});onDone();
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <form className="completion-card" onSubmit={submit}><div className="completion-heading"><div><span className="eyebrow">JOB COMPLETION</span><h3>{jobLabel(shift.job_type)} · {shift.unit_count} unit{shift.unit_count===1?'':'s'}</h3></div><CheckCircle2/></div>
  {shift.job_type==='inspection'&&<label>Inspection result<select value={inspectionAction} onChange={e=>setInspectionAction(e.target.value as InspectionAction)}>{(['check_only','device_change','sim_change','sim_device_change'] as InspectionAction[]).map(action=><option key={action} value={action}>{inspectionLabel(action)}</option>)}</select><small>Choose what was changed. Stock is deducted only for replacement items.</small></label>}
  {needsDevice&&<label>Device model<select value={model} onChange={e=>setModel(e.target.value as DeviceModel)}>{DEVICE_MODELS.map(m=><option key={m}>{m}</option>)}</select></label>}
  {needsSim&&<label>SIM network<select value={simProvider} onChange={e=>setSimProvider(e.target.value as SimProvider)}>{SIM_PROVIDERS.map(provider=><option key={provider}>{provider}</option>)}</select><small>All replacement SIMs will be deducted from this network balance.</small></label>}
  {(needsDevice||needsSim)&&<div className="identifier-grid">{Array.from({length:shift.unit_count},(_,i)=><div className="unit-record" key={i}><strong>Unit {i+1}</strong>
   {needsDevice&&<label>{effectiveAction==='device_removal'?'Removed device IMEI':'Device IMEI'}<div className="scan-input"><input required inputMode="numeric" maxLength={17} value={imeis[i]} onChange={e=>setImeis(v=>v.map((x,n)=>n===i?clean(e.target.value):x))} placeholder="Scan QR or enter IMEI"/><button type="button" onClick={()=>openScanner('imei',i)} aria-label={'Scan device IMEI for unit '+(i+1)}><QrCode/></button></div></label>}
   {needsSim&&<label>New SIM number<div className="scan-input"><input required inputMode="numeric" maxLength={22} value={sims[i]} onChange={e=>setSims(v=>v.map((x,n)=>n===i?clean(e.target.value):x))} placeholder="Scan barcode or enter ICCID"/><button type="button" onClick={()=>openScanner('sim',i)} aria-label={'Scan SIM number for unit '+(i+1)}><ScanBarcode/></button></div></label>}
  </div>)}</div>}
  <label>Completion notes {shift.job_type==='inspection'&&inspectionAction==='check_only'?<span className="required">required</span>:<span className="optional">optional</span>}<textarea required={shift.job_type==='inspection'&&inspectionAction==='check_only'} rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Work completed, inspection result, or site notes"/></label>
  <div className="notice info"><MapPin size={17}/>Current location and secure server time are recorded when you confirm completion.</div>
  {error&&<div className="notice error" role="alert">{error}</div>}<div className="form-footer"><small>{deductDevice||needsSim?`Inventory deduction: ${deductDevice?shift.unit_count+' device'+(shift.unit_count===1?'':'s'):''}${deductDevice&&needsSim?' and ':''}${needsSim?shift.unit_count+' SIM'+(shift.unit_count===1?'':'s'):''}.`:effectiveAction==='device_removal'?'Removed device details are recorded without deducting stock.':'Inspection is recorded without changing inventory.'}</small><button className="primary" disabled={busy}>{busy?'Getting location & saving…':'Confirm job completion'}</button></div>
  {scan&&cameraRequest.current&&<BarcodeScanner cameraRequest={cameraRequest.current} label={scan.kind==='imei'?'device QR / IMEI':'SIM barcode'} onScan={scanned} onClose={()=>setScan(null)}/>}</form>;
}
