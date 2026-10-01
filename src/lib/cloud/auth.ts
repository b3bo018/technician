import { setTokenProvider } from './store';

export type User={uid:string;email:string|null;displayName:string|null;metadata:{lastSignInTime:string}};
type AuthListener=(user:User|null)=>void;
type Session={user:User;accessToken:string;refreshToken?:string;expiresAt:number};
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const listeners=new Set<AuthListener>();
let session:Session|null=null;
const key='securetrack:aws-session';
function notify(){for(const listener of listeners)listener(session?.user||null)}
function load(){try{const raw=localStorage.getItem(key);session=raw?JSON.parse(raw):null}catch{session=null}}
function save(next:Session|null){session=next;if(next)localStorage.setItem(key,JSON.stringify(next));else localStorage.removeItem(key);notify()}
load();
async function call(path:string,body:any,method='POST'){
 const response=await fetch(API+path,{method,headers:{'content-type':'application/json',...(session?.accessToken?{authorization:'Bearer '+session.accessToken}:{})},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));if(!response.ok){const e:any=new Error(data.message||'Authentication failed');e.code=data.code||String(response.status);throw e}return data;
}
async function refresh(){
 if(!session?.refreshToken)return session?.accessToken||null;
 if(session.expiresAt>Date.now()+60000)return session.accessToken;
 const data=await call('/v1/auth/refresh',{refreshToken:session.refreshToken});save({...session,accessToken:data.accessToken,expiresAt:Date.now()+Number(data.expiresIn||3600)*1000});return session!.accessToken;
}
setTokenProvider(refresh);
export const auth={get currentUser(){return session?.user||null}};
export function onAuthStateChanged(_auth:any,listener:AuthListener){listeners.add(listener);queueMicrotask(()=>listener(session?.user||null));return()=>listeners.delete(listener)}
export async function signInWithEmailAndPassword(_auth:any,email:string,password:string){const data=await call('/v1/auth/login',{email,password});save({user:data.user,accessToken:data.accessToken,refreshToken:data.refreshToken,expiresAt:Date.now()+Number(data.expiresIn||3600)*1000});return{user:data.user}}
export async function signOut(_auth:any){try{if(session)await call('/v1/auth/logout',{})}finally{save(null)}}
export async function sendPasswordResetEmail(_auth:any,email:string){await call('/v1/auth/forgot-password',{email})}
export async function createManagedUser(input:{displayName:string;email:string;password:string;role:string}){return call('/admin/users',{...input})}
export async function deleteManagedUser(email:string){return call('/admin/users/'+encodeURIComponent(email),{},'DELETE')}

export const EmailAuthProvider={credential:(email:string,password:string)=>({email,password})};
export async function reauthenticateWithCredential(user:User,credential:{email:string;password:string}){const data=await call('/v1/auth/reauthenticate',credential);if(data?.uid&&data.uid!==user.uid)throw Object.assign(new Error('The current password is incorrect.'),{code:'auth/invalid-credential'});localStorage.setItem('securetrack:reauth-password',credential.password);return{user}}
export async function updatePassword(_user:User,password:string){const current=localStorage.getItem('securetrack:reauth-password')||'';try{await call('/v1/auth/password',{currentPassword:current,password},'PUT')}finally{localStorage.removeItem('securetrack:reauth-password')}}
