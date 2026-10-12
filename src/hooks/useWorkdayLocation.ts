import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { Technician, WorkSession } from '../types';
import { workdayLocation } from '../lib/workdayLocation';

export function useWorkdayLocation(profile:Technician,session?:WorkSession){
 const [sharing,setSharing]=useState(false),[consent,setConsent]=useState(false),[error,setError]=useState('');
 const busy=useRef(false),generation=useRef(0);
 const supported=Capacitor.getPlatform()==='android';
 useEffect(()=>{if(!supported||profile.role!=='technician')return;const current=++generation.current;let stopped=false;
  async function check(){if(busy.current)return;busy.current=true;try{
   const permission=await workdayLocation.consent();if(stopped)return;setConsent(permission.granted);
   let status=await workdayLocation.status();
   if(!permission.granted||profile.status==='deactivated'||session?.status!=='active'){
    if(status.running&&status.uid===profile.uid)await workdayLocation.stop();
   }else if(!status.paused&&(!status.running||status.uid!==profile.uid||status.sessionId!==session.id)){
    await workdayLocation.start(profile.uid,session.id);
    if(stopped||current!==generation.current){await workdayLocation.stop();return}
    status=await workdayLocation.status();
   }
   if(!stopped)setSharing(permission.granted&&session?.status==='active'&&status.running);
  }catch(e){if(!stopped){setSharing(false);setError(e instanceof Error?e.message:'Location sharing could not reconnect.')}}finally{busy.current=false}}
  void check();const timer=setInterval(()=>void check(),30000);return()=>{stopped=true;generation.current++;clearInterval(timer)};
 },[supported,profile.uid,profile.role,profile.status,session?.id,session?.status]);
 async function enable(){if(busy.current||session?.status!=='active')return;busy.current=true;setError('');try{await workdayLocation.grant();setConsent(true);await workdayLocation.start(profile.uid,session.id);setSharing(true)}catch(e){setError(e instanceof Error?e.message:'Could not start location sharing.')}finally{busy.current=false}}
 async function stop(){setError('');try{await workdayLocation.stop();setSharing(false);await workdayLocation.revoke();setConsent(false)}catch(e){setError(e instanceof Error?e.message:'Could not update location consent.')}}
 return{supported,sharing,consent,error,enable,stop};
}
