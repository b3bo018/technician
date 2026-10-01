import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { CarFront, FileCheck2, Search, Wrench } from 'lucide-react';
import { db } from '../lib/firebase';
import { displayTime, TIME_ZONE } from '../lib/domain';
import { Installation, Shift, inspectionLabel, jobLabel, jobReference } from '../types';

const plateKey=(value?:string)=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const text=(value:any)=>String(value??'').trim();
const normalized=(value:any)=>text(value).toLowerCase();
const timeValue=(value?:string)=>value&&Number.isFinite(Date.parse(value))?Date.parse(value):0;
const recordedTime=(value?:string)=>timeValue(value)?displayTime(value!,TIME_ZONE):'Date not recorded';

type VehicleEvent={
 id:string;vehicle:string;kind:'job'|'certificate';title:string;company:string;technician:string;
 occurredAt:string;status:string;jobId?:string;imei?:string;sim?:string;device?:string;notes?:string;
};

export function VehicleSearch({shifts,installations}:{shifts:Shift[];installations:Installation[]}){
 const [query,setQuery]=useState(()=>sessionStorage.getItem('securetrack:vehicle-search')||'');
 const [certificates,setCertificates]=useState<any[]>([]);
 const [certificateError,setCertificateError]=useState('');
 useEffect(()=>onSnapshot(collection(db,'certificates'),snapshot=>{setCertificates(snapshot.docs.map(item=>({id:item.id,...item.data()})));setCertificateError('')},error=>setCertificateError(error.message)),[]);
 useEffect(()=>{const receive=(event:Event)=>setQuery(String((event as CustomEvent).detail||''));window.addEventListener('securetrack:vehicle-search',receive);return()=>window.removeEventListener('securetrack:vehicle-search',receive)},[]);
 const searchKey=plateKey(query);
 const searchText=normalized(query);
 const events=useMemo(()=>{
  if(searchText.length<2)return[];
  const rows:VehicleEvent[]=[];
  const used=new Set<string>();
  for(const shift of shifts){
   const vehicles=(shift.vehicle_numbers?.length?shift.vehicle_numbers:[shift.vehicle_number||'']);
   const units=vehicles.map((vehicle,index)=>({vehicle,jobType:shift.unit_jobs?.[index]?.job_type||shift.job_type}));
   for(const [index,unit] of units.entries()){
    const candidates=installations.filter(item=>item.shift_id===shift.id||item.id===shift.id);
    const common=[jobReference(shift),shift.id,shift.company_name,shift.customer_name,shift.site_name,shift.contact_person,shift.customer_phone];
    const identifiers=candidates.flatMap(item=>[item.vehicle_ref,item.device_model,...(item.device_imeis||[]),...(item.sim_numbers||[])]);
    const matchesPlate=plateKey(unit.vehicle).includes(searchKey),matchesText=[...common,...identifiers].some(value=>normalized(value).includes(searchText));
    if(!matchesPlate&&!matchesText)continue;
    const completion=candidates.find(item=>item.unit_index===index)||candidates.find(item=>item.unit_records?.some(record=>plateKey(record.vehicle_number)===plateKey(unit.vehicle)))||(units.length===1?candidates[0]:undefined);
    if(completion)used.add(completion.id);
    const record=completion?.unit_records?.find(item=>plateKey(item.vehicle_number)===plateKey(unit.vehicle))||completion?.unit_records?.[0];
    const action=record?.inspection_action?` · ${inspectionLabel(record.inspection_action)}`:'';
    const completedTime=completion?.completed_at||completion?.timestamp;
    rows.push({id:`job-${shift.id}-${index}`,vehicle:unit.vehicle,kind:'job',title:`${jobLabel(unit.jobType)}${action}`,company:shift.company_name||shift.customer_name||shift.site_name||'—',technician:completion?.technician_name||shift.technician_name||'—',occurredAt:timeValue(completedTime)?completedTime!:shift.scheduled_at||shift.date,status:completion?'Completed':shift.status==='in_progress'?'In progress':'Assigned',jobId:jobReference(shift),imei:record?.device_imei||completion?.device_imeis?.[0],sim:record?.sim_number||completion?.sim_numbers?.[0],device:record?.device_model||completion?.device_model,notes:completion?.notes||shift.job_notes});
   }
  }
  for(const installation of installations){
   if(used.has(installation.id))continue;
   const records=installation.unit_records?.length?installation.unit_records:[{vehicle_number:installation.vehicle_ref,job_type:installation.job_type||'inspection',device_model:installation.device_model as any,device_imei:installation.device_imeis?.[0],sim_number:installation.sim_numbers?.[0]}];
   records.forEach((record,index)=>{
    if(!plateKey(record.vehicle_number).includes(searchKey))return;
    rows.push({id:`installation-${installation.id}-${index}`,vehicle:record.vehicle_number||installation.vehicle_ref,kind:'job',title:jobLabel(record.job_type),company:installation.customer_ref||'—',technician:installation.technician_name||'—',occurredAt:installation.completed_at||installation.timestamp||'',status:'Completed',jobId:installation.shift_id,imei:record.device_imei||installation.device_imeis?.[index],sim:record.sim_number||installation.sim_numbers?.[index],device:record.device_model||installation.device_model,notes:installation.notes});
   });
  }
  for(const certificate of certificates){
   const values=[certificate.vehicle_number,certificate.chassis_number,certificate.tracker_id,certificate.device_imei,certificate.sim_number,certificate.company_name,certificate.contact_person];
   if(!plateKey(certificate.vehicle_number).includes(searchKey)&&!values.some(value=>normalized(value).includes(searchText)))continue;
   rows.push({id:`certificate-${certificate.id}`,vehicle:text(certificate.vehicle_number),kind:'certificate',title:`Certificate · ${text(certificate.service_type)||'GPS service'}`,company:text(certificate.company_name)||'—',technician:text(certificate.issued_by)||'—',occurredAt:text(certificate.issue_date),status:`${text(certificate.installation_status)||'Not Installed'} · ${text(certificate.payment_status)||'Unpaid'}`,imei:text(certificate.tracker_id),device:text(certificate.device_type),notes:text(certificate.remarks)});
  }
  return rows.sort((a,b)=>timeValue(b.occurredAt)-timeValue(a.occurredAt));
 },[searchKey,searchText,shifts,installations,certificates]);
 const exactVehicles=[...new Set(events.map(item=>item.vehicle).filter(Boolean))];
 return <div className="stack vehicle-search-page">
  <section className="panel vehicle-search-hero"><div className="section-title"><div className="icon-box"><CarFront/></div><div><span className="eyebrow">VEHICLES & CUSTOMERS</span><h2>Search all vehicle records</h2><p>Search by vehicle, chassis, IMEI, SIM, company name or Job ID. Partial company names are supported.</p></div></div><label className="vehicle-search-input"><Search/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Vehicle, company, IMEI, SIM, chassis or Job ID"/></label></section>
  {certificateError&&<div className="notice warning">Job history is available. Certificate history could not be loaded: {certificateError}</div>}
  {searchText.length<2&&<section className="panel empty vehicle-search-empty"><CarFront/><h3>Search vehicle records</h3><p>Enter at least two characters. Spaces, slashes and dashes do not affect vehicle matching.</p></section>}
  {searchText.length>=2&&!events.length&&<section className="panel empty vehicle-search-empty"><Search/><h3>No matching history found</h3><p>Check the search value and try again.</p></section>}
  {!!events.length&&<><section className="vehicle-search-summary"><div><span>MATCHING RECORDS</span><strong>{events.length}</strong></div><div><span>VEHICLE NUMBERS</span><strong>{exactVehicles.length}</strong></div><div><span>COMPLETED JOBS</span><strong>{events.filter(item=>item.kind==='job'&&item.status==='Completed').length}</strong></div><div><span>CERTIFICATES</span><strong>{events.filter(item=>item.kind==='certificate').length}</strong></div></section><section className="panel"><div className="section-label"><div><h2>Complete vehicle history</h2><p>{exactVehicles.join(' · ')}</p></div><span>{events.length} record{events.length===1?'':'s'}</span></div><div className="vehicle-history-list">{events.map(item=><article className="vehicle-history-card" key={item.id}><div className={`vehicle-history-icon ${item.kind}`}>{item.kind==='certificate'?<FileCheck2/>:<Wrench/>}</div><div className="vehicle-history-main"><div><span className="eyebrow">{item.kind==='certificate'?'CERTIFICATE':item.jobId||'RECORDED WORK'}</span><h3>{item.title}</h3></div><span className={`badge ${item.status==='Completed'?'good':''}`}>{item.status}</span><dl><div><dt>Vehicle</dt><dd>{item.vehicle}</dd></div><div><dt>Company</dt><dd>{item.company}</dd></div><div><dt>{item.kind==='certificate'?'Issued by':'Technician'}</dt><dd>{item.technician}</dd></div><div><dt>Date / time</dt><dd>{recordedTime(item.occurredAt)}</dd></div>{item.device&&<div><dt>Device</dt><dd>{item.device}</dd></div>}{item.imei&&<div><dt>{item.kind==='certificate'?'Tracker ID':'IMEI'}</dt><dd className="mono-cell">{item.imei}</dd></div>}{item.sim&&<div><dt>SIM / ICCID</dt><dd className="mono-cell">{item.sim}</dd></div>}{item.notes&&<div className="wide"><dt>Notes</dt><dd>{item.notes}</dd></div>}</dl></div></article>)}</div></section></>}
 </div>;
}
