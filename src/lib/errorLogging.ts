import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const hidden=/password|token|secret|credential|authorization|cookie|api[-_]?key/i;

function clean(value:unknown,depth=0):unknown{
  if(depth>3)return '[truncated]';
  if(value==null||typeof value==='number'||typeof value==='boolean')return value;
  if(typeof value==='string')return value.slice(0,1000);
  if(Array.isArray(value))return value.slice(0,20).map(item=>clean(item,depth+1));
  if(typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).filter(([key])=>!hidden.test(key)).slice(0,30).map(([key,item])=>[key,clean(item,depth+1)]));
  return String(value).slice(0,1000);
}

export async function logAppError(error:unknown,module='frontend',context:Record<string,unknown>={}){
  const user=auth.currentUser;
  if(!user)return;
  const source=error instanceof Error?error:new Error(String(error));
  try{
    await addDoc(collection(db,'error_logs'),{
      severity:'error',
      message:source.message.slice(0,1000),
      stack:(source.stack||'').slice(0,6000),
      module:module.slice(0,120),
      user_uid:user.uid,
      request_url:`${location.origin}${location.pathname}`.slice(0,500),
      context:clean(context),
      created_at:serverTimestamp()
    });
  }catch{
    // Logging must never interrupt the user's workflow.
  }
}
