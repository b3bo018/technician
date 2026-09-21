import { X } from 'lucide-react';
import { Attendance, Installation, Shift, inspectionLabel, jobLabel } from '../types';
import { displayTime, workDurationMinutes } from '../lib/domain';

export function JobDetailModal({shift,installation,attendance,onClose}:{shift:Shift;installation?:Installation;attendance?:Attendance;onClose:()=>void}){
 const status=installation?'Completed':attendance?'In progress':'Assigned';
 const duration=installation&&attendance?workDurationMinutes(shift,attendance,installation):0;
 const row=(label:string,value:React.ReactNode)=><div><span>{label}</span><strong>{value||'—'}</strong></div>;
 return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="job-detail-modal" role="dialog" aria-modal="true" aria-label="Job details"><header><div><span className="eyebrow">JOB DETAILS</span><h2>{shift.company_name||shift.site_name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X/></button></header><div className="job-detail-grid">
  {row('Job ID / reference',shift.id)}{row('Status',status)}{row('Job type',jobLabel(shift.job_type))}{shift.job_type==='inspection'&&row('Inspection result',inspectionLabel(installation?.inspection_action))}
  {row('Customer',shift.company_name||shift.customer_name||shift.site_name)}{row('Vehicle plate(s)',(shift.vehicle_numbers?.length?shift.vehicle_numbers:[shift.vehicle_number]).filter(Boolean).join(' · '))}
  {row('Assigned technician',shift.technician_name)}{row('Assigned at',displayTime(shift.assigned_at||shift.scheduled_at,shift.timezone))}
  {row('Arrived at',attendance?displayTime(attendance.timestamp,shift.timezone):'—')}{row('Completed at',installation?displayTime(installation.completed_at||installation.timestamp,shift.timezone):'—')}
  {row('Duration on site',duration?`${Math.floor(duration/60)}h ${duration%60}m`:'—')}{row('Device model',installation?.device_model)}
  {row('IMEI',(installation?.device_imeis||[]).join(' · '))}{row('SIM number',(installation?.sim_numbers||[]).join(' · '))}
  {row('Arrival location',attendance?<a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${attendance.latitude},${attendance.longitude}`}>Open map · ±{Math.round(attendance.accuracy_m)} m</a>:'—')}
  {row('Completion location',installation?.completion_latitude!=null?<a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${installation.completion_latitude},${installation.completion_longitude}`}>Open map · ±{Math.round(installation.completion_accuracy_m||0)} m</a>:'—')}
  <div className="detail-wide"><span>Job instructions</span><strong>{shift.job_notes||'—'}</strong></div><div className="detail-wide"><span>Completion notes</span><strong>{installation?.notes||'—'}</strong></div>
 </div></section></div>
}
