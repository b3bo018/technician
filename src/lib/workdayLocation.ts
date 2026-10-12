import { Capacitor, registerPlugin } from '@capacitor/core';
import { nativeLocationSession, pushApi } from './cloud/auth';

const NativeLocation=registerPlugin<{
 start(options:{uid:string;token:string;refreshToken:string;sessionId:string;trackingSessionId:string;updateIntervalSeconds:number}):Promise<void>;
 stop():Promise<void>;
 status():Promise<{running:boolean;paused:boolean;uid?:string;sessionId?:string}>;
}>('SecureTrackLocation');
async function request(path:string,body?:unknown){
 const token=await pushApi.getSessionToken();if(!token)throw new Error('Sign in again to share location.');
 const response=await fetch(pushApi.apiBase+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||'Location sharing could not connect to AWS.');return result;
}
export const workdayLocation={
 consent:()=>request('/v1/locations/consent') as Promise<{granted:boolean}>,
 grant:()=>request('/v1/locations/consent',{granted:true,policyVersion:'1'}),
 revoke:()=>request('/v1/locations/consent',{granted:false,policyVersion:'1'}),
 status:async():Promise<{running:boolean;paused:boolean;uid?:string;sessionId?:string}>=>Capacitor.getPlatform()==='android'?NativeLocation.status():{running:false,paused:false},
 async start(uid:string,sessionId:string){
  if(Capacitor.getPlatform()!=='android')throw new Error('Use the X OPS Android app for background workday location.');
  const credentials=await nativeLocationSession();if(credentials.uid!==uid)throw new Error('Account changed. Sign in again.');
  const tracking=await request('/v1/locations/start',{sessionId});
  try{await NativeLocation.start({...credentials,sessionId,trackingSessionId:tracking.trackingSessionId,updateIntervalSeconds:tracking.updateIntervalSeconds})}
  catch(error){await request('/v1/locations/stop',{sessionId,trackingSessionId:tracking.trackingSessionId}).catch(()=>{});throw error}
 },
 async stop(){if(Capacitor.getPlatform()==='android')await NativeLocation.stop()},
};
