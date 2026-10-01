import { collection, doc, serverTimestamp, type Transaction, type WriteBatch } from './cloud/store';
import { db } from './aws';
import type { Role, Technician } from '../types';

export type AuditAction='CREATED'|'EDITED'|'ASSIGNED'|'REASSIGNED'|'COMPLETED'|'CANCELLED'|'DELETED'|'RESTORED'|'IMPORTED'|'EXPORTED'|'STATUS_CHANGED'|'PAYMENT_STATUS_CHANGED'|'PERMISSION_CHANGED';
export type AuditActor=Pick<Technician,'uid'|'email'|'displayName'|'role'>;
export type AuditChanges=Record<string,{old:string|number|boolean|null;new:string|number|boolean|null}>;

const scalar=(value:any):string|number|boolean|null=>value==null?null:value instanceof Date?value.toISOString():typeof value==='object'?JSON.stringify(value):value;
const token=(value:any)=>String(value??'').trim().toLowerCase();

export function changedFields(before:Record<string,any>,after:Record<string,any>,fields?:string[]):AuditChanges{
 const keys=fields||[...new Set([...Object.keys(before),...Object.keys(after)])];
 return Object.fromEntries(keys.flatMap(key=>{const oldValue=scalar(before[key]),newValue=scalar(after[key]);return JSON.stringify(oldValue)===JSON.stringify(newValue)?[]:[[key,{old:oldValue,new:newValue}]]}));
}

export function auditEvent(actor:AuditActor,action:AuditAction,module:string,recordId:string,details:Record<string,any>={}){
 const changes=(details.changes||{}) as AuditChanges;
 const searchable=[actor.uid,actor.displayName,actor.email,actor.role,module,action,recordId,details.company,details.vehicle,details.chassis,details.imei,details.sim,details.job_id,details.certificate_number]
  .map(token).filter(Boolean).flatMap(value=>[value,...value.split(/\s+/).filter(part=>part.length>1)]);
 return {
  actor_uid:actor.uid,actor_name:actor.displayName||actor.email,actor_email:actor.email,actor_role:actor.role as Role,
  action,module,record_id:recordId,company:token(details.company)?String(details.company):'',vehicle:token(details.vehicle)?String(details.vehicle):'',chassis:token(details.chassis)?String(details.chassis):'',
  imei:token(details.imei)?String(details.imei):'',sim:token(details.sim)?String(details.sim):'',job_id:token(details.job_id)?String(details.job_id):'',certificate_number:token(details.certificate_number)?String(details.certificate_number):'',
  reason:token(details.reason)?String(details.reason).slice(0,1000):'',changes,deleted_record:!!details.deleted_record,
  search_tokens:[...new Set(searchable)].slice(0,80),created_at:serverTimestamp()
 };
}

export function addAuditToBatch(batch:WriteBatch,actor:AuditActor,action:AuditAction,module:string,recordId:string,details:Record<string,any>={}){
 batch.set(doc(collection(db,'audit_events')),auditEvent(actor,action,module,recordId,details));
}

export function addAuditToTransaction(tx:Transaction,actor:AuditActor,action:AuditAction,module:string,recordId:string,details:Record<string,any>={}){
 tx.set(doc(collection(db,'audit_events')),auditEvent(actor,action,module,recordId,details));
}
