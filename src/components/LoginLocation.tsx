import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { User } from 'firebase/auth';
import { captureLocation, LocationError } from '../lib/location';
import { recordLogin } from '../lib/data';
export function LoginLocation({ user, onComplete }: { user: User; onComplete: () => void }) {
 const [busy,setBusy]=useState(true);const [error,setError]=useState('');const running=useRef(false);const retryOnResume=useRef(false);
 async function capture(){if(running.current)return;running.current=true;setBusy(true);setError('');try{const coords=await captureLocation();await recordLogin(user.uid,user.uid+'_'+Date.parse(user.metadata.lastSignInTime||new Date().toISOString()),coords);retryOnResume.current=false;onComplete();}catch(e){retryOnResume.current=e instanceof LocationError&&e.code===1;setError(e instanceof Error?e.message:'Location could not be recorded. Please try again.');}finally{running.current=false;setBusy(false);}}
 useEffect(()=>{void capture();const resume=()=>{if(document.visibilityState==='visible'&&retryOnResume.current)void capture()};document.addEventListener('visibilitychange',resume);window.addEventListener('pageshow',resume);return()=>{document.removeEventListener('visibilitychange',resume);window.removeEventListener('pageshow',resume)}},[]);
 return <section className={`notice location-prompt ${error?'error':'warning'}`} role={error?'alert':'status'}><span className="location-prompt-icon"><MapPin aria-hidden="true"/></span><div className="location-prompt-copy"><strong>{busy?'Recording your login location…':'Location was not recorded'}</strong><p>{error||'SecureTrack is automatically getting your current position. If Chrome asks, choose Allow and keep Precise Location enabled.'}</p></div>{error&&<button className="secondary" disabled={busy} onClick={capture}>{busy?'Finding location…':'Try again'}</button>}</section>;
}
