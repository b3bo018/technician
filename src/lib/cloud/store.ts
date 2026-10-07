// AWS PostgreSQL document API client used by the React/domain layer.
export type DocRef={kind:'doc';path:string;id:string};
export type DocumentReference=DocRef;
export type CollectionRef={kind:'collection';path:string};
export type CollectionReference=CollectionRef;
type Constraint={type:'where'|'orderBy'|'limit'|'startAt'|'endAt'|'startAfter';field?:string;op?:string;value?:any;direction?:'asc'|'desc';count?:number;id?:string};
export type QueryRef={kind:'query';collection:CollectionRef;constraints:Constraint[]};
export type Query=QueryRef;
export type DocumentSnapshot={id:string;data:()=>any;exists:()=>boolean;metadata:{hasPendingWrites:false};ref:DocRef;version?:number};
export type QuerySnapshot={docs:DocumentSnapshot[];size:number;empty:boolean};
export type SnapshotOptions={includeMetadataChanges?:boolean};
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
const endpoint=(ref:DocRef)=>'/documents/'+ref.path.split('/').map(encode).join('/');
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
export function where(field:string,op:string,value:any):Constraint{return{type:'where',field,op,value}}
export function orderBy(field:string,direction:'asc'|'desc'='asc'):Constraint{return{type:'orderBy',field,direction}}
export function limit(count:number):Constraint{return{type:'limit',count}}
export function startAt(value:any):Constraint{return{type:'startAt',value}}
export function endAt(value:any):Constraint{return{type:'endAt',value}}
export function startAfter(value:any):Constraint{return value?.id?{type:'startAfter',id:value.id}:{type:'startAfter',value}}
export function query(ref:CollectionRef,...constraints:Constraint[]):QueryRef{return{kind:'query',collection:ref,constraints}}
export const serverTimestamp=()=>({__securetrackOp:'serverTimestamp'});
export const deleteField=()=>({__securetrackOp:'deleteField'});
export const arrayUnion=(...values:any[])=>({__securetrackOp:'arrayUnion',values});
export class Timestamp{
 private value:Date;constructor(value:Date){this.value=value}
 static fromDate(value:Date){return new Timestamp(value)}
 static fromMillis(value:number){return new Timestamp(new Date(value))}
 static now(){return new Timestamp(new Date())}
 toDate(){return this.value}
 toMillis(){return this.value.getTime()}
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
function snap(ref:DocRef,row:any):DocumentSnapshot{
 const exists=!!row?.exists||!!row?.data;const data=exists?revive(row.data??row):undefined;
 return{id:ref.id,ref,exists:()=>exists,data:()=>data,metadata:{hasPendingWrites:false},version:Number(row?.version||0)};
}
export async function getDoc(ref:DocRef){return snap(ref,await request(endpoint(ref)))}
export const getDocFromServer=getDoc;
export async function getDocs(ref:CollectionRef|QueryRef):Promise<QuerySnapshot>{
 const collectionRef=ref.kind==='query'?ref.collection:ref;
 const constraints=ref.kind==='query'?ref.constraints:[];
 const result=await request('/documents/query',{method:'POST',body:JSON.stringify({collection:collectionRef.path,constraints})});
 const docs:DocumentSnapshot[]=(result?.items||[]).map((row:any)=>snap(doc(collectionRef,row.id),{...row,exists:true}));
 return{docs,size:docs.length,empty:docs.length===0};
}
export async function getCountFromServer(ref:CollectionRef|QueryRef){const result=await getDocs(ref);return{data:()=>({count:result.size})}}
export async function setDoc(ref:DocRef,data:any,options?:{merge?:boolean}){await request(endpoint(ref),{method:'PUT',body:JSON.stringify({data,merge:!!options?.merge})})}
export async function updateDoc(ref:DocRef,data:any){await request(endpoint(ref),{method:'PATCH',body:JSON.stringify({data})})}
export async function deleteDoc(ref:DocRef){await request(endpoint(ref),{method:'DELETE'})}
export async function addDoc(ref:CollectionRef,data:any){const created=doc(ref);await setDoc(created,data);return created}
function writePayload(op:any){const parts=op.path.split('/');return{...op,collection:parts.slice(0,-1).join('/'),id:parts.at(-1)}}
function batchFacade(){
 const ops:any[]=[];
 return{
  set:(ref:DocRef,data:any,options?:any)=>{ops.push({op:'set',path:ref.path,data,merge:!!options?.merge})},
  update:(ref:DocRef,data:any)=>{ops.push({op:'update',path:ref.path,data})},
  delete:(ref:DocRef)=>{ops.push({op:'delete',path:ref.path})},
  commit:async()=>{await request('/documents/batch',{method:'POST',body:JSON.stringify({writes:ops.map(writePayload)})})}
 };
}
export function writeBatch(_db:any){return batchFacade()}
function transactionFacade(reads:Map<string,DocumentSnapshot>,ops:any[]){
 return{
  get:async(ref:DocRef)=>{if(reads.has(ref.path))return reads.get(ref.path)!;const s=await getDoc(ref);reads.set(ref.path,s);return s},
  set:(ref:DocRef,data:any,options?:any)=>ops.push({op:'set',path:ref.path,data,merge:!!options?.merge}),
  update:(ref:DocRef,data:any)=>ops.push({op:'update',path:ref.path,data}),
  delete:(ref:DocRef)=>ops.push({op:'delete',path:ref.path})
 };
}
export async function runTransaction(_db:any,callback:(tx:Transaction)=>Promise<any>){
 const reads=new Map<string,DocumentSnapshot>(),ops:any[]=[];const tx=transactionFacade(reads,ops);const result=await callback(tx);
 await request('/documents/transaction',{method:'POST',body:JSON.stringify({reads:[...reads.entries()].map(([path,s])=>({path,version:s.version||0})),writes:ops.map(writePayload)})});return result;
}
export function onSnapshot(ref:DocRef,callback:(snapshot:DocumentSnapshot)=>void,error?:(error:Error)=>void):()=>void;
export function onSnapshot(ref:CollectionRef|QueryRef,callback:(snapshot:QuerySnapshot)=>void,error?:(error:Error)=>void):()=>void;
export function onSnapshot(ref:CollectionRef|QueryRef,options:SnapshotOptions,callback:(snapshot:QuerySnapshot)=>void,error?:(error:Error)=>void):()=>void;
export function onSnapshot(ref:DocRef|CollectionRef|QueryRef,...args:any[]){
 const callback=args.find((a:any)=>typeof a==='function');const callbackIndex=args.indexOf(callback),error=args.slice(callbackIndex+1).find((a:any)=>typeof a==='function');
 let stopped=false,timer:number|undefined;
 const load=async()=>{try{if(ref.kind==='doc')callback?.(await getDoc(ref));else callback?.(await getDocs(ref as any))}catch(e){error?.(e)}};
 void load();timer=window.setInterval(()=>{if(!stopped)void load()},Number(import.meta.env.VITE_SYNC_INTERVAL_MS||5000));
 return()=>{stopped=true;if(timer)window.clearInterval(timer);};
}
