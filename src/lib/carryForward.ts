import { doc, runTransaction, serverTimestamp, Timestamp, type Firestore, type Transaction } from 'firebase/firestore';
import type { Shift, Technician } from '../types';
import { localToISO, nextDate, TIME_ZONE } from './domain';

export type CarryConflict={job:string;conflictingJob:string;date:string};
type AuditWriter=(tx:Transaction,actor:Technician,id:string,current:any,to:string)=>void;
export function needsCarryForward(shift:Partial<Shift>,today:string){
 return !!shift.date&&shift.date<today&&!shift.is_deleted&&!!shift.technician_id
  &&['assigned','in_progress'].includes(shift.status||'assigned')
  &&Number(shift.completed_units||0)<Number(shift.unit_count||0);
}
function clock(value:any){
 const date=value?.toDate?.()||new Date(value);
 if(!Number.isFinite(date.getTime()))return null;
 return new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
}
function overlaps(a:any,b:any){return Date.parse(a.start_at)<Date.parse(b.end_at)&&Date.parse(a.end_at)>Date.parse(b.start_at)}

export async function carryForwardJobs(db:Firestore,shifts:Shift[],today:string,actor:Technician,audit:AuditWriter){
 const result={moved:0,conflicts:[] as CarryConflict[]};
 if(!['master_admin','admin'].includes(actor.role))return result;
 for(const target of shifts.filter(shift=>needsCarryForward(shift,today))){
  for(let attempt=0;attempt<366;attempt++){
   const outcome=await runTransaction(db,async tx=>{
    const ref=doc(db,'shifts',target.id),snap=await tx.get(ref);
    if(!snap.exists())return {advanced:false};
    const current=snap.data();
    if(!needsCarryForward(current,today))return {advanced:false};
    const from=String(current.date),time=clock(current.scheduled_at);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!time)return {advanced:false};
    const to=nextDate(from),uid=current.technician_id;
    const oldLock=doc(db,'schedule_locks',`${uid}_${from}`),newLock=doc(db,'schedule_locks',`${uid}_${to}`);
    const oldSnap=await tx.get(oldLock),newSnap=await tx.get(newLock);
    const scheduled=localToISO(to,time),expected=new Date(Date.parse(scheduled)+Number(current.duration_minutes||60)*60000).toISOString();
    const entries={...(newSnap.data()?.entries||{})};
    const entry={shift_id:target.id,job_reference:current.job_reference||'',start_at:scheduled,end_at:expected,company:current.company_name||current.customer_name||'',location:current.site_name||''};
    // Validate overlapping reservations against their current jobs, within this transaction.
    for(const [id,reservation] of Object.entries(entries) as [string,any][]){
     if(id===target.id||!overlaps(entry,reservation))continue;
     const other=await tx.get(doc(db,'shifts',id)),job=other.data();
     if(!job||job.is_deleted||['completed','cancelled','draft'].includes(job.status)||job.technician_id!==uid||job.date!==to){delete entries[id];continue}
     return {advanced:false,conflict:{job:current.job_reference||target.id,conflictingJob:job.job_reference||reservation.job_reference||id,date:to}};
    }
    entries[target.id]=entry;
    const oldEntries={...(oldSnap.data()?.entries||{})};delete oldEntries[target.id];
    tx.update(ref,{date:to,scheduled_at:Timestamp.fromDate(new Date(scheduled)),expected_end_at:Timestamp.fromDate(new Date(expected)),window_start:Timestamp.fromDate(new Date(localToISO(to,'00:00'))),window_end:Timestamp.fromDate(new Date(localToISO(nextDate(to),'00:00'))),original_scheduled_date:current.original_scheduled_date||from,carried_forward:true,carried_forward_count:Number(current.carried_forward_count||0)+1,last_carried_forward_from:from,last_carried_forward_at:serverTimestamp(),version:Number(current.version||1)+1,updated_by_uid:actor.uid,updated_by_name:actor.displayName||actor.email,updated_at:serverTimestamp()});
    tx.set(oldLock,{technician_id:uid,date:from,entries:oldEntries,updated_at:serverTimestamp()},{mergeFields:['technician_id','date','entries','updated_at']});
    tx.set(newLock,{technician_id:uid,date:to,entries,updated_at:serverTimestamp()},{mergeFields:['technician_id','date','entries','updated_at']});
    tx.set(doc(db,'job_schedule_history',`${target.id}_${to}`),{shift_id:target.id,job_reference:current.job_reference||'',vehicle_numbers:current.vehicle_numbers||[current.vehicle_number||''],from_date:from,to_date:to,action:`Automatically carried forward from ${from} to ${to}.`,changed_by:'SecureTrack automatic carry-forward',changed_by_uid:actor.uid,changed_at:serverTimestamp()},{merge:false});
    audit(tx,actor,target.id,current,to);
    return {advanced:true};
   });
   if(outcome.conflict)result.conflicts.push(outcome.conflict);
   if(!outcome.advanced)break;
   result.moved++;
  }
 }
 return result;
}
