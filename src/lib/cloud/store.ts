// Firestore-compatible client facade backed by the SecureTrack AWS API.
// Keeps existing application/domain code stable while Firebase is removed.
export type DocRef={kind:'doc';path:string;id:string};
export type DocumentReference=DocRef;
export type CollectionRef={kind:'collection';path:string};
export type CollectionReference=CollectionRef;
export type QueryRef={kind:'query';collection:CollectionRef;filters:Filter[]};
export type Query=QueryRef;
type Filter={field:string;op:string;value:any};
type Listener=()=>void;
type SnapshotDoc={id:string;data:()=>any;exists:()=>boolean;metadata:{hasPendingWrites:false};ref:DocRef};
export type Transaction=ReturnType<typeof transactionFacade>;
export type WriteBatch=ReturnType<typeof batchFacade>;

const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
let tokenProvider:()=>Promise<string|null>=async()=>null;
export function setTokenProvider(provider:()=>Promise<string|null>){tokenProvider=provider}
async function request(path:string,init:RequestInit={}){
 const token=await tokenProvider();const headers=new Headers(init.headers);
 if(init.body&&!headers.has('content-type'))headers.set('content-type','application/json');
 if(token)headers.set('authorization','Bearer '+token);
 const response=await fetch(API+path,{...init,headers});
 if(!response.ok){const body=await response.json().catch(()=>({}));const error:any=new Error(body.message||('AWS API request failed ('+response.status+')'));error.code=body.code||String(response.status);throw error}
 return response.status===204?null:response.json();
}
const encode=(value:string)=>encodeURIComponent(value);
const normalize=(parts:string[])=>parts.filter(Boolean).join('/');
export function collection(parent:any,...segments:string[]):CollectionRef{
 if(typeof parent==='string')segments=[parent,...segments];
 const prefix=parent?.path?parent.path:'';
 return{kind:'collection',path:normalize([prefix,...segments])};
}
export function doc(parent:any,...segments:string[]):DocRef{
 if(typeof parent==='string')segments=[parent,...segments];
 let path=parent?.path?normalize([parent.path,...segments]):normalize(segments);
 if(parent?.kind==='collection'&&segments.length===0)path=normalize([parent.path,crypto.randomUUID()]);
 const id=path.split('/').pop()||'';
 return{kind:'doc',path,id};
}
export function where(field:string,op:string,value:any):Filter{return{field,op,value}}
export function query(ref:CollectionRef,...filters:Filter[]):QueryRef{return{kind:'query',collection:ref,filters}}
export const serverTimestamp=()=>({__op:'serverTimestamp'});
export const deleteField=()=>({__op:'deleteField'});
export class Timestamp{
 private value:Date;constructor(value:Date){this.value=value}
 static fromDate(value:Date){return new Timestamp(value)}
 toDate(){return this.value}
 toJSON(){return this.value.toISOString()}
}
function revive(value:any):any{
 if(Array.isArray(value))return value.map(revive);
 if(value&&typeof value==='object'){
  if(value.__timestamp)return new Timestamp(new Date(value.__timestamp));
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,revive(v)]));
 }
 return value;
}
function snap(ref:DocRef,row:any):SnapshotDoc{
 const exists=row!=null;const data=exists?revive(row.data??row):undefined;
 return{id:ref.id,ref,exists:()=>exists,data:()=>data,metadata:{hasPendingWrites:false}};
}
export async function getDoc(ref:DocRef){return snap(ref,await request('/v1/store/doc/'+encode(ref.path)))}
export async function getDocs(ref:CollectionRef|QueryRef){
 const collectionRef=ref.kind==='query'?ref.collection:ref;
 const filters=ref.kind==='query'?ref.filters:[];
 const result=await request('/v1/store/query',{method:'POST',body:JSON.stringify({collection:collectionRef.path,filters})});
 return{docs:(result?.rows||[]).map((row:any)=>snap(doc(collectionRef,row.id),row))};
}
export async function setDoc(ref:DocRef,data:any,options?:{merge?:boolean}){await request('/v1/store/doc/'+encode(ref.path),{method:'PUT',body:JSON.stringify({data,merge:!!options?.merge})})}
export async function updateDoc(ref:DocRef,data:any){await request('/v1/store/doc/'+encode(ref.path),{method:'PATCH',body:JSON.stringify({data})})}
export async function deleteDoc(ref:DocRef){await request('/v1/store/doc/'+encode(ref.path),{method:'DELETE'})}
export async function addDoc(ref:CollectionRef,data:any){const result=await request('/v1/store/collection/'+encode(ref.path),{method:'POST',body:JSON.stringify({data})});return doc(ref,result.id)}
function batchFacade(){
 const ops:any[]=[];
 return{
  set:(ref:DocRef,data:any,options?:any)=>{ops.push({op:'set',path:ref.path,data,merge:!!options?.merge})},
  update:(ref:DocRef,data:any)=>{ops.push({op:'update',path:ref.path,data})},
  delete:(ref:DocRef)=>{ops.push({op:'delete',path:ref.path})},
  commit:async()=>{await request('/v1/store/batch',{method:'POST',body:JSON.stringify({ops})})}
 };
}
export function writeBatch(_db:any){return batchFacade()}
function transactionFacade(reads:Map<string,SnapshotDoc>,ops:any[]){
 return{
  get:async(ref:DocRef)=>{if(reads.has(ref.path))return reads.get(ref.path)!;const s=await getDoc(ref);reads.set(ref.path,s);return s},
  set:(ref:DocRef,data:any,options?:any)=>ops.push({op:'set',path:ref.path,data,merge:!!options?.merge}),
  update:(ref:DocRef,data:any)=>ops.push({op:'update',path:ref.path,data}),
  delete:(ref:DocRef)=>ops.push({op:'delete',path:ref.path})
 };
}
export async function runTransaction(_db:any,callback:(tx:Transaction)=>Promise<any>){
 // Server applies writes atomically and validates optimistic read versions.
 const reads=new Map<string,SnapshotDoc>(),ops:any[]=[];const tx=transactionFacade(reads,ops);const result=await callback(tx);
 await request('/v1/store/transaction',{method:'POST',body:JSON.stringify({reads:[...reads.keys()],ops})});return result;
}
export function onSnapshot(ref:DocRef|CollectionRef|QueryRef,...args:any[]){
 const callback=args.find((a:any)=>typeof a==='function');const error=args.slice(args.indexOf(callback)+1).find((a:any)=>typeof a==='function');
 let stopped=false,timer:number|undefined;
 const load=async()=>{try{if(ref.kind==='doc')callback(await getDoc(ref));else callback(await getDocs(ref as any))}catch(e){error?.(e)}};
 void load();timer=window.setInterval(()=>{if(!stopped)void load()},Number(import.meta.env.VITE_SYNC_INTERVAL_MS||5000));
 return()=>{stopped=true;if(timer)window.clearInterval(timer)};
}
