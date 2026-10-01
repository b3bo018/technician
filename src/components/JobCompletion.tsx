import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, MapPin, QrCode, Radio, ScanBarcode } from 'lucide-react';
import { BarcodeScanner, requestRearCamera } from './BarcodeScanner';
import { DEVICE_MODELS, DeviceModel, InspectionAction, Installation, PendingOperation, Shift, SIM_PROVIDERS, SimProvider, UnitJobType, inspectionLabel, jobLabel } from '../types';
import { captureLocation } from '../lib/location';
import { useDeviceModels } from './DeviceManagement';

const clean=(value:string)=>value.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
const stockDeviceNeeded=(action:string)=>['new_installation','device_change','sim_device_change'].includes(action);
const deviceNeeded=(action:string)=>stockDeviceNeeded(action)||action==='device_removal';
const simNeeded=(action:string)=>['new_installation','sim_change','sim_device_change'].includes(action);

export function JobCompletion({shift,completedUnits,save,onDone}:{shift:Shift;completedUnits:Installation[];save:(op:Omit<PendingOperation,'uid'|'captured_at'>)=>Promise<void>;onDone:(finished:boolean)=>void}) {
 const catalogue=useDeviceModels();const deviceModels=[...new Set([...DEVICE_MODELS,...catalogue.map(item=>item.name)])];
 const assigned=useMemo(()=>Array.from({length:shift.unit_count},(_,index)=>shift.unit_jobs?.[index]||{vehicle_number:shift.vehicle_numbers?.[index]||shift.vehicle_number||'',job_type:(shift.job_type==='mixed'?'inspection':shift.job_type) as UnitJobType}),[shift]);
 const completedIndexes=useMemo(()=>new Set(completedUnits.map(item=>item.unit_index).filter((value):value is number=>Number.isInteger(value))),[completedUnits]);
 const awaitingVerification=useMemo(()=>[...completedUnits].sort((a,b)=>(a.unit_index||0)-(b.unit_index||0)).find(item=>item.online_status!=='showing_online'),[completedUnits]);
 const firstIncomplete=assigned.findIndex((_,index)=>!completedIndexes.has(index));
 const [selectedIndex,setSelectedIndex]=useState(Math.max(0,firstIncomplete));
 const [inspectionAction,setInspectionAction]=useState<InspectionAction>('check_only');
 const [model,setModel]=useState<DeviceModel>('FMC920');const [simProvider,setSimProvider]=useState<SimProvider>('Etisalat');
 const [imei,setImei]=useState('');const [sim,setSim]=useState('');const [notes,setNotes]=useState('');const [receivedAmount,setReceivedAmount]=useState('');const [paymentMethod,setPaymentMethod]=useState<'cash'|'cheque'>('cash');const [scan,setScan]=useState<'imei'|'sim'|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const cameraRequest=useRef<Promise<MediaStream>|null>(null);
 useEffect(()=>{if(completedIndexes.has(selectedIndex)&&firstIncomplete>=0)setSelectedIndex(firstIncomplete)},[completedIndexes,firstIncomplete,selectedIndex]);
 const unit=assigned[selectedIndex];const action=unit?.job_type==='inspection'?inspectionAction:unit?.job_type;
 const needsDevice=deviceNeeded(action||'');const needsStockDevice=stockDeviceNeeded(action||'');const needsSim=simNeeded(action||'');
 const completedCount=completedIndexes.size;
 function resetForNext(){setInspectionAction('check_only');setImei('');setSim('');setNotes('');setReceivedAmount('');setPaymentMethod('cash')}
 function openScanner(kind:'imei'|'sim'){cameraRequest.current=requestRearCamera();setScan(kind)}
 async function submit(e:FormEvent){e.preventDefault();setError('');if(!unit||completedIndexes.has(selectedIndex))return;try{
  const cleanedImei=needsDevice?clean(imei):'',cleanedSim=needsSim?clean(sim):'';
  if(cleanedImei&&!/^[0-9]{14,17}$/.test(cleanedImei))throw new Error('The device IMEI must contain 14–17 digits.');
  if(cleanedSim&&!/^[0-9]{18,22}$/.test(cleanedSim))throw new Error('The SIM number must contain 18–22 digits.');
  if(unit.job_type==='payment_collection'&&!(Number(receivedAmount)>=0))throw new Error('Enter the amount received.');
  if(unit.job_type==='inspection'&&inspectionAction==='check_only'&&!notes.trim())throw new Error('Add inspection notes for this vehicle.');
  setBusy(true);const location=await captureLocation();const finished=completedCount+1===shift.unit_count;
  await save({id:`${shift.id}__unit_${selectedIndex+1}`,kind:'job-completed',shift_id:shift.id,job_type:unit.job_type,inspection_action:unit.job_type==='inspection'?inspectionAction:undefined,unit_count:1,unit_index:selectedIndex,progress_total:shift.unit_count,unit_records:[{...unit,...(unit.job_type==='inspection'?{inspection_action:inspectionAction}:{}),...(needsDevice?{...(needsStockDevice?{device_model:model}:{}),device_imei:cleanedImei}:{}),...(needsSim?{sim_number:cleanedSim}:{})}],device_model:needsStockDevice?model:'',device_imeis:cleanedImei?[cleanedImei]:[],sim_numbers:cleanedSim?[cleanedSim]:[],quantity:needsStockDevice?1:0,sim_count:cleanedSim?1:0,sim_provider:cleanedSim?simProvider:undefined,customer_ref:shift.company_name||shift.customer_name||shift.site_name,vehicle_ref:unit.vehicle_number,notes:notes.trim(),...(unit.job_type==='payment_collection'?{payment_received_amount:Number(receivedAmount),payment_method:paymentMethod}:{}),completion_latitude:location.latitude,completion_longitude:location.longitude,completion_accuracy_m:location.accuracy_m});
  resetForNext();onDone(finished);
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 if(awaitingVerification){const vehicleNumber=awaitingVerification.vehicle_ref||assigned[awaitingVerification.unit_index||0]?.vehicle_number||'Completed vehicle',notShowing=awaitingVerification.online_status==='not_showing';return <div className={'online-verification-wait '+(notShowing?'not-showing':'')}><div className="online-verification-icon">{notShowing?<AlertTriangle/>:<Radio/>}</div><div><span className="eyebrow">VEHICLE {Number(awaitingVerification.unit_index||0)+1} OF {shift.unit_count}</span><h3>{notShowing?'Vehicle is not showing yet':'Waiting for online verification'}</h3><strong>{vehicleNumber}</strong><p>{notShowing?'The office marked this vehicle as not showing. Check the installation, then ask the office to verify it again.':'The vehicle details are saved. The office must confirm that it is showing in the tracking software before the next vehicle opens.'}</p></div></div>}
 if(firstIncomplete<0)return <div className="notice success"><CheckCircle2/>All {shift.unit_count} vehicles are completed and verified. The main job is complete.</div>;
 return <form className="completion-card" onSubmit={submit}><div className="completion-heading"><div><span className="eyebrow">VEHICLE COMPLETION</span><h3>{completedCount}/{shift.unit_count} Completed</h3></div><CheckCircle2/></div>
  <div className="vehicle-progress" aria-label="Vehicle completion progress">{assigned.map((item,index)=>{const done=completedIndexes.has(index);return <button type="button" key={`${item.vehicle_number}-${index}`} disabled={done||busy} className={(selectedIndex===index?'active ':'')+(done?'done':'')} onClick={()=>{setSelectedIndex(index);resetForNext()}}>{done?<CheckCircle2/>:<Circle/>}<span><strong>{item.vehicle_number||`Vehicle ${index+1}`}</strong><small>{done?'Completed':index===selectedIndex?'Selected':'Select vehicle'}</small></span></button>})}</div>
  <div className="active-vehicle"><span>Vehicle {selectedIndex+1} of {shift.unit_count}</span><strong>{unit.vehicle_number||'No vehicle number'}</strong><small>{jobLabel(unit.job_type)}</small></div>
  {needsStockDevice&&<label>Device model<select value={model} onChange={e=>setModel(e.target.value as DeviceModel)}>{deviceModels.map(value=><option key={value}>{value}</option>)}</select></label>}
  {needsSim&&<label>SIM network<select value={simProvider} onChange={e=>setSimProvider(e.target.value as SimProvider)}>{SIM_PROVIDERS.map(value=><option key={value}>{value}</option>)}</select></label>}
  {unit.job_type==='payment_collection'&&<div className="payment-received"><strong>Payment received</strong><div className="form-row"><label>Amount received (AED)<input required type="number" min="0" step="0.01" value={receivedAmount} onChange={e=>setReceivedAmount(e.target.value)} placeholder="0.00"/></label><label>Received by<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as 'cash'|'cheque')}><option value="cash">Cash</option><option value="cheque">Cheque</option></select></label></div></div>}
  <div className="unit-record"><strong>{unit.vehicle_number||'No plate'}</strong><small>Assigned: {jobLabel(unit.job_type)}</small>
   {unit.job_type==='inspection'&&<label>Inspection result<select value={inspectionAction} onChange={e=>setInspectionAction(e.target.value as InspectionAction)}>{(['check_only','device_change','sim_change','sim_device_change'] as InspectionAction[]).map(value=><option key={value} value={value}>{inspectionLabel(value)}</option>)}</select></label>}
   {needsDevice&&<label>Device IMEI<div className="scan-input"><input required inputMode="numeric" maxLength={17} value={imei} onChange={e=>setImei(clean(e.target.value))} placeholder="Scan QR or enter IMEI"/><button type="button" onClick={()=>openScanner('imei')} aria-label="Scan device IMEI"><QrCode/></button></div></label>}
   {needsSim&&<label>SIM number / ICCID<div className="scan-input"><input required inputMode="numeric" maxLength={22} value={sim} onChange={e=>setSim(clean(e.target.value))} placeholder="Scan barcode or enter ICCID"/><button type="button" onClick={()=>openScanner('sim')} aria-label="Scan SIM number"><ScanBarcode/></button></div></label>}
   {!needsDevice&&!needsSim&&<div className="notice info">{unit.job_type==='device_removal'?'Scan the removed device IMEI. No stock is deducted.':'No scan is required for this vehicle.'}</div>}
  </div>
  <label>Completion notes {unit.job_type==='inspection'&&inspectionAction==='check_only'?<span className="required">required</span>:<span className="optional">optional</span>}<textarea required={unit.job_type==='inspection'&&inspectionAction==='check_only'} rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Work completed, inspection result, or site notes"/></label>
  <div className="notice info"><MapPin/>This vehicle gets its own completion time, location, technician and audit record.</div>{error&&<div className="notice error" role="alert">{error}</div>}<div className="form-footer vehicle-completion-footer"><small>{inventoryText(needsStockDevice,needsSim)}</small><button className="primary vehicle-done-button" disabled={busy}><CheckCircle2/>{busy?'Saving this vehicle…':`Done — complete vehicle ${selectedIndex+1}`}</button></div>
  {scan&&cameraRequest.current&&<BarcodeScanner key={`${scan}-${selectedIndex}`} cameraRequest={cameraRequest.current} label={scan==='imei'?'device QR / IMEI':'SIM barcode'} onScan={value=>{const next=clean(value);if(scan==='imei')setImei(next);else setSim(next);setScan(null)}} onClose={()=>setScan(null)}/>}</form>
}
function inventoryText(device:boolean,sim:boolean){return device||sim?`Stock update: ${device?'1 device':''}${device&&sim?' and ':''}${sim?'1 SIM':''} assigned to this vehicle.`:'No inventory is deducted for this vehicle.'}
