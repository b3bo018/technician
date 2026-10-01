import { createUserWithEmailAndPassword, deleteUser, getAuth, inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut, updateProfile, User } from 'firebase/auth';
import { deleteApp, initializeApp } from 'firebase/app';
import { collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import localforage from 'localforage';
import { auth, db } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { Attendance, DEVICE_MODELS, emptyStock, Installation, InventoryAccount, Movement, PendingOperation, Role, SIM_PROVIDERS, SIM_STOCK_KEYS, Shift, simStockKey, Stock, StockAlertSettings, Technician, WorkBreak, WorkSession } from '../types';
import { localToISO, nextDate, openingStock, stockAt, TIME_ZONE, validateOperation } from './domain';
import { captureLocation } from './location';
import { addAuditToBatch, addAuditToTransaction, changedFields, type AuditActor } from './audit';

export const iso = (v: any): string => typeof v === 'string' ? v : v?.toDate?.().toISOString() || new Date().toISOString();
export async function ensureProfile(user: User, name = '') {
  const ref = doc(db, 'users', user.uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) tx.set(ref, { uid: user.uid, email: user.email || '', displayName: name || user.displayName || '', photoDataUrl: '', role: 'technician', status: 'active', inventory_count: 0, inventory_breakdown: { fmc920: 0, fmc130: 0, sim_cards: 0 }, created_at: serverTimestamp() });
  });
}
export async function ensureInventory(user: Technician) {
  const ref = doc(db, 'inventory_accounts', user.uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const profile = await tx.get(doc(db, 'users', user.uid));
    if (!snap.exists()) tx.set(ref, { technician_id: user.uid, opening: openingStock({ ...profile.data(), uid: user.uid } as Technician), timestamp: serverTimestamp() });
  });
}
async function ensureLiveStock(user:Technician){const ref=doc(db,'technician_live_stock',user.uid),ready=await getDoc(ref);if(ready.exists())return;const [accountSnap,movementsSnap]=await Promise.all([getDoc(doc(db,'inventory_accounts',user.uid)),getDocs(query(collection(db,'inventory_logs'),where('technician_id','==',user.uid)))]),account=accountSnap.exists()?mapAccount(accountSnap.id,accountSnap.data()):undefined,movements=movementsSnap.docs.map(row=>mapMovement(row.id,row.data())),balance=stockAt(account,movements);await runTransaction(db,async tx=>{const current=await tx.get(ref);if(!current.exists())tx.set(ref,{technician_id:user.uid,balance,updated_at:serverTimestamp()})})}
export function observeProfile(uid: string, callback: (t: Technician | null) => void, error: (e: Error) => void) {
  return onSnapshot(doc(db, 'users', uid), s => callback(s.exists() ? { ...s.data(), uid } as Technician : null), error);
}
export function observe<T>(name: string, uid: string | null, map: (id: string, d: any) => T, callback: (data: T[]) => void, error: (e: Error) => void, field = 'technician_id') {
  const q = uid ? query(collection(db, name), where(field, '==', uid)) : query(collection(db, name));
  return onSnapshot(q, { includeMetadataChanges: true }, s => callback(s.docs.filter(d => !d.metadata.hasPendingWrites).map(d => map(d.id, d.data()))), error);
}
export const mapMovement = (id: string, d: any): Movement => ({ ...d, id, sim_provider: d.sim_provider || undefined, timestamp: iso(d.timestamp) });
export const mapAccount = (_: string, d: any): InventoryAccount => ({ ...d, timestamp: iso(d.timestamp) });
const minimumMap=(value:any)=>Object.fromEntries(Object.entries(value||{}).map(([key,count])=>[key,Math.max(0,Math.min(10000,Math.floor(Number(count)||0))) ]));
export function observeStockAlertSettings(callback:(settings:StockAlertSettings)=>void,error:(e:Error)=>void){return onSnapshot(doc(db,'settings','stock_alerts'),snap=>{const data=snap.data()||{};callback({threshold:Math.max(0,Math.min(10000,Number(data.threshold||2)||0)),device_minimums:minimumMap(data.device_minimums),sim_minimums:minimumMap(data.sim_minimums),clock_in_time:String(data.clock_in_time||'09:00'),clock_out_time:String(data.clock_out_time||'18:00'),late_grace_minutes:Math.max(0,Math.min(180,Number(data.late_grace_minutes||5)||0)),max_break_minutes:Math.max(1,Math.min(240,Number(data.max_break_minutes||60)||60))})},error)}
export const mapShift = (id: string, d: any): Shift => ({ ...d, id, company_name: d.company_name || d.customer_name || '', contact_person: d.contact_person || '', job_type: d.job_type || 'new_installation', unit_count: d.unit_count || 1, status:d.status||'assigned', version:Number(d.version||1), assigned_at:(d.assigned_at||d.created_at)?iso(d.assigned_at||d.created_at):undefined, arrived_at:d.arrived_at?iso(d.arrived_at):undefined, completed_at:d.completed_at?iso(d.completed_at):undefined, deleted_at:d.deleted_at?iso(d.deleted_at):undefined, scheduled_at:d.scheduled_at?iso(d.scheduled_at):(d.date||''), expected_end_at:d.expected_end_at?iso(d.expected_end_at):undefined, window_start:d.window_start?iso(d.window_start):(d.date||''), window_end:d.window_end?iso(d.window_end):(d.date||'') });
export const mapAttendance = (id: string, d: any): Attendance => ({ ...d, id, timestamp: iso(d.timestamp) });
export const mapWorkSession = (id:string,d:any):WorkSession => ({...d,id,clock_in_at:iso(d.clock_in_at),clock_out_at:d.clock_out_at?iso(d.clock_out_at):undefined});
export const mapWorkBreak = (id:string,d:any):WorkBreak => ({...d,id,started_at:iso(d.started_at),ended_at:d.ended_at?iso(d.ended_at):undefined});
export const mapInstallation = (id: string, d: any): Installation => ({
  id, technician_id: d.technician_id || d.tech_id, technician_name: d.technician_name || d.tech_email || '',
  shift_id: d.shift_id || '', job_type: d.job_type || 'new_installation', unit_count: d.unit_count || 1, unit_index:Number.isInteger(d.unit_index)?d.unit_index:undefined, progress_completed:d.progress_completed||undefined, progress_total:d.progress_total||undefined,
  unit_records:d.unit_records||undefined,device_model: d.device_model || d.device_type || '', device_imeis: d.device_imeis || (d.imei ? [d.imei] : []), sim_numbers: d.sim_numbers || (d.sim_number ? [d.sim_number] : []), sim_count: d.sim_count ?? (d.sim_number ? 1 : 0), sim_provider: d.sim_provider || undefined,
  customer_ref: d.customer_ref || d.customer_name || '', vehicle_ref: d.vehicle_ref || '', notes: d.notes || '',
  timestamp:(d.completed_at||d.timestamp)?iso(d.completed_at||d.timestamp):'', completed_at:(d.completed_at||d.timestamp)?iso(d.completed_at||d.timestamp):undefined, completion_latitude:d.completion_latitude, completion_longitude:d.completion_longitude, completion_accuracy_m:d.completion_accuracy_m, inspection_action:d.inspection_action,
  completion_source:d.completion_source||undefined,completed_by_uid:d.completed_by_uid||undefined,completed_by_name:d.completed_by_name||undefined,completed_by_role:d.completed_by_role||undefined,completion_reason:d.completion_reason||undefined,online_status:d.online_status||'not_checked',online_status_updated_at:d.online_status_updated_at?iso(d.online_status_updated_at):undefined,online_status_updated_by:d.online_status_updated_by||undefined,
  legacy: !d.technician_id
});
const outbox = localforage.createInstance({ name: 'SecureTrackPWA', storeName: 'operations_v2' });
const assignmentKey=(kind:'imei'|'sim',value:string)=>`${kind}_${value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')}`;
export async function pending(uid: string): Promise<PendingOperation[]> {
  const rows: PendingOperation[] = [];
  await outbox.iterate<PendingOperation, void>(value => { if (value.uid === uid) rows.push(value); });
  return rows.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
}
export async function queueOperation(op: PendingOperation) {
  validateOperation(op);
  await outbox.setItem(op.uid + ':' + op.id, op);
}
export async function commitOperation(op: PendingOperation, user: Technician) {
  validateOperation(op);
  if (auth.currentUser?.uid !== op.uid || user.uid !== op.uid) throw new Error('Sign in to the account that saved this entry.');
  await ensureLiveStock(user);const moveRef = doc(db, 'inventory_logs', op.id);
  await runTransaction(db, async tx => {
    const installRef = doc(db, 'installations', op.id);
    const shiftRef = doc(db, 'shifts', op.shift_id || op.id);
    const installation = await tx.get(installRef);
    if (installation.exists()) return;
    const existing = await tx.get(moveRef);
    const assigned = op.kind === 'job-completed' ? await tx.get(shiftRef) : null;
    const liveRef=doc(db,'technician_live_stock',user.uid),liveSnap=await tx.get(liveRef);
    const isVehicleCompletion=op.kind==='job-completed'&&Number.isInteger(op.unit_index)&&Number.isInteger(op.progress_total);
    const siblingRefs=isVehicleCompletion?Array.from({length:op.progress_total!},(_,index)=>doc(db,'installations',`${op.shift_id}__unit_${index+1}`)):[];
    const siblingDocs=isVehicleCompletion?await Promise.all(siblingRefs.map(ref=>tx.get(ref))):[];
    const assignmentRefs=[...(op.device_imeis||[]).map(value=>({kind:'imei' as const,value,ref:doc(db,'assignment_index',assignmentKey('imei',value))})),...(op.sim_numbers||[]).map(value=>({kind:'sim' as const,value,ref:doc(db,'assignment_index',assignmentKey('sim',value))}))],assignmentSnaps=await Promise.all(assignmentRefs.map(item=>tx.get(item.ref)));
    assignmentSnaps.forEach((snap,index)=>{const row=snap.data();if(snap.exists()&&row?.status==='active'&&row.vehicle!==op.vehicle_ref)throw new Error(`${assignmentRefs[index].kind==='imei'?'IMEI':'SIM'} ${assignmentRefs[index].value} is already assigned to ${row.vehicle}.`) });
    if (existing.exists()) throw new Error('This assignment has an incomplete inventory record. Contact an administrator.');
    if (op.quantity + op.sim_count > 0) {
      const balance={...emptyStock(),...(liveSnap.data()?.balance||{})} as Stock,simKey=simStockKey(op.sim_provider);if(op.quantity&&balance[op.device_model]<op.quantity)throw new Error(`Only ${balance[op.device_model]} ${op.device_model} remain in your confirmed stock.`);if(op.sim_count&&balance[simKey]<op.sim_count)throw new Error(`Only ${balance[simKey]} ${simKey} card${balance[simKey]===1?'':'s'} remain in your confirmed stock.`);if(op.quantity)balance[op.device_model]-=op.quantity;if(op.sim_count)balance[simKey]-=op.sim_count;tx.update(liveRef,{balance,updated_at:serverTimestamp()});
      const movement = { technician_id: user.uid, technician_name: user.displayName || user.email, type: op.quantity ? 'installed' : 'sim-used', device_model: op.device_model, quantity: op.quantity, sim_count: op.sim_count, ...(op.sim_count ? {sim_provider:op.sim_provider} : {}), timestamp: serverTimestamp(), captured_at: Timestamp.fromDate(new Date(op.captured_at)), notes: op.notes };
      tx.set(moveRef, movement);
    }
    if (op.kind === 'installed' || op.kind === 'job-completed') {
      assignmentRefs.forEach((item,index)=>{const existingAssignment=assignmentSnaps[index].data();tx.set(item.ref,{kind:item.kind,value:item.value,vehicle:op.vehicle_ref,company:op.customer_ref,shift_id:op.shift_id||op.id,installation_id:op.id,status:op.job_type==='device_removal'?'uninstalled':'active',assigned_by_uid:user.uid,assigned_by_name:user.displayName||user.email,assigned_at:serverTimestamp(),...(existingAssignment?{previous_vehicle:existingAssignment.vehicle||''}:{})},{merge:true})});
      tx.set(installRef, {
      technician_id: user.uid, technician_name: user.displayName || user.email, device_model: op.device_model,
      shift_id: op.shift_id || '', job_type: op.job_type || 'new_installation', unit_count: op.unit_count||assigned?.data()?.unit_count||Math.max(op.quantity, op.sim_count, op.device_imeis?.length || 0, 1),
      ...(isVehicleCompletion?{unit_index:op.unit_index,progress_completed:siblingDocs.filter(snap=>snap.exists()).length+1,progress_total:op.progress_total,completed_by_uid:user.uid,completed_by_name:user.displayName||user.email}:{}),
      ...(op.inspection_action?{inspection_action:op.inspection_action}:{}),...(op.unit_records?{unit_records:op.unit_records}:{}), device_imeis: op.device_imeis || [], sim_numbers: op.sim_numbers || [], sim_count: op.sim_count, ...(op.sim_count ? {sim_provider:op.sim_provider} : {}), customer_ref: op.customer_ref, vehicle_ref: op.vehicle_ref, notes: op.notes,
      ...(op.payment_received_amount!==undefined?{payment_received_amount:op.payment_received_amount,payment_method:op.payment_method||'cash'}:{}),
      completion_latitude:op.completion_latitude,completion_longitude:op.completion_longitude,completion_accuracy_m:op.completion_accuracy_m,timestamp: serverTimestamp(),completed_at:serverTimestamp(), captured_at: Timestamp.fromDate(new Date(op.captured_at))
    });
      if(op.kind==='job-completed'){
       if(isVehicleCompletion){const completed=siblingDocs.filter(snap=>snap.exists()).length+1,finished=completed===op.progress_total;tx.update(shiftRef,{status:finished?'completed':'in_progress',completed_units:completed,last_vehicle_completed_at:serverTimestamp(),...(finished?{completed_at:serverTimestamp(),completion_latitude:op.completion_latitude,completion_longitude:op.completion_longitude,completion_accuracy_m:op.completion_accuracy_m}:{})})}
       else tx.update(shiftRef,{status:'completed',completed_at:serverTimestamp(),completion_latitude:op.completion_latitude,completion_longitude:op.completion_longitude,completion_accuracy_m:op.completion_accuracy_m});
       const progress=isVehicleCompletion?`${siblingDocs.filter(snap=>snap.exists()).length+1} of ${op.progress_total}`:`${op.unit_count||1} of ${op.unit_count||1}`,jobId=String(assigned?.data()?.job_reference||op.shift_id||op.id);
       const notificationType=isVehicleCompletion&&siblingDocs.filter(snap=>snap.exists()).length+1<op.progress_total!?'vehicle_completed':'job_completed';
       tx.set(doc(db,'operational_notifications',`completion_${op.id}`),{type:notificationType,company:op.customer_ref,vehicle:op.vehicle_ref,job_id:jobId,imei:op.device_imeis?.[0]||'',sim:op.sim_numbers?.[0]||'',technician_name:user.displayName||user.email,actor_uid:user.uid,message:notificationType==='job_completed'?`Job completed · ${progress} vehicles`:`Vehicle ${progress} completed`,progress,recipient_roles:['master_admin','owner','admin','manager'],target_section:'jobs',read_by:[],created_at:serverTimestamp()});
       addAuditToTransaction(tx,user,'COMPLETED','Jobs',op.shift_id||op.id,{company:op.customer_ref,vehicle:op.vehicle_ref,imei:op.device_imeis?.[0],sim:op.sim_numbers?.[0],job_id:jobId});
      }
    }
  });
}
let activeSync: Promise<void> | null = null;
export function syncOperations(user: Technician): Promise<void> {
  if (activeSync) return activeSync;
  activeSync = (async () => {
    if (!navigator.onLine) return;
    let op = (await pending(user.uid))[0];
    if (!op) return;
    await ensureInventory(user);
    while (op) {
      let ready = op;
      if(op.kind==='job-completed'&&op.job_type==='device_removal')ready={...op,unit_count:op.unit_count,device_model:'',quantity:0,sim_count:0,sim_provider:undefined};
      if (op.kind === 'job-completed' && ![op.completion_latitude, op.completion_longitude, op.completion_accuracy_m].every(Number.isFinite)) {
        const location = await captureLocation();
        ready = { ...op, completion_latitude: location.latitude, completion_longitude: location.longitude, completion_accuracy_m: location.accuracy_m };
        await outbox.setItem(ready.uid + ':' + ready.id, ready);
      }
      await commitOperation(ready, user);
      await outbox.removeItem(ready.uid + ':' + ready.id);
      op = (await pending(user.uid))[0];
    }
  })().finally(() => { activeSync = null; });
  return activeSync;
}
export async function saveShift(shift: Omit<Shift, 'id'>,actor?:AuditActor) {
  await saveShifts([shift],actor);
}
const scheduleLockId=(uid:string,date:string)=>`${uid}_${date}`;
const minutes=(value:string)=>new Date(value).valueOf();
const lockEntry=(id:string,shift:Omit<Shift,'id'>,jobReference:string)=>({shift_id:id,job_reference:jobReference,start_at:shift.scheduled_at,end_at:shift.expected_end_at||new Date(minutes(shift.scheduled_at)+(shift.duration_minutes||60)*60000).toISOString(),company:shift.company_name||shift.customer_name||'',location:shift.site_name||''});
function assertAvailable(entries:Record<string,any>,candidate:any,exclude=''){
 const start=minutes(candidate.start_at),end=minutes(candidate.end_at);
 const conflict=Object.entries(entries||{}).find(([id,row]:any)=>id!==exclude&&start<minutes(row.end_at)&&end>minutes(row.start_at));
 if(conflict){const row:any=conflict[1];throw new Error(`This technician was assigned to ${row.job_reference||'another job'} while you were creating this job. Please choose another technician or time.`)}
}

export async function updateShift(id:string,shift:Omit<Shift,'id'>,actor?:AuditActor,expectedVersion=shift.version||1){
 const shiftRef=doc(db,'shifts',id);
 await runTransaction(db,async tx=>{
  const currentSnap=await tx.get(shiftRef);if(!currentSnap.exists())throw new Error('This job no longer exists.');const current=currentSnap.data();
  const currentVersion=Number(current.version||1);if(currentVersion!==expectedVersion)throw new Error(`This record was updated by ${current.updated_by_name||'another user'}. Please review the latest information before saving.`);
  const oldLock=current.technician_id&&current.date?doc(db,'schedule_locks',scheduleLockId(current.technician_id,current.date)):null;
  const newLock=shift.status!=='draft'&&shift.technician_id&&shift.date?doc(db,'schedule_locks',scheduleLockId(shift.technician_id,shift.date)):null;
  const refs=[...new Map([oldLock,newLock].filter(Boolean).map(ref=>[ref!.path,ref!])).values()];const lockSnaps=await Promise.all(refs.map(ref=>tx.get(ref)));const locks=new Map(lockSnaps.map(s=>[s.ref.path,s]));
  const jobReference=String(current.job_reference||id),end=shift.expected_end_at||new Date(minutes(shift.scheduled_at)+(shift.duration_minutes||60)*60000).toISOString();
  if(newLock){const snap=locks.get(newLock.path),entries={...(snap?.data()?.entries||{})};assertAvailable(entries,{...lockEntry(id,{...shift,expected_end_at:end},jobReference)},id)}
  const next:any={...shift,version:currentVersion+1,expected_end_at:Timestamp.fromDate(new Date(end)),latitude:shift.latitude??deleteField(),longitude:shift.longitude??deleteField(),scheduled_at:Timestamp.fromDate(new Date(shift.scheduled_at)),window_start:Timestamp.fromDate(new Date(shift.window_start)),window_end:Timestamp.fromDate(new Date(shift.window_end)),updated_at:serverTimestamp(),updated_by_uid:actor?.uid||'',updated_by_name:actor?.displayName||actor?.email||''};
  tx.update(shiftRef,next);
  if(oldLock){const snap=locks.get(oldLock.path),entries={...(snap?.data()?.entries||{})};delete entries[id];tx.set(oldLock,{technician_id:current.technician_id,date:current.date,entries,updated_at:serverTimestamp()},{merge:true})}
  if(newLock){const snap=locks.get(newLock.path),entries={...(snap?.data()?.entries||{})};entries[id]=lockEntry(id,{...shift,expected_end_at:end},jobReference);tx.set(newLock,{technician_id:shift.technician_id,date:shift.date,entries,updated_at:serverTimestamp()},{merge:true})}
  if(actor)addAuditToTransaction(tx,actor,current.technician_id===shift.technician_id?'EDITED':'REASSIGNED','Jobs',id,{company:shift.company_name,vehicle:(shift.vehicle_numbers||[]).join(' '),job_id:jobReference,changes:changedFields(current,shift,['technician_id','technician_name','company_name','contact_person','customer_phone','vehicle_numbers','job_type','unit_count','site_name','scheduled_at','duration_minutes','maps_url','job_notes','status'])});
 });
}
export async function deleteShift(id:string,actor:AuditActor,reason:string){
 const deletionReason=reason.trim();if(!deletionReason)throw new Error('Enter a deletion reason.');const ref=doc(db,'shifts',id);
 await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('This job no longer exists.');const row=snap.data();if(row.is_deleted)return;const lock=row.technician_id&&row.date?doc(db,'schedule_locks',scheduleLockId(row.technician_id,row.date)):null;const lockSnap=lock?await tx.get(lock):null;
  tx.update(ref,{is_deleted:true,previous_status:row.status||'assigned',status:'cancelled',deleted_at:serverTimestamp(),deleted_by_uid:actor.uid,deleted_by_name:actor.displayName||actor.email,deletion_reason:deletionReason,version:Number(row.version||1)+1,updated_at:serverTimestamp(),updated_by_uid:actor.uid,updated_by_name:actor.displayName||actor.email});
  if(lock){const entries={...(lockSnap?.data()?.entries||{})};delete entries[id];tx.set(lock,{technician_id:row.technician_id,date:row.date,entries,updated_at:serverTimestamp()},{merge:true})}
  addAuditToTransaction(tx,actor,'DELETED','Jobs',id,{company:row.company_name||row.customer_name,vehicle:(row.vehicle_numbers||[row.vehicle_number]).filter(Boolean).join(' '),job_id:row.job_reference,reason:deletionReason,deleted_record:true});
 });
}
export async function restoreShift(id:string,actor:AuditActor){const ref=doc(db,'shifts',id);await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('The original job is unavailable.');const row=snap.data();if(!row.is_deleted)return;const status=row.previous_status||'assigned',lock=status!=='draft'&&row.technician_id?doc(db,'schedule_locks',scheduleLockId(row.technician_id,row.date)):null,lockSnap=lock?await tx.get(lock):null;if(lock){const entries={...(lockSnap?.data()?.entries||{})},start=iso(row.scheduled_at),end=iso(row.expected_end_at||new Date(new Date(start).valueOf()+Number(row.duration_minutes||60)*60000)),entry={shift_id:id,job_reference:row.job_reference||'',start_at:start,end_at:end,company:row.company_name||row.customer_name||'',location:row.site_name||''};assertAvailable(entries,entry,id);entries[id]=entry;tx.set(lock,{technician_id:row.technician_id,date:row.date,entries,updated_at:serverTimestamp()},{merge:true})}tx.update(ref,{is_deleted:false,status,restored_at:serverTimestamp(),restored_by_uid:actor.uid,restored_by_name:actor.displayName||actor.email,updated_at:serverTimestamp()});addAuditToTransaction(tx,actor,'RESTORED','Jobs',id,{company:row.company_name,vehicle:(row.vehicle_numbers||[]).join(' '),job_id:row.job_reference,reason:'Restored from Audit History'})})}
export async function adminCompleteJob(shift:Shift,actor:Technician,reason:string){
 if(!['admin','master_admin'].includes(actor.role))throw new Error('Only an administrator can mark a job completed.');
 if(auth.currentUser?.uid!==actor.uid)throw new Error('Sign in again before completing this job.');
 const completionReason=reason.trim();if(!completionReason)throw new Error('Enter why the administrator is completing this job.');
 const shiftRef=doc(db,'shifts',shift.id);const installationRef=doc(db,'installations',shift.id);
 await runTransaction(db,async tx=>{
  const existing=await tx.get(installationRef);if(existing.exists())throw new Error('This job is already completed.');
  const current=await tx.get(shiftRef);if(!current.exists())throw new Error('This job no longer exists.');
  if(current.data().status==='completed')throw new Error('This job is already completed.');
  tx.set(installationRef,{technician_id:shift.technician_id,technician_name:shift.technician_name,shift_id:shift.id,job_type:shift.job_type,unit_count:shift.unit_count,device_model:'',device_imeis:[],sim_numbers:[],sim_count:0,customer_ref:shift.company_name||shift.customer_name||shift.site_name,vehicle_ref:(shift.vehicle_numbers?.length?shift.vehicle_numbers:[shift.vehicle_number]).filter(Boolean).join(' · '),notes:'',completion_source:'admin_override',completed_by_uid:actor.uid,completed_by_name:actor.displayName||actor.email,completed_by_role:actor.role,completion_reason:completionReason,timestamp:serverTimestamp(),completed_at:serverTimestamp(),captured_at:serverTimestamp()});
  tx.update(shiftRef,{status:'completed',completed_at:serverTimestamp()});
  addAuditToTransaction(tx,actor,'COMPLETED','Jobs',shift.id,{company:shift.company_name||shift.customer_name,vehicle:(shift.vehicle_numbers||[shift.vehicle_number]).filter(Boolean).join(' '),job_id:shift.job_reference,reason:completionReason});
 });
}
export async function checkIn(shift: Shift, coords: { latitude: number; longitude: number; accuracy_m: number }) {
  if (!navigator.onLine) throw new Error('Connect to the internet to confirm attendance. Attendance uses the server time.');
  const batch=writeBatch(db);
  batch.set(doc(db,'attendance_logs',shift.id),{technician_id:shift.technician_id,...coords,timestamp:serverTimestamp()});
  batch.update(doc(db,'shifts',shift.id),{status:'in_progress',arrived_at:serverTimestamp()});
  await batch.commit();
}
export async function changeRole(uid: string, role: string,actor:AuditActor) {
  const ref=doc(db,'users',uid);await runTransaction(db,async tx=>{const current=await tx.get(ref);if(!current.exists())throw new Error('User account not found.');tx.update(ref,{role});addAuditToTransaction(tx,actor,'PERMISSION_CHANGED','Users',uid,{changes:changedFields(current.data(),{role},['role'])})});
}
export async function removeManagedAccount(uid:string,actor:AuditActor,reason:string){
 const deletionReason=reason.trim();if(!deletionReason)throw new Error('Enter a reason for deleting the account.');
 const profileRef=doc(db,'users',uid),profile=await getDoc(profileRef);if(!profile.exists())throw new Error('User account not found.');
 const batch=writeBatch(db);
 batch.delete(profileRef);
 batch.delete(doc(db,'inventory_accounts',uid));
 batch.delete(doc(db,'technician_live_stock',uid));
 addAuditToBatch(batch,actor,'DELETED','Users',uid,{reason:deletionReason,deleted_record:true,display_name:profile.data().displayName||'',email:profile.data().email||'',history_preserved:true});
 await batch.commit();
}
export async function changeProfilePhoto(uid:string,photoDataUrl:string){
 if(photoDataUrl.length>200000)throw new Error('The profile photo is too large. Choose a smaller image.');
 await updateDoc(doc(db,'users',uid),{photoDataUrl});
}

export async function createManagedAccount(input:{displayName:string;email:string;password:string;role:Role},actor:AuditActor) {
 const secondary=initializeApp(firebaseConfig,'account-'+crypto.randomUUID()); const secondaryAuth=getAuth(secondary); let created:User|null=null,fresh=false;
 try {
  await setPersistence(secondaryAuth,inMemoryPersistence);
  try{created=(await createUserWithEmailAndPassword(secondaryAuth,input.email.trim(),input.password)).user;fresh=true}
  catch(error:any){
   if(error?.code!=='auth/email-already-in-use')throw error;
   try{created=(await signInWithEmailAndPassword(secondaryAuth,input.email.trim(),input.password)).user}
   catch{throw new Error('This email has an existing login. Enter its current password to restore the account, or use Forgot password on the login page first.')}
   const existing=await getDoc(doc(db,'users',created.uid));if(existing.exists()&&existing.data().status!=='deactivated')throw new Error('This account is already active. Refresh People & access to view it.');
  }
  await updateProfile(created,{displayName:input.displayName.trim()});
  const batch=writeBatch(db);batch.set(doc(db,'users',created.uid),{uid:created.uid,email:input.email.trim().toLowerCase(),displayName:input.displayName.trim(),photoDataUrl:'',role:input.role,status:'active',inventory_count:0,inventory_breakdown:{fmc920:0,fmc130:0,sim_cards:0},created_at:serverTimestamp()});addAuditToBatch(batch,actor,'CREATED','Users',created.uid,{changes:{role:{old:null,new:input.role}}});await batch.commit();
  await signOut(secondaryAuth); return created.uid;
 } catch(e) { if(created&&fresh) await deleteUser(created).catch(()=>{}); throw e; }
 finally { await deleteApp(secondary).catch(()=>{}); }
}
export async function legacyQueueCount() {
  const old = localforage.createInstance({ name: 'SecureTrackPWA', storeName: 'installation_queue' });
  const queue = await old.getItem<any[]>('securetrack_offline_queue_v1');
  return (queue || []).filter(i => i.status !== 'synced').length;
}

export async function saveShifts(shifts: Omit<Shift, 'id'>[],actor?:AuditActor) {
 const shiftRefs=shifts.map(()=>doc(collection(db,'shifts')));
 await runTransaction(db,async tx=>{
  const counterRef=doc(db,'counters','jobs'),counter=await tx.get(counterRef),start=(counter.data()?.value||0)+1;
  const lockRefs=[...new Map(shifts.filter(s=>s.status!=='draft'&&s.technician_id).map(s=>{const ref=doc(db,'schedule_locks',scheduleLockId(s.technician_id,s.date));return[ref.path,ref]})).values()];
  const lockSnaps=await Promise.all(lockRefs.map(ref=>tx.get(ref))),locks=new Map(lockSnaps.map(s=>[s.ref.path,s]));const pending=new Map<string,Record<string,any>>();
  shifts.forEach((shift,index)=>{if(shift.status==='draft'||!shift.technician_id)return;const key=doc(db,'schedule_locks',scheduleLockId(shift.technician_id,shift.date)).path,entries=pending.get(key)||{...(locks.get(key)?.data()?.entries||{})},jobReference=`ST${String(start+index).padStart(5,'0')}`,end=shift.expected_end_at||new Date(minutes(shift.scheduled_at)+(shift.duration_minutes||60)*60000).toISOString(),entry=lockEntry(shiftRefs[index].id,{...shift,expected_end_at:end},jobReference);assertAvailable(entries,entry);entries[shiftRefs[index].id]=entry;pending.set(key,entries)});
  tx.set(counterRef,{value:start+shifts.length-1,updated_at:serverTimestamp()},{merge:true});
  shifts.forEach((shift,index)=>{const reference=`ST${String(start+index).padStart(5,'0')}`,status=shift.status==='draft'?'draft':'assigned',end=shift.expected_end_at||new Date(minutes(shift.scheduled_at)+(shift.duration_minutes||60)*60000).toISOString();tx.set(shiftRefs[index],{...shift,job_reference:reference,status,version:1,duration_minutes:shift.duration_minutes||60,expected_end_at:Timestamp.fromDate(new Date(end)),scheduled_at:Timestamp.fromDate(new Date(shift.scheduled_at)),window_start:Timestamp.fromDate(new Date(shift.window_start)),window_end:Timestamp.fromDate(new Date(shift.window_end)),assigned_at:status==='assigned'?serverTimestamp():null,created_at:serverTimestamp(),created_by_uid:actor?.uid||'',created_by_name:actor?.displayName||actor?.email||'',updated_by_uid:actor?.uid||'',updated_by_name:actor?.displayName||actor?.email||''});if(actor)addAuditToTransaction(tx,actor,status==='draft'?'CREATED':'ASSIGNED','Jobs',shiftRefs[index].id,{company:shift.company_name,vehicle:(shift.vehicle_numbers||[]).join(' '),job_id:reference})});
  pending.forEach((entries,path)=>{const ref=doc(db,path);const first=shifts.find(s=>path.endsWith(scheduleLockId(s.technician_id,s.date)))!;tx.set(ref,{technician_id:first.technician_id,date:first.date,entries,updated_at:serverTimestamp()},{merge:true})});
 });
}
export async function recordLogin(uid: string, id: string, coords: {latitude:number;longitude:number;accuracy_m:number}) {
 await runTransaction(db, async tx => {
  const ref=doc(db,'login_logs',id); const existing=await tx.get(ref);
  if (!existing.exists()) tx.set(ref,{technician_id:uid,...coords,timestamp:serverTimestamp()});
 });
}

export async function clockInWorkday(user:Technician,date:string,coords:{latitude:number;longitude:number;accuracy_m:number}){
 if(!navigator.onLine)throw new Error('Connect to the internet to clock in. Work times use the server clock.');
 const id=`${user.uid}_${date}`;const ref=doc(db,'work_sessions',id);
 await runTransaction(db,async tx=>{const existing=await tx.get(ref);if(existing.exists())return;tx.set(ref,{technician_id:user.uid,technician_name:user.displayName||user.email,date,timezone:'Asia/Dubai',status:'active',clock_in_at:serverTimestamp(),clock_in_latitude:coords.latitude,clock_in_longitude:coords.longitude,clock_in_accuracy_m:coords.accuracy_m})});
}
export async function clockOutWorkday(session:WorkSession,coords:{latitude:number;longitude:number;accuracy_m:number}){
 if(!navigator.onLine)throw new Error('Connect to the internet to clock out. Work times use the server clock.');
 await updateDoc(doc(db,'work_sessions',session.id),{status:'clocked_out',clock_out_at:serverTimestamp(),clock_out_latitude:coords.latitude,clock_out_longitude:coords.longitude,clock_out_accuracy_m:coords.accuracy_m});
}
export async function correctWorkdayBreak(session:WorkSession,breakId:string,startTime:string,endTime:string,removeIds:string[]=[],reopen=false){
 if(!navigator.onLine)throw new Error('Connect to the internet to save the attendance correction.');
 const makeTime=(time:string)=>Timestamp.fromDate(new Date(`${session.date}T${time}:00+04:00`));
 const batch=writeBatch(db);const breakRef=doc(db,'work_breaks',breakId);batch.update(breakRef,{status:'ended',started_at:makeTime(startTime),ended_at:makeTime(endTime)});
 removeIds.filter(id=>id!==breakId).forEach(id=>batch.delete(doc(db,'work_breaks',id)));
 if(reopen)batch.update(doc(db,'work_sessions',session.id),{status:'active',clock_out_at:deleteField(),clock_out_latitude:deleteField(),clock_out_longitude:deleteField(),clock_out_accuracy_m:deleteField()});
 await batch.commit();
}
export async function resumeWorkday(session:WorkSession){
 if(!navigator.onLine)throw new Error('Connect to the internet to resume your workday.');
 await updateDoc(doc(db,'work_sessions',session.id),{status:'active',clock_out_at:deleteField(),clock_out_latitude:deleteField(),clock_out_longitude:deleteField(),clock_out_accuracy_m:deleteField()});
}
export async function startWorkBreak(session:WorkSession){
 if(!navigator.onLine)throw new Error('Connect to the internet to start a break.');
 const ref=doc(collection(db,'work_breaks'));await setDoc(ref,{session_id:session.id,technician_id:session.technician_id,date:session.date,status:'active',started_at:serverTimestamp()});
}
export async function endWorkBreak(item:WorkBreak){
 if(!navigator.onLine)throw new Error('Connect to the internet to end a break.');
 await updateDoc(doc(db,'work_breaks',item.id),{status:'ended',ended_at:serverTimestamp()});
}

export async function issueStock(user:Technician, op:Omit<PendingOperation,'uid'|'id'|'captured_at'>) {
 if(op.kind!=='received')throw new Error('Admins can issue stock only.');validateOperation(op);
 await ensureLiveStock(user);const movement=doc(collection(db,'inventory_logs'));
 await runTransaction(db,async tx=>{const ref=doc(db,'inventory_accounts',user.uid),officeRef=doc(db,'company_inventory','global'),liveRef=doc(db,'technician_live_stock',user.uid);const existing=await tx.get(ref);const profile=await tx.get(doc(db,'users',user.uid));const office=await tx.get(officeRef),live=await tx.get(liveRef);
 if(!profile.exists()||profile.data().role!=='technician'||profile.data().status==='deactivated')throw new Error('Choose an active technician.');
 if(!office.exists())throw new Error('Enter the office inventory before issuing technician stock.');
 const balance={...emptyStock(),...(office.data().balance||{})} as Stock;
 if(op.quantity&&op.device_model&&balance[op.device_model]<op.quantity)throw new Error(`Office stock has only ${balance[op.device_model]} ${op.device_model} unit${balance[op.device_model]===1?'':'s'}.`);
 const simKey=simStockKey(op.sim_provider);if(op.sim_count&&balance[simKey]<op.sim_count)throw new Error(`Office stock has only ${balance[simKey]} ${simKey} card${balance[simKey]===1?'':'s'}.`);
 if(op.quantity&&op.device_model)balance[op.device_model]-=op.quantity;if(op.sim_count)balance[simKey]-=op.sim_count;
 if(!existing.exists())tx.set(ref,{technician_id:user.uid,opening:openingStock({...profile.data(),uid:user.uid} as Technician),timestamp:serverTimestamp()});
 const technicianBalance={...emptyStock(),...(live.data()?.balance||{})} as Stock;if(op.quantity&&op.device_model)technicianBalance[op.device_model]+=op.quantity;if(op.sim_count)technicianBalance[simKey]+=op.sim_count;tx.set(liveRef,{technician_id:user.uid,balance:technicianBalance,updated_at:serverTimestamp()},{merge:true});
 tx.update(officeRef,{balance,updated_at:serverTimestamp(),updated_by:auth.currentUser?.displayName||auth.currentUser?.email||'SecureTrack administrator',updated_by_uid:auth.currentUser?.uid||''});
 tx.set(movement,{technician_id:user.uid,technician_name:user.displayName||user.email,type:'received',device_model:op.device_model,quantity:op.quantity,sim_count:op.sim_count,...(op.device_imeis?.length?{device_imeis:op.device_imeis}:{}),...(op.sim_count?{sim_provider:op.sim_provider}:{}),notes:op.notes,timestamp:serverTimestamp(),captured_at:serverTimestamp()});});
}

export async function saveCompanyInventory(current:Stock,target:Stock,notes:string,userName:string,userId:string){
 if(!notes.trim())throw new Error('Enter a reason for the office stock change.');
 const changed=[...new Set([...Object.keys(current),...Object.keys(target)])].some(key=>(current[key]||0)!==(target[key]||0));if(!changed)throw new Error('No office inventory quantities were changed.');
 const ref=doc(db,'company_inventory','global'),audit=doc(collection(db,'company_inventory_history'));
 const batch=writeBatch(db);batch.set(ref,{balance:target,updated_at:serverTimestamp(),updated_by:userName,updated_by_uid:userId},{merge:true});batch.set(audit,{previous:current,next:target,notes:notes.trim(),changed_at:serverTimestamp(),changed_by:userName,changed_by_uid:userId});await batch.commit();
}

export async function adjustInventory(user:Technician,current:Stock,target:Stock,notes:string){
 if(!notes.trim())throw new Error('Enter a reason for the inventory correction.');
 const changes:[string,number,'device'|'sim'][]=[];
 DEVICE_MODELS.forEach(key=>{const delta=target[key]-current[key];if(delta)changes.push([key,delta,'device'])});
 SIM_STOCK_KEYS.forEach(key=>{const delta=target[key]-current[key];if(delta)changes.push([key,delta,'sim'])});
 if(!changes.length)throw new Error('No inventory quantities were changed.');
 const batch=writeBatch(db);batch.set(doc(db,'technician_live_stock',user.uid),{technician_id:user.uid,balance:target,updated_at:serverTimestamp()},{merge:true});for(const[key,delta,kind]of changes){const provider=kind==='sim'&&key!=='SIM'?SIM_PROVIDERS.find(value=>key===`SIM ${value}`):undefined;batch.set(doc(collection(db,'inventory_logs')),{technician_id:user.uid,technician_name:user.displayName||user.email,type:'adjustment',device_model:kind==='device'?key:'',quantity:0,sim_count:0,quantity_delta:kind==='device'?delta:0,sim_delta:kind==='sim'?delta:0,...(provider?{sim_provider:provider}:{}),timestamp:serverTimestamp(),captured_at:serverTimestamp(),notes:notes.trim()})}await batch.commit();
}
export async function saveStockAlertThreshold(settings:StockAlertSettings){await setDoc(doc(db,'settings','stock_alerts'),{threshold:Math.max(0,Math.min(10000,Math.floor(settings.threshold))),device_minimums:minimumMap(settings.device_minimums),sim_minimums:minimumMap(settings.sim_minimums),clock_in_time:settings.clock_in_time,clock_out_time:settings.clock_out_time,late_grace_minutes:Math.max(0,Math.min(180,Math.floor(settings.late_grace_minutes))),max_break_minutes:Math.max(1,Math.min(240,Math.floor(settings.max_break_minutes))),updated_at:serverTimestamp()},{merge:true});}

function scheduledClock(value:any){const date=value?.toDate?.()||new Date(value);if(!Number.isFinite(date.getTime()))return'09:00';const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date),part=(name:string)=>parts.find(item=>item.type===name)?.value||'00';return`${part('hour')}:${part('minute')}`}
export async function carryForwardOverdueJobs(shifts:Shift[],_installations:Installation[],today:string,actor:Technician){
 if(!['master_admin','admin'].includes(actor.role)||!navigator.onLine)return 0;
 const targets=shifts.filter(shift=>shift.date<today&&shift.status!=='completed'&&(shift.completed_units||0)<shift.unit_count);let moved=0;
 for(const target of targets){let attempts=0;while(attempts++<366){const advanced=await runTransaction(db,async tx=>{const ref=doc(db,'shifts',target.id),snap=await tx.get(ref);if(!snap.exists())return false;const current=snap.data();if(current.status==='completed'||current.status==='draft'||current.is_deleted||String(current.date||'')>=today)return false;const from=String(current.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(from))return false;const to=nextDate(from),clock=scheduledClock(current.scheduled_at),oldLock=doc(db,'schedule_locks',scheduleLockId(current.technician_id,from)),newLock=doc(db,'schedule_locks',scheduleLockId(current.technician_id,to)),oldSnap=await tx.get(oldLock),newSnap=await tx.get(newLock),scheduled=localToISO(to,clock),expected=new Date(new Date(scheduled).valueOf()+Number(current.duration_minutes||60)*60000).toISOString(),entries={...(newSnap.data()?.entries||{})},entry={shift_id:target.id,job_reference:current.job_reference||'',start_at:scheduled,end_at:expected,company:current.company_name||current.customer_name||'',location:current.site_name||''};assertAvailable(entries,entry,target.id);entries[target.id]=entry;const oldEntries={...(oldSnap.data()?.entries||{})};delete oldEntries[target.id];const history=doc(db,'job_schedule_history',`${target.id}_${to}`);tx.update(ref,{date:to,scheduled_at:Timestamp.fromDate(new Date(scheduled)),expected_end_at:Timestamp.fromDate(new Date(expected)),window_start:Timestamp.fromDate(new Date(localToISO(to,'00:00'))),window_end:Timestamp.fromDate(new Date(localToISO(nextDate(to),'00:00'))),original_scheduled_date:current.original_scheduled_date||from,carried_forward:true,carried_forward_count:Number(current.carried_forward_count||0)+1,last_carried_forward_from:from,last_carried_forward_at:serverTimestamp(),version:Number(current.version||1)+1,updated_by_uid:actor.uid,updated_by_name:actor.displayName||actor.email,updated_at:serverTimestamp()});tx.set(oldLock,{technician_id:current.technician_id,date:from,entries:oldEntries,updated_at:serverTimestamp()},{merge:true});tx.set(newLock,{technician_id:current.technician_id,date:to,entries,updated_at:serverTimestamp()},{merge:true});tx.set(history,{shift_id:target.id,job_reference:current.job_reference||'',vehicle_numbers:current.vehicle_numbers||[current.vehicle_number||''],from_date:from,to_date:to,action:`Automatically carried forward from ${from} to ${to}.`,changed_by:'SecureTrack automatic carry-forward',changed_by_uid:actor.uid,changed_at:serverTimestamp()},{merge:false});addAuditToTransaction(tx,actor,'EDITED','Jobs',target.id,{company:current.company_name,vehicle:(current.vehicle_numbers||[]).join(' '),job_id:current.job_reference,changes:{date:{old:from,new:to}}});return true});if(!advanced)break;moved++}
 }
 return moved;
}
