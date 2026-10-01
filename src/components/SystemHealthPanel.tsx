import { useEffect, useState } from 'react';
import { getDocFromServer, doc } from '../lib/cloud/store';
import { CheckCircle2, RefreshCw, TriangleAlert } from 'lucide-react';
import { auth, db } from '../lib/aws';

type Check={label:string;ok:boolean;detail:string};

export function SystemHealthPanel({userId}:{userId:string}){
  const [checks,setChecks]=useState<Check[]>([]),[checking,setChecking]=useState(false),[checkedAt,setCheckedAt]=useState('');
  async function check(){
    setChecking(true);
    const next:Check[]=[{label:'Application',ok:true,detail:'SecureTrack loaded correctly.'},{label:'Authentication',ok:auth.currentUser?.uid===userId,detail:auth.currentUser?'Signed-in session is active.':'No active signed-in session.'}];
    try{await getDocFromServer(doc(db,'users',userId));next.push({label:'Database',ok:true,detail:'Firestore responded successfully.'})}catch{next.push({label:'Database',ok:false,detail:'Firestore could not be reached. Try again or contact support.'})}
    next.push({label:'File storage',ok:true,detail:'No separate cloud-storage dependency is required by the current app.'});
    setChecks(next);setCheckedAt(new Date().toLocaleString('en-AE',{timeZone:'Asia/Dubai'}));setChecking(false);
  }
  useEffect(()=>{void check()},[]);
  return <section className="panel system-health"><div className="section-label"><div><h2>System status</h2><p>Protected live checks for the application and its critical services.</p></div><button className="secondary" disabled={checking} onClick={()=>void check()}><RefreshCw/>{checking?'Checking…':'Check again'}</button></div><div className="health-grid">{checks.map(item=><article className={item.ok?'healthy':'unhealthy'} key={item.label}>{item.ok?<CheckCircle2/>:<TriangleAlert/>}<div><strong>{item.label}</strong><small>{item.detail}</small></div></article>)}</div>{checkedAt&&<p className="fine-print">Last checked {checkedAt} (Dubai time).</p>}</section>;
}
