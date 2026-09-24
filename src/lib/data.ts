import { createUserWithEmailAndPassword, deleteUser, getAuth, inMemoryPersistence, setPersistence, signOut, updateProfile, User } from 'firebase/auth';
import { deleteApp, initializeApp } from 'firebase/app';
import { collection, deleteField, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import localforage from 'localforage';
import { auth, db } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { Attendance, DEVICE_MODELS, Installation, InventoryAccount, Movement, PendingOperation, Role, SIM_PROVIDERS, SIM_STOCK_KEYS, Shift, Stock, StockAlertSettings, Technician, WorkBreak, WorkSession } from '../types';
import { openingStock, validateOperation } from './domain';
import { captureLocation } from './location';

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
export function observeProfile(uid: string, callback: (t: Technician | null) => void, error: (e: Error) => void) {
  return onSnapshot(doc(db, 'users', uid), s => callback(s.exists() ? { ...s.data(), uid } as Technician : null), error);
}
export function observe<T>(name: string, uid: string | null, map: (id: string, d: any) => T, callback: (data: T[]) => void, error: (e: Error) => void, field = 'technician_id') {
  const q = uid ? query(collection(db, name), where(field, '==', uid)) : query(collection(db, name));
  return onSnapshot(q, { includeMetadataChanges: true }, s => callback(s.docs.filter(d => !d.metadata.hasPendingWrites).map(d => map(d.id, d.data()))), error);
}
export const mapMovement = (id: string, d: any): Movement => ({ ...d, id, sim_provider: d.sim_provider || undefined, timestamp: iso(d.timestamp) });
export const mapAccount = (_: string, d: any): InventoryAccount => ({ ...d, timestamp: iso(d.timestamp) });
export function observeStockAlertSettings(callback:(settings:StockAlertSettings)=>void,error:(e:Error)=>void){return onSnapshot(doc(db,'settings','stock_alerts'),snap=>{const data=snap.data()||{};callback({threshold:Math.max(0,Math.min(10000,Number(data.threshold||2)||0)),clock_in_time:String(data.clock_in_time||'09:00'),clock_out_time:String(data.clock_out_time||'18:00'),late_grace_minutes:Math.max(0,Math.min(180,Number(data.late_grace_minutes||5)||0)),max_break_minutes:Math.max(1,Math.min(240,Number(data.max_break_minutes||60)||60))})},error)}
export const mapShift = (id: string, d: any): Shift => ({ ...d, id, company_name: d.company_name || d.customer_name || '', contact_person: d.contact_person || '', job_type: d.job_type || 'new_installation', unit_count: d.unit_count || 1, status:d.status||'assigned', assigned_at:iso(d.assigned_at||d.created_at), arrived_at:d.arrived_at?iso(d.arrived_at):undefined, completed_at:d.completed_at?iso(d.completed_at):undefined, scheduled_at: iso(d.scheduled_at), window_start: iso(d.window_start), window_end: iso(d.window_end) });
export const mapAttendance = (id: string, d: any): Attendance => ({ ...d, id, timestamp: iso(d.timestamp) });
export const mapWorkSession = (id:string,d:any):WorkSession => ({...d,id,clock_in_at:iso(d.clock_in_at),clock_out_at:d.clock_out_at?iso(d.clock_out_at):undefined});
export const mapWorkBreak = (id:string,d:any):WorkBreak => ({...d,id,started_at:iso(d.started_at),ended_at:d.ended_at?iso(d.ended_at):undefined});
export const mapInstallation = (id: string, d: any): Installation => ({
  id, technician_id: d.technician_id || d.tech_id, technician_name: d.technician_name || d.tech_email || '',
  shift_id: d.shift_id || '', job_type: d.job_type || 'new_installation', unit_count: d.unit_count || 1,
  unit_records:d.unit_records||undefined,device_model: d.device_model || d.device_type || '', device_imeis: d.device_imeis || (d.imei ? [d.imei] : []), sim_numbers: d.sim_numbers || (d.sim_number ? [d.sim_number] : []), sim_count: d.sim_count ?? (d.sim_number ? 1 : 0), sim_provider: d.sim_provider || undefined,
  customer_ref: d.customer_ref || d.customer_name || '', vehicle_ref: d.vehicle_ref || '', notes: d.notes || '',
  timestamp: iso(d.completed_at||d.timestamp), completed_at:iso(d.completed_at||d.timestamp), completion_latitude:d.completion_latitude, completion_longitude:d.completion_longitude, completion_accuracy_m:d.completion_accuracy_m, inspection_action:d.inspection_action,
  completion_source:d.completion_source||undefined,completed_by_uid:d.completed_by_uid||undefined,completed_by_name:d.completed_by_name||undefined,completed_by_role:d.completed_by_role||undefined,completion_reason:d.completion_reason||undefined,
  legacy: !d.technician_id
});
const outbox = localforage.createInstance({ name: 'SecureTrackPWA', storeName: 'operations_v2' });
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
  const moveRef = doc(db, 'inventory_logs', op.id);
  await runTransaction(db, async tx => {
    const installRef = doc(db, 'installations', op.id);
    const shiftRef = doc(db, 'shifts', op.shift_id || op.id);
    const installation = await tx.get(installRef);
    if (installation.exists()) return;
    const existing = await tx.get(moveRef);
    const assigned = op.kind === 'job-completed' ? await tx.get(shiftRef) : null;
    if (existing.exists()) throw new Error('This assignment has an incomplete inventory record. Contact an administrator.');
    if (op.quantity + op.sim_count > 0) {
      const movement = { technician_id: user.uid, technician_name: user.displayName || user.email, type: op.quantity ? 'installed' : 'sim-used', device_model: op.device_model, quantity: op.quantity, sim_count: op.sim_count, ...(op.sim_count ? {sim_provider:op.sim_provider} : {}), timestamp: serverTimestamp(), captured_at: Timestamp.fromDate(new Date(op.captured_at)), notes: op.notes };
      tx.set(moveRef, movement);
    }
    if (op.kind === 'installed' || op.kind === 'job-completed') {
      tx.set(installRef, {
      technician_id: user.uid, technician_name: user.displayName || user.email, device_model: op.device_model,
      shift_id: op.shift_id || '', job_type: op.job_type || 'new_installation', unit_count: op.unit_count||assigned?.data()?.unit_count||Math.max(op.quantity, op.sim_count, op.device_imeis?.length || 0, 1),
      ...(op.inspection_action?{inspection_action:op.inspection_action}:{}),...(op.unit_records?{unit_records:op.unit_records}:{}), device_imeis: op.device_imeis || [], sim_numbers: op.sim_numbers || [], sim_count: op.sim_count, ...(op.sim_count ? {sim_provider:op.sim_provider} : {}), customer_ref: op.customer_ref, vehicle_ref: op.vehicle_ref, notes: op.notes,
      completion_latitude:op.completion_latitude,completion_longitude:op.completion_longitude,completion_accuracy_m:op.completion_accuracy_m,timestamp: serverTimestamp(),completed_at:serverTimestamp(), captured_at: Timestamp.fromDate(new Date(op.captured_at))
    });
      if(op.kind==='job-completed')tx.update(shiftRef,{status:'completed',completed_at:serverTimestamp(),completion_latitude:op.completion_latitude,completion_longitude:op.completion_longitude,completion_accuracy_m:op.completion_accuracy_m});
    }
  });
}
let activeSync: Promise<void> | null = null;
export function syncOperations(user: Technician): Promise<void> {
  if (activeSync) return activeSync;
  activeSync = (async () => {
    if (!navigator.onLine) return;
    await ensureInventory(user);
    while (true) {
      const op = (await pending(user.uid))[0];
      if (!op) break;
      let ready = op;
      if(op.kind==='job-completed'&&op.job_type==='device_removal')ready={...op,unit_count:op.unit_count,device_model:'',device_imeis:[],sim_numbers:[],quantity:0,sim_count:0,sim_provider:undefined};
      if (op.kind === 'job-completed' && ![op.completion_latitude, op.completion_longitude, op.completion_accuracy_m].every(Number.isFinite)) {
        const location = await captureLocation();
        ready = { ...op, completion_latitude: location.latitude, completion_longitude: location.longitude, completion_accuracy_m: location.accuracy_m };
        await outbox.setItem(ready.uid + ':' + ready.id, ready);
      }
      await commitOperation(ready, user);
      await outbox.removeItem(ready.uid + ':' + ready.id);
    }
  })().finally(() => { activeSync = null; });
  return activeSync;
}
export async function saveShift(shift: Omit<Shift, 'id'>) {
  await saveShifts([shift]);
}
export async function updateShift(id:string,shift:Omit<Shift,'id'>){
 const data={...shift,latitude:shift.latitude??deleteField(),longitude:shift.longitude??deleteField(),scheduled_at:Timestamp.fromDate(new Date(shift.scheduled_at)),window_start:Timestamp.fromDate(new Date(shift.window_start)),window_end:Timestamp.fromDate(new Date(shift.window_end)),updated_at:serverTimestamp()};
 await updateDoc(doc(db,'shifts',id),data);
}
export async function deleteShift(id:string){
 const batch=writeBatch(db);
 batch.delete(doc(db,'attendance_logs',id));
 batch.delete(doc(db,'shifts',id));
 await batch.commit();
}
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
 });
}
export async function checkIn(shift: Shift, coords: { latitude: number; longitude: number; accuracy_m: number }) {
  if (!navigator.onLine) throw new Error('Connect to the internet to confirm attendance. Attendance uses the server time.');
  const ref = doc(db, 'attendance_logs', shift.id);
  await runTransaction(db, async tx => {
    const existing = await tx.get(ref); const shiftRef=doc(db,'shifts',shift.id); await tx.get(shiftRef);
    if (existing.exists()) return;
    tx.set(ref, { technician_id: shift.technician_id, ...coords, timestamp: serverTimestamp() });
    tx.update(shiftRef,{status:'in_progress',arrived_at:serverTimestamp()});
  });
}
export async function changeRole(uid: string, role: string) {
  const batch = writeBatch(db); batch.update(doc(db, 'users', uid), { role }); await batch.commit();
}
export async function removeManagedAccount(uid:string){
 const refs=new Map<string,ReturnType<typeof doc>>();
 for(const [name,field] of [['shifts','technician_id'],['attendance_logs','technician_id'],['login_logs','technician_id'],['work_sessions','technician_id'],['work_breaks','technician_id'],['installations','technician_id'],['installations','tech_id'],['inventory_logs','technician_id']] as const){
  const snapshot=await getDocs(query(collection(db,name),where(field,'==',uid)));
  snapshot.docs.forEach(item=>refs.set(item.ref.path,item.ref));
 }
 const account=doc(db,'inventory_accounts',uid);refs.set(account.path,account);
 const profile=doc(db,'users',uid);refs.set(profile.path,profile);
 const all=[...refs.values()];
 for(let i=0;i<all.length;i+=400){const batch=writeBatch(db);all.slice(i,i+400).forEach(ref=>batch.delete(ref));await batch.commit()}
}
export async function changeProfilePhoto(uid:string,photoDataUrl:string){
 if(photoDataUrl.length>200000)throw new Error('The profile photo is too large. Choose a smaller image.');
 await updateDoc(doc(db,'users',uid),{photoDataUrl});
}

export async function createManagedAccount(input:{displayName:string;email:string;password:string;role:Role}) {
 const secondary=initializeApp(firebaseConfig,'account-'+crypto.randomUUID()); const secondaryAuth=getAuth(secondary); let created:User|null=null;
 try {
  await setPersistence(secondaryAuth,inMemoryPersistence);
  const credential=await createUserWithEmailAndPassword(secondaryAuth,input.email.trim(),input.password);
  created=credential.user; await updateProfile(created,{displayName:input.displayName.trim()});
  await setDoc(doc(db,'users',created.uid),{uid:created.uid,email:input.email.trim().toLowerCase(),displayName:input.displayName.trim(),photoDataUrl:'',role:input.role,status:'active',inventory_count:0,inventory_breakdown:{fmc920:0,fmc130:0,sim_cards:0},created_at:serverTimestamp()});
  await signOut(secondaryAuth); return created.uid;
 } catch(e) { if(created) await deleteUser(created).catch(()=>{}); throw e; }
 finally { await deleteApp(secondary).catch(()=>{}); }
}
export async function legacyQueueCount() {
  const old = localforage.createInstance({ name: 'SecureTrackPWA', storeName: 'installation_queue' });
  const queue = await old.getItem<any[]>('securetrack_offline_queue_v1');
  return (queue || []).filter(i => i.status !== 'synced').length;
}

export async function saveShifts(shifts: Omit<Shift, 'id'>[]) {
 await runTransaction(db,async tx=>{const counterRef=doc(db,'counters','jobs');const counter=await tx.get(counterRef);const start=(counter.data()?.value||0)+1;tx.set(counterRef,{value:start+shifts.length-1,updated_at:serverTimestamp()},{merge:true});shifts.forEach((shift,index)=>tx.set(doc(collection(db,'shifts')),{...shift,job_reference:`ST${String(start+index).padStart(5,'0')}`,status:'assigned',scheduled_at:Timestamp.fromDate(new Date(shift.scheduled_at)),window_start:Timestamp.fromDate(new Date(shift.window_start)),window_end:Timestamp.fromDate(new Date(shift.window_end)),assigned_at:serverTimestamp(),created_at:serverTimestamp()}))});
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
 const movement=doc(collection(db,'inventory_logs'));
 await runTransaction(db,async tx=>{const ref=doc(db,'inventory_accounts',user.uid);const existing=await tx.get(ref);const profile=await tx.get(doc(db,'users',user.uid));
 if(!profile.exists()||profile.data().role!=='technician'||profile.data().status==='deactivated')throw new Error('Choose an active technician.');
 if(!existing.exists())tx.set(ref,{technician_id:user.uid,opening:openingStock({...profile.data(),uid:user.uid} as Technician),timestamp:serverTimestamp()});
 tx.set(movement,{technician_id:user.uid,technician_name:user.displayName||user.email,type:'received',device_model:op.device_model,quantity:op.quantity,sim_count:op.sim_count,...(op.device_imeis?.length?{device_imeis:op.device_imeis}:{}),...(op.sim_count?{sim_provider:op.sim_provider}:{}),notes:op.notes,timestamp:serverTimestamp(),captured_at:serverTimestamp()});});
}

export async function adjustInventory(user:Technician,current:Stock,target:Stock,notes:string){
 if(!notes.trim())throw new Error('Enter a reason for the inventory correction.');
 const changes:[string,number,'device'|'sim'][]=[];
 DEVICE_MODELS.forEach(key=>{const delta=target[key]-current[key];if(delta)changes.push([key,delta,'device'])});
 SIM_STOCK_KEYS.forEach(key=>{const delta=target[key]-current[key];if(delta)changes.push([key,delta,'sim'])});
 if(!changes.length)throw new Error('No inventory quantities were changed.');
 const batch=writeBatch(db);for(const[key,delta,kind]of changes){const provider=kind==='sim'&&key!=='SIM'?SIM_PROVIDERS.find(value=>key===`SIM ${value}`):undefined;batch.set(doc(collection(db,'inventory_logs')),{technician_id:user.uid,technician_name:user.displayName||user.email,type:'adjustment',device_model:kind==='device'?key:'',quantity:0,sim_count:0,quantity_delta:kind==='device'?delta:0,sim_delta:kind==='sim'?delta:0,...(provider?{sim_provider:provider}:{}),timestamp:serverTimestamp(),captured_at:serverTimestamp(),notes:notes.trim()})}await batch.commit();
}
export async function saveStockAlertThreshold(settings:StockAlertSettings){await setDoc(doc(db,'settings','stock_alerts'),{threshold:Math.max(0,Math.min(10000,Math.floor(settings.threshold))),clock_in_time:settings.clock_in_time,clock_out_time:settings.clock_out_time,late_grace_minutes:Math.max(0,Math.min(180,Math.floor(settings.late_grace_minutes))),max_break_minutes:Math.max(1,Math.min(240,Math.floor(settings.max_break_minutes))),updated_at:serverTimestamp()},{merge:true});}
