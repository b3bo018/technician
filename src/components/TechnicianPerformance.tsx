import { useMemo, useState } from 'react';
import { BriefcaseBusiness, CalendarCheck, CheckCircle2, Clock3, PackagePlus } from 'lucide-react';
import type { Attendance, Installation, Shift, Technician, WorkBreak, WorkSession } from '../types';
import { dayKey, displayTime, isReleasedJob, TIME_ZONE } from '../lib/domain';
import { jobLabel } from '../types';

type Props={
  technicians:Technician[];
  shifts:Shift[];
  installations:Installation[];
  attendance:Attendance[];
  workSessions:WorkSession[];
  workBreaks:WorkBreak[];
  now:number;
};

type Preset='today'|'yesterday'|'week'|'month'|'last-month'|'custom';

const dateFrom=(value:string)=>new Date(value+'T00:00:00+04:00');
const addDays=(value:string,days:number)=>{const d=dateFrom(value);d.setDate(d.getDate()+days);return dayKey(d)};
const monthBounds=(value:string,offset=0)=>{const d=dateFrom(value);d.setMonth(d.getMonth()+offset,1);const from=dayKey(d);d.setMonth(d.getMonth()+1,0);return[from,dayKey(d)] as const};
const within=(value:string,from:string,to:string)=>value>=from&&value<=to;
const pct=(n:number,d:number)=>d?Math.round(n/d*100):0;

function completedAt(shift:Shift,installations:Installation[]){
  if(shift.completed_at)return shift.completed_at;
  const rows=installations.filter(item=>item.shift_id===shift.id||item.id===shift.id).filter(item=>item.completed_at||item.timestamp);
  return rows.sort((a,b)=>String(b.completed_at||b.timestamp).localeCompare(String(a.completed_at||a.timestamp)))[0]?.completed_at
    ||rows[0]?.timestamp||'';
}

function isComplete(shift:Shift,installations:Installation[]){
  if(shift.status==='completed')return true;
  const rows=installations.filter(item=>item.shift_id===shift.id||item.id===shift.id);
  return rows.some(item=>item.progress_total&&item.progress_completed===item.progress_total)
    ||rows.filter(item=>item.unit_index!==undefined).length>=Math.max(1,shift.unit_count);
}

function completedVehicles(shift:Shift,installations:Installation[]){
  if(shift.status==='completed')return Math.max(1,shift.unit_count);
  const rows=installations.filter(item=>item.shift_id===shift.id||item.id===shift.id);
  const indexed=new Set(rows.filter(item=>item.unit_index!==undefined).map(item=>item.unit_index));
  const progress=Math.max(0,...rows.map(item=>item.progress_completed||0),shift.completed_units||0,indexed.size);
  return Math.min(Math.max(1,shift.unit_count),progress);
}

function durationMinutes(shift:Shift,attendance:Attendance[],installations:Installation[]){
  const end=completedAt(shift,installations);if(!end)return 0;
  const arrival=attendance.find(item=>item.id===shift.id)?.timestamp||shift.arrived_at||shift.scheduled_at;
  const minutes=Math.round((Date.parse(end)-Date.parse(arrival))/60000);
  return Number.isFinite(minutes)?Math.max(0,minutes):0;
}

export function TechnicianPerformance({technicians,shifts,installations,attendance,workSessions,workBreaks,now}:Props){
  const today=dayKey(new Date(now));
  const [preset,setPreset]=useState<Preset>('month');
  const initial=monthBounds(today);
  const [from,setFrom]=useState(initial[0]);
  const [to,setTo]=useState(initial[1]);
  const [techFilter,setTechFilter]=useState('all');

  function applyPreset(next:Preset){
    setPreset(next);
    if(next==='custom')return;
    if(next==='today'){setFrom(today);setTo(today);return}
    if(next==='yesterday'){const d=addDays(today,-1);setFrom(d);setTo(d);return}
    if(next==='week'){
      const d=dateFrom(today);const weekday=(d.getDay()+6)%7;const start=addDays(today,-weekday);
      setFrom(start);setTo(addDays(start,6));return;
    }
    const bounds=monthBounds(today,next==='last-month'?-1:0);setFrom(bounds[0]);setTo(bounds[1]);
  }

  const released=useMemo(()=>shifts.filter(shift=>isReleasedJob(shift)&&within(shift.date,from,to)),[shifts,from,to]);
  const scoped=useMemo(()=>released.filter(shift=>techFilter==='all'||shift.technician_id===techFilter),[released,techFilter]);
  const sessions=useMemo(()=>workSessions.filter(item=>within(item.date,from,to)&&(techFilter==='all'||item.technician_id===techFilter)),[workSessions,from,to,techFilter]);
  const breaks=useMemo(()=>workBreaks.filter(item=>within(item.date,from,to)&&(techFilter==='all'||item.technician_id===techFilter)),[workBreaks,from,to,techFilter]);

  const summary=useMemo(()=>technicians.filter(t=>t.role==='technician'&&(techFilter==='all'||t.uid===techFilter)).map(tech=>{
    const jobs=released.filter(shift=>shift.technician_id===tech.uid);
    const completed=jobs.filter(shift=>isComplete(shift,installations));
    const arrivals=jobs.map(shift=>({shift,arrival:attendance.find(item=>item.id===shift.id)})).filter(row=>row.arrival);
    const onTime=arrivals.filter(({shift,arrival})=>Date.parse(arrival!.timestamp)<=Date.parse(shift.scheduled_at)+(shift.grace_minutes||0)*60000).length;
    const vehicles=jobs.reduce((sum,shift)=>sum+completedVehicles(shift,installations),0);
    const carry=jobs.filter(shift=>shift.carried_forward||!!shift.original_scheduled_date).length;
    const firstSchedule=completed.filter(shift=>!shift.carried_forward&&!shift.original_scheduled_date).length;
    const eligible=jobs.filter(shift=>Date.parse(shift.scheduled_at)<=now||isComplete(shift,installations));
    const recorded=eligible.reduce((sum,shift)=>sum+(attendance.some(item=>item.id===shift.id)?1:0)+(isComplete(shift,installations)?1:0),0);
    const minutes=completed.reduce((sum,shift)=>sum+durationMinutes(shift,attendance,installations),0);
    const attendanceDays=new Set(workSessions.filter(item=>item.technician_id===tech.uid&&within(item.date,from,to)).map(item=>item.date)).size;
    return{tech,jobs:jobs.length,completed:completed.length,pending:jobs.length-completed.length,vehicles,carry,onTime:pct(onTime,arrivals.length),firstSchedule:pct(firstSchedule,completed.length),workflow:pct(recorded,eligible.length*2),minutes,attendanceDays};
  }),[technicians,released,installations,attendance,workSessions,techFilter,from,to,now]);

  const completed=scoped.filter(shift=>isComplete(shift,installations));
  const vehicles=scoped.reduce((sum,shift)=>sum+completedVehicles(shift,installations),0);
  const carried=scoped.filter(shift=>shift.carried_forward||!!shift.original_scheduled_date);
  const pending=scoped.filter(shift=>!isComplete(shift,installations));
  const arrivals=scoped.map(shift=>({shift,arrival:attendance.find(item=>item.id===shift.id)})).filter(row=>row.arrival);
  const onTime=arrivals.filter(({shift,arrival})=>Date.parse(arrival!.timestamp)<=Date.parse(shift.scheduled_at)+(shift.grace_minutes||0)*60000).length;
  const firstSchedule=completed.filter(shift=>!shift.carried_forward&&!shift.original_scheduled_date).length;
  const durations=completed.map(shift=>durationMinutes(shift,attendance,installations)).filter(Boolean);
  const averageDuration=durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):0;
  const attendanceDays=new Set(sessions.map(item=>item.date+':'+item.technician_id)).size;
  const activeBreaks=breaks.filter(item=>item.status==='active').length;

  const jobTypes=useMemo(()=>Object.entries(scoped.reduce<Record<string,{assigned:number;completed:number;vehicles:number}>>((acc,shift)=>{
    const key=shift.job_type||'inspection';const row=acc[key]||{assigned:0,completed:0,vehicles:0};row.assigned++;if(isComplete(shift,installations))row.completed++;row.vehicles+=completedVehicles(shift,installations);acc[key]=row;return acc;
  },{})).sort((a,b)=>b[1].assigned-a[1].assigned),[scoped,installations]);

  const attention=useMemo(()=>scoped.filter(shift=>{
    if(isComplete(shift,installations))return false;
    return Date.parse(shift.scheduled_at)<now||shift.carried_forward||!!shift.original_scheduled_date;
  }).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)),[scoped,installations,now]);

  return <div className="stack">
    <section className="panel filter-strip">
      <div className="section-label"><div><h2>Technician performance</h2><p>Objective workload, attendance and workflow metrics from existing operational records. No automatic ranking or punishment.</p></div><span>{from===to?from:`${from} – ${to}`}</span></div>
      <div className="filter-grid">
        <label>Technician<select value={techFilter} onChange={e=>setTechFilter(e.target.value)}><option value="all">All technicians</option>{technicians.filter(t=>t.role==='technician').map(t=><option key={t.uid} value={t.uid}>{t.displayName||t.email}</option>)}</select></label>
        <label>Period<select value={preset} onChange={e=>applyPreset(e.target.value as Preset)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="last-month">Last month</option><option value="custom">Custom</option></select></label>
        <label>From<input type="date" value={from} onChange={e=>{setPreset('custom');setFrom(e.target.value)}}/></label>
        <label>To<input type="date" value={to} onChange={e=>{setPreset('custom');setTo(e.target.value)}}/></label>
      </div>
    </section>

    <div className="metrics performance-metrics">
      <div className="metric"><div><span>JOBS ASSIGNED</span><BriefcaseBusiness/></div><strong>{scoped.length}</strong><small>{completed.length} completed · {pending.length} pending</small></div>
      <div className="metric"><div><span>VEHICLES COMPLETED</span><PackagePlus/></div><strong>{vehicles}</strong><small>Vehicle-wise progress from existing jobs</small></div>
      <div className="metric"><div><span>ON-TIME ARRIVAL</span><Clock3/></div><strong>{pct(onTime,arrivals.length)}<em>%</em></strong><small>{arrivals.length} recorded arrivals</small></div>
      <div className="metric"><div><span>FIRST-SCHEDULE COMPLETION</span><CheckCircle2/></div><strong>{pct(firstSchedule,completed.length)}<em>%</em></strong><small>Completed without a carry-forward marker</small></div>
      <div className="metric"><div><span>CARRY FORWARD</span><CalendarCheck/></div><strong>{carried.length}</strong><small>Preserved from existing job history</small></div>
      <div className="metric"><div><span>AVG. ON-SITE TIME</span><Clock3/></div><strong>{Math.floor(averageDuration/60)}h {averageDuration%60}m</strong><small>Arrival to completion where recorded</small></div>
    </div>

    <section className="panel">
      <div className="section-label"><div><h2>Technician workload & reliability</h2><p>Job count is shown together with vehicle workload, arrival, carry-forward and workflow evidence so one metric cannot misrepresent performance.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Technician</th><th>Assigned</th><th>Completed</th><th>Vehicles</th><th>Pending</th><th>Carry forward</th><th>On time</th><th>First schedule</th><th>Workflow records</th><th>Attendance days</th></tr></thead>
      <tbody>{summary.map(row=><tr key={row.tech.uid}><td><strong>{row.tech.displayName||row.tech.email}</strong></td><td>{row.jobs}</td><td>{row.completed}</td><td>{row.vehicles}</td><td>{row.pending}</td><td>{row.carry}</td><td><span className="badge">{row.onTime}%</span></td><td><span className="badge">{row.firstSchedule}%</span></td><td><span className="badge">{row.workflow}%</span></td><td>{row.attendanceDays}</td></tr>)}</tbody></table>{!summary.length&&<div className="empty">No technician data for this period.</div>}</div>
    </section>

    <section className="panel">
      <div className="section-label"><div><h2>Work by job type</h2><p>Separates installations, removals, inspections, SIM changes and other work instead of treating every job as equal.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Job type</th><th>Assigned</th><th>Completed</th><th>Vehicles completed</th></tr></thead><tbody>{jobTypes.map(([type,row])=><tr key={type}><td>{jobLabel(type as any)}</td><td>{row.assigned}</td><td>{row.completed}</td><td>{row.vehicles}</td></tr>)}</tbody></table>{!jobTypes.length&&<div className="empty">No jobs in this period.</div>}</div>
    </section>

    <section className="panel">
      <div className="section-label"><div><h2>Attention required</h2><p>Operational follow-up only. These records are not automatically treated as technician fault.</p></div><span>{attention.length} job{attention.length===1?'':'s'}</span></div>
      <div className="table-wrap"><table><thead><tr><th>Technician</th><th>Company</th><th>Job</th><th>Scheduled</th><th>Vehicles</th><th>Reason visible from current data</th></tr></thead><tbody>{attention.slice(0,50).map(shift=><tr key={shift.id}><td>{shift.technician_name}</td><td>{shift.company_name||shift.site_name}</td><td>{jobLabel(shift.job_type)}</td><td>{displayTime(shift.scheduled_at,shift.timezone||TIME_ZONE)}</td><td>{shift.unit_count}</td><td>{shift.carried_forward||shift.original_scheduled_date?'Carried forward / pending':'Scheduled time passed — reason not yet recorded'}</td></tr>)}</tbody></table>{!attention.length&&<div className="empty">No overdue or carried-forward jobs need attention.</div>}</div>
    </section>

    <section className="panel">
      <div className="section-label"><div><h2>Attendance & workflow context</h2><p>Uses the existing attendance and job records; it does not create a second attendance system.</p></div></div>
      <div className="workforce-metrics"><div><span>ATTENDANCE RECORDS</span><strong>{attendanceDays}</strong><small>Technician-day records in this period</small></div><div><span>ACTIVE BREAKS</span><strong>{activeBreaks}</strong><small>Current break records inside the selected period</small></div><div><span>ARRIVAL RECORDS</span><strong>{arrivals.length}</strong><small>Existing confirm-arrival records</small></div><div><span>COMPLETED JOBS</span><strong>{completed.length}</strong><small>Existing completion records only</small></div></div>
    </section>
  </div>;
}
