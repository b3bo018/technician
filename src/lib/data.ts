import { createUserWithEmailAndPassword, deleteUser, getAuth, inMemoryPersistence, setPersistence, signOut, updateProfile, User } from 'firebase/auth';
import { deleteApp, initializeApp } from 'firebase/app';
import { collection, deleteField, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import localforage from 'localforage';
import { auth, db } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { Attendance, Installation, InventoryAccount, Movement, PendingOperation, Role, Shift, Technician } from '../types';
import { openingStock, validateOperation } from './domain';

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
export const mapShift = (id: string, d: any): Shift => ({ ...d, id, company_name: d.company_name || d.customer_name || '', contact_person: d.contact_person || '', job_type: d.job_type || 'new_installation', unit_count: d.unit_count || 1, scheduled_at: iso(d.scheduled_at), window_start: iso(d.window_start), window_end: iso(d.window_end) });
export const mapAttendance = (id: string, d: any): Attendance => ({ ...d, id, timestamp: iso(d.timestamp) });
export const mapInstallation = (id: string, d: any): Installation => ({
  id, technician_id: d.technician_id || d.tech_id, technician_name: d.technician_name || d.tech_email || '',
  shift_id: d.shift_id || '', job_type: d.job_type || 'new_installation', unit_count: d.unit_count || 1,
  device_model: d.device_model || d.device_type || '', device_imeis: d.device_imeis || (d.imei ? [d.imei] : []), sim_numbers: d.sim_numbers || (d.sim_number ? [d.sim_number] : []), sim_count: d.sim_count ?? (d.sim_number ? 1 : 0), sim_provider: d.sim_provider || undefined,
  customer_ref: d.customer_ref || d.customer_name || '', vehicle_ref: d.vehicle_ref || '', notes: d.notes || '',
  timestamp: iso(d.timestamp), legacy: !d.technician_id
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
    const installation = await tx.get(installRef);
    if (installation.exists()) return;
    const existing = await tx.get(moveRef);
    if (existing.exists()) throw new Error('This assignment has an incomplete inventory record. Contact an administrator.');
    if (op.quantity + op.sim_count > 0) {
      const movement = { technician_id: user.uid, technician_name: user.displayName || user.email, type: op.quantity ? 'installed' : 'sim-used', device_model: op.device_model, quantity: op.quantity, sim_count: op.sim_count, ...(op.sim_count ? {sim_provider:op.sim_provider} : {}), timestamp: serverTimestamp(), captured_at: Timestamp.fromDate(new Date(op.captured_at)), notes: op.notes };
      tx.set(moveRef, movement);
    }
    if (op.kind === 'installed' || op.kind === 'job-completed') tx.set(installRef, {
      technician_id: user.uid, technician_name: user.displayName || user.email, device_model: op.device_model,
      shift_id: op.shift_id || '', job_type: op.job_type || 'new_installation', unit_count: Math.max(op.quantity, op.sim_count, op.device_imeis?.length || 0, 1),
      device_imeis: op.device_imeis || [], sim_numbers: op.sim_numbers || [], sim_count: op.sim_count, ...(op.sim_count ? {sim_provider:op.sim_provider} : {}), customer_ref: op.customer_ref, vehicle_ref: op.vehicle_ref, notes: op.notes,
      timestamp: serverTimestamp(), captured_at: Timestamp.fromDate(new Date(op.captured_at))
    });
  });
}
let activeSync: Promise<void> | null = null;
export function syncOperations(user: Technician): Promise<void> {
  if (activeSync) return activeSync;
  activeSync = (async () => {
    if (!navigator.onLine) return;
    await ensureInventory(user);
    for (const op of await pending(user.uid)) {
      await commitOperation(op, user);
      await outbox.removeItem(op.uid + ':' + op.id);
    }
  })().finally(() => { activeSync = null; });
  return activeSync;
}
export async function saveShift(shift: Omit<Shift, 'id'>) {
  const data = { ...shift, scheduled_at: Timestamp.fromDate(new Date(shift.scheduled_at)), window_start: Timestamp.fromDate(new Date(shift.window_start)), window_end: Timestamp.fromDate(new Date(shift.window_end)), created_at: serverTimestamp() };
  const batch = writeBatch(db); batch.set(doc(collection(db, 'shifts')), data); await batch.commit();
}
export async function updateShift(id:string,shift:Omit<Shift,'id'>){
 const data={...shift,latitude:shift.latitude??deleteField(),longitude:shift.longitude??deleteField(),scheduled_at:Timestamp.fromDate(new Date(shift.scheduled_at)),window_start:Timestamp.fromDate(new Date(shift.window_start)),window_end:Timestamp.fromDate(new Date(shift.window_end)),updated_at:serverTimestamp()};
 await updateDoc(doc(db,'shifts',id),data);
}
export async function checkIn(shift: Shift, coords: { latitude: number; longitude: number; accuracy_m: number }) {
  if (!navigator.onLine) throw new Error('Connect to the internet to confirm attendance. Attendance uses the server time.');
  const ref = doc(db, 'attendance_logs', shift.id);
  await runTransaction(db, async tx => {
    const existing = await tx.get(ref);
    if (existing.exists()) return;
    tx.set(ref, { technician_id: shift.technician_id, ...coords, timestamp: serverTimestamp() });
  });
}
export async function changeRole(uid: string, role: string) {
  const batch = writeBatch(db); batch.update(doc(db, 'users', uid), { role }); await batch.commit();
}
export async function removeManagedAccount(uid:string){
 const refs=new Map<string,ReturnType<typeof doc>>();
 for(const [name,field] of [['shifts','technician_id'],['attendance_logs','technician_id'],['login_logs','technician_id'],['installations','technician_id'],['installations','tech_id'],['inventory_logs','technician_id']] as const){
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
 const batch = writeBatch(db);
 for (const shift of shifts) batch.set(doc(collection(db,'shifts')), {...shift, scheduled_at: Timestamp.fromDate(new Date(shift.scheduled_at)), window_start: Timestamp.fromDate(new Date(shift.window_start)), window_end: Timestamp.fromDate(new Date(shift.window_end)), created_at: serverTimestamp()});
 await batch.commit();
}
export async function recordLogin(uid: string, id: string, coords: {latitude:number;longitude:number;accuracy_m:number}) {
 await runTransaction(db, async tx => {
  const ref=doc(db,'login_logs',id); const existing=await tx.get(ref);
  if (!existing.exists()) tx.set(ref,{technician_id:uid,...coords,timestamp:serverTimestamp()});
 });
}

export async function issueStock(user:Technician, op:Omit<PendingOperation,'uid'|'id'|'captured_at'>) {
 if(op.kind!=='received')throw new Error('Admins can issue stock only.');validateOperation(op);
 const movement=doc(collection(db,'inventory_logs'));
 await runTransaction(db,async tx=>{const ref=doc(db,'inventory_accounts',user.uid);const existing=await tx.get(ref);const profile=await tx.get(doc(db,'users',user.uid));
 if(!profile.exists()||profile.data().role!=='technician'||profile.data().status==='deactivated')throw new Error('Choose an active technician.');
 if(!existing.exists())tx.set(ref,{technician_id:user.uid,opening:openingStock({...profile.data(),uid:user.uid} as Technician),timestamp:serverTimestamp()});
 tx.set(movement,{technician_id:user.uid,technician_name:user.displayName||user.email,type:'received',device_model:op.device_model,quantity:op.quantity,sim_count:op.sim_count,...(op.sim_count?{sim_provider:op.sim_provider}:{}),notes:op.notes,timestamp:serverTimestamp(),captured_at:serverTimestamp()});});
}
