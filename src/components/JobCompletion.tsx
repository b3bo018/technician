import { FormEvent, useCallback, useMemo, useRef, useState } from 'react';
import { CheckCircle2, MapPin, QrCode, ScanBarcode } from 'lucide-react';
import { BarcodeScanner, requestRearCamera } from './BarcodeScanner';
import { DEVICE_MODELS, DeviceModel, InspectionAction, PendingOperation, Shift, SIM_PROVIDERS, SimProvider, UnitCompletion, UnitJobType, inspectionLabel, jobLabel } from '../types';
import { captureLocation } from '../lib/location';

const clean=(value:string)=>value.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
const deviceNeeded=(action:string)=>['new_installation','device_change','sim_device_change'].includes(action);
const simNeeded=(action:string)=>['new_installation','sim_change','sim_device_change'].includes(action);

export function JobCompletion({shift,save,onDone}:{shift:Shift;save:(op:Omit<PendingOperation,'uid'|'captured_at'>)=>Promise<void>;onDone:()=>void}) {
 const assigned=useMemo(()=>Array.from({length:shift.unit_count},(_,index)=>shift.unit_jobs?.[index]||{vehicle_number:shift.vehicle_numbers?.[index]||shift.vehicle_number||'',job_type:(shift.job_type==='mixed'?'inspection':shift.job_type) as UnitJobType}),[shift]);
 const [inspectionActions,setInspectionActions]=useState<InspectionAction[]>(assigned.map(()=>'check_only'));
 const [model,setModel]=useState<DeviceModel>('FMC920');const [simProvider,setSimProvider]=useState<SimProvider>('Etisalat');
 const [imeis,setImeis]=useState<string[]>(Array(shift.unit_count).fill(''));const [sims,setSims]=useState<string[]>(Array(shift.unit_count).fill(''));
 const [notes,setNotes]=useState('');const [scan,setScan]=useState<{kind:'imei'|'sim';index:number}|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const cameraRequest=useRef<Promise<MediaStream>|null>(null);
 const actionFor=(index:number)=>assigned[index].job_type==='inspection'?inspectionActions[index]:assigned[index].job_type;
 const anyDevice=assigned.some((_,index)=>deviceNeeded(actionFor(index)));const anySim=assigned.some((_,index)=>simNeeded(actionFor(index)));
 function openScanner(kind:'imei'|'sim',index:number){cameraRequest.current=requestRearCamera();setScan({kind,index})}
 const scanned=useCallback((value:string)=>{if(!scan)return;const next=clean(value);if(scan.kind==='imei')setImeis(v=>v.map((x,i)=>i===scan.index?next:x));else setSims(v=>v.map((x,i)=>i===scan.index?next:x));setScan(null)},[scan]);
 async function submit(e:FormEvent){e.preventDefault();setError('');try{
  const unitRecords:UnitCompletion[]=assigned.map((unit,index)=>{const action=actionFor(index);return{...unit,...(unit.job_type==='inspection'?{inspection_action:inspectionActions[index]}:{}),...(deviceNeeded(action)?{device_model:model,device_imei:clean(imeis[index])}:{}),...(simNeeded(action)?{sim_number:clean(sims[index])}:{})}});
  const di=unitRecords.map(row=>row.device_imei||'').filter(Boolean);const sn=unitRecords.map(row=>row.sim_number||'').filter(Boolean);
  if(di.some(value=>!/^[0-9]{14,17}$/.test(value)))throw new Error('Each required device IMEI must contain 14–17 digits.');
  if(sn.some(value=>!/^[0-9]{18,22}$/.test(value)))throw new Error('Each required SIM number must contain 18–22 digits.');
  if(new Set(di).size!==di.length||new Set(sn).size!==sn.length)throw new Error('The same IMEI or SIM number cannot be entered twice.');
  if(unitRecords.some(row=>row.job_type==='inspection'&&row.inspection_action==='check_only')&&!notes.trim())throw new Error('Add inspection notes for every check-only result.');
  setBusy(true);const location=await captureLocation();
  await save({id:shift.id,kind:'job-completed',shift_id:shift.id,job_type:shift.job_type,inspection_action:shift.job_type==='inspection'?inspectionActions[0]:undefined,unit_count:shift.unit_count,unit_records:unitRecords,device_model:di.length?model:'',device_imeis:di,sim_numbers:sn,quantity:di.length,sim_count:sn.length,sim_provider:sn.length?simProvider:undefined,customer_ref:shift.company_name||shift.customer_name||shift.site_name,vehicle_ref:assigned.map(row=>row.vehicle_number).filter(Boolean).join(' · '),notes:notes.trim(),completion_latitude:location.latitude,completion_longitude:location.longitude,completion_accuracy_m:location.accuracy_m});onDone();
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <form className="completion-card" onSubmit={submit}><div className="completion-heading"><div><span className="eyebrow">JOB COMPLETION</span><h3>{jobLabel(shift.job_type)} · {shift.unit_count} unit{shift.unit_count===1?'':'s'}</h3></div><CheckCircle2/></div>
  {anyDevice&&<label>Replacement device model<select value={model} onChange={e=>setModel(e.target.value as DeviceModel)}>{DEVICE_MODELS.map(value=><option key={value}>{value}</option>)}</select></label>}
  {anySim&&<label>Replacement SIM network<select value={simProvider} onChange={e=>setSimProvider(e.target.value as SimProvider)}>{SIM_PROVIDERS.map(value=><option key={value}>{value}</option>)}</select></label>}
  <div className="identifier-grid">{assigned.map((unit,index)=>{const action=actionFor(index);const needsDevice=deviceNeeded(action);const needsSim=simNeeded(action);return <div className="unit-record" key={index}><strong>Unit {index+1} · {unit.vehicle_number||'No plate'}</strong><small>Assigned: {jobLabel(unit.job_type)}</small>
   {unit.job_type==='inspection'&&<label>Inspection result<select value={inspectionActions[index]} onChange={e=>setInspectionActions(values=>values.map((value,n)=>n===index?e.target.value as InspectionAction:value))}>{(['check_only','device_change','sim_change','sim_device_change'] as InspectionAction[]).map(value=><option key={value} value={value}>{inspectionLabel(value)}</option>)}</select></label>}
   {needsDevice&&<label>Device IMEI<div className="scan-input"><input required inputMode="numeric" maxLength={17} value={imeis[index]} onChange={e=>setImeis(values=>values.map((value,n)=>n===index?clean(e.target.value):value))} placeholder="Scan QR or enter IMEI"/><button type="button" onClick={()=>openScanner('imei',index)} aria-label={`Scan device IMEI for unit ${index+1}`}><QrCode/></button></div></label>}
   {needsSim&&<label>New SIM number<div className="scan-input"><input required inputMode="numeric" maxLength={22} value={sims[index]} onChange={e=>setSims(values=>values.map((value,n)=>n===index?clean(e.target.value):value))} placeholder="Scan barcode or enter ICCID"/><button type="button" onClick={()=>openScanner('sim',index)} aria-label={`Scan SIM number for unit ${index+1}`}><ScanBarcode/></button></div></label>}
   {!needsDevice&&!needsSim&&<div className="notice info">{unit.job_type==='device_removal'?'Removal recorded without scanning a device or SIM.':'No scan required for a check-only inspection.'}</div>}
  </div>})}</div>
  <label>Completion notes {assigned.some((unit,index)=>unit.job_type==='inspection'&&inspectionActions[index]==='check_only')?<span className="required">required</span>:<span className="optional">optional</span>}<textarea required={assigned.some((unit,index)=>unit.job_type==='inspection'&&inspectionActions[index]==='check_only')} rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Work completed, inspection result, or site notes"/></label>
  <div className="notice info"><MapPin/>One completion time and location are recorded for this site.</div>{error&&<div className="notice error" role="alert">{error}</div>}<div className="form-footer"><small>{inventoryText(assigned.map((_,index)=>actionFor(index)))}</small><button className="primary" disabled={busy}>{busy?'Getting location & saving…':'Confirm job completion'}</button></div>
  {scan&&cameraRequest.current&&<BarcodeScanner cameraRequest={cameraRequest.current} label={scan.kind==='imei'?'device QR / IMEI':'SIM barcode'} onScan={scanned} onClose={()=>setScan(null)}/>}</form>
}
function inventoryText(actions:string[]){const devices=actions.filter(deviceNeeded).length;const sims=actions.filter(simNeeded).length;return devices||sims?`Inventory deduction: ${devices} device${devices===1?'':'s'} and ${sims} SIM${sims===1?'':'s'}.`:'No inventory is deducted for removals or check-only inspections.'}
