import { useState } from 'react';
import { Coffee, LogIn, LogOut, MapPin } from 'lucide-react';
import { Technician, WorkBreak, WorkSession } from '../types';
import { clockInWorkday, clockOutWorkday, endWorkBreak, startWorkBreak } from '../lib/data';
import { captureLocation } from '../lib/location';
import { dayKey, displayTime, TIME_ZONE } from '../lib/domain';

const timeOnly=(value:string)=>displayTime(value).slice(-5);
export function WorkdayPanel({profile,sessions,breaks,now,onError}:{profile:Technician;sessions:WorkSession[];breaks:WorkBreak[];now:number;onError:(message:string)=>void}){
 const [busy,setBusy]=useState(false);const date=dayKey(new Date(now));const session=sessions.find(item=>item.date===date);const ownBreaks=breaks.filter(item=>item.session_id===session?.id);const activeBreak=ownBreaks.find(item=>item.status==='active');
 const localHour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',hourCycle:'h23'}).format(new Date(now)));const late=!session&&localHour>=9;
 async function act(action:'in'|'out'|'break'|'resume'){
  setBusy(true);onError('');try{
   if(action==='in')await clockInWorkday(profile,date,await captureLocation());
   if(action==='out'&&session)await clockOutWorkday(session,await captureLocation());
   if(action==='break'&&session)await startWorkBreak(session);
   if(action==='resume'&&activeBreak)await endWorkBreak(activeBreak);
  }catch(e:any){onError(e.message)}finally{setBusy(false)}
 }
 return <section className="panel workday-panel"><div className="section-title"><div className="icon-box"><MapPin/></div><div><h2>Today’s attendance</h2><p>Work times use the SecureTrack server clock in 24-hour format.</p></div></div>
 {!session?<div className={'clock-gate '+(late?'late':'')}><div><strong>{late?'Clock-in is late':'Clock in to start your day'}</strong><p>Your current location and server time will be recorded. Your job list opens immediately after clock-in.</p></div><button className="primary" disabled={busy} onClick={()=>act('in')}><LogIn/>{busy?'Getting location…':'Clock in'}</button></div>:
 <div className="workday-status"><div><span>CLOCKED IN</span><strong>{timeOnly(session.clock_in_at)}</strong><small>{session.status==='clocked_out'&&session.clock_out_at?`Clocked out ${timeOnly(session.clock_out_at)}`:activeBreak?'Break in progress':'Shift active'}</small></div><div className="workday-actions">{session.status==='active'&&(activeBreak?<button className="secondary" disabled={busy} onClick={()=>act('resume')}><Coffee/>End break</button>:<button className="secondary" disabled={busy} onClick={()=>act('break')}><Coffee/>Start break</button>)}{session.status==='active'&&<button className="secondary" disabled={busy||!!activeBreak} onClick={()=>act('out')}><LogOut/>Clock out</button>}</div></div>}
 {ownBreaks.length>0&&<div className="break-history">{ownBreaks.map(item=><span key={item.id}>Break {timeOnly(item.started_at)}{item.ended_at?`–${timeOnly(item.ended_at)}`:'–active'}</span>)}</div>}
 </section>
}

export function WorkforcePanel({sessions,breaks}:{sessions:WorkSession[];breaks:WorkBreak[]}){
 const sorted=[...sessions].sort((a,b)=>b.clock_in_at.localeCompare(a.clock_in_at));
 return <section className="panel"><div className="section-title"><div className="icon-box"><MapPin/></div><div><h2>Shift attendance</h2><p>Server-recorded clock-in, breaks and clock-out times.</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Technician</th><th>Clock in</th><th>Breaks</th><th>Clock out</th><th>Status</th></tr></thead><tbody>{sorted.map(item=>{const own=breaks.filter(row=>row.session_id===item.id);return <tr key={item.id}><td>{item.date.split('-').reverse().join('-')}</td><td>{item.technician_name}</td><td>{displayTime(item.clock_in_at)}</td><td>{own.map(row=>`${timeOnly(row.started_at)}–${row.ended_at?timeOnly(row.ended_at):'active'}`).join(' · ')||'—'}</td><td>{item.clock_out_at?displayTime(item.clock_out_at):'—'}</td><td>{item.status==='active'?'Active':'Clocked out'}</td></tr>})}</tbody></table>{!sorted.length&&<div className="empty">No technician clock-ins yet.</div>}</div></section>
}
