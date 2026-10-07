import type { Pool } from 'pg';
import { enqueueForRecipients, enqueuePush } from './push.js';

const TZ = 'Asia/Dubai';
const DEVICE_KEYS = ['FMC920','FMC130','FMC125','FMM130','FMM125','Jimi VL03','GT06','GT06N','LV02','Ruptela','Relay 12V','Relay 24V','Wire'];
const SIM_KEYS = ['SIM Etisalat','SIM du','SIM International','SIM'];
type Row = { id: string; data: any };
function records(rows: any[]): Row[] { return rows.map((row) => ({ id: String(row.id), data: row.data || {} })); }
function dubaiDate(date: Date) { return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
function dubaiMinutes(date: Date) { const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);return Number(parts.find((p)=>p.type==='hour')?.value||0)*60+Number(parts.find((p)=>p.type==='minute')?.value||0); }
function minutes(value: unknown, fallback: string) { const [h,m]=String(value||fallback).split(':').map(Number);return (h||0)*60+(m||0); }
function clean(row: Row) { return row.data?.is_deleted !== true && row.data?.status !== 'deactivated'; }

export async function runNotificationRules(pool: Pool, now = new Date()) {
  const names=['users','settings','shifts','installations','work_sessions','work_breaks','inventory_accounts','inventory_logs','certificates'];
  const result=await pool.query('SELECT collection,id,data FROM documents WHERE collection=ANY($1::text[])',[names]);
  const grouped=new Map<string,Row[]>();
  for(const raw of result.rows){const group=grouped.get(raw.collection)||[];group.push({id:String(raw.id),data:raw.data||{}});grouped.set(raw.collection,group)}
  const get=(name:string)=>grouped.get(name)||[];
  const users=get('users').filter(clean), technicians=users.filter((row)=>row.data.role==='technician');
  const staff=users.filter((row)=>['master_admin','owner','admin','manager','accountant','hr'].includes(row.data.role));
  const hr=users.filter((row)=>row.data.role==='hr');
  const config=get('settings').find((row)=>row.id==='stock_alerts')?.data||{};
  const today=dubaiDate(now),clock=dubaiMinutes(now),inAt=minutes(config.clock_in_time,'09:00'),outAt=minutes(config.clock_out_time,'18:00'),grace=Math.max(0,Math.min(180,Number(config.late_grace_minutes??5))),breakLimit=Math.max(1,Math.min(240,Number(config.max_break_minutes??60)));
  const sessions=get('work_sessions').map((row)=>row.data);
  const notify=(uids:string[],key:string,title:string,body:string,url='/')=>Promise.all(uids.map((uid)=>enqueuePush(pool,uid,key,{title,body,url})));

  for(const tech of technicians){
    const uid=tech.id,session=sessions.find((item)=>item.technician_id===uid&&item.date===today);
    if(clock>=inAt+grace&&clock<outAt&&!session){
      await notify([uid],`late-clock-in:${today}`,'Clock-in is overdue','Your workday has started. Please clock in now.','/?section=workforce');
      await notify(hr.map((person)=>person.id),`hr-late-in:${uid}:${today}`,'Late clock-in',`${String(tech.data.displayName||tech.data.email||'A technician')} has not clocked in.`,'/?section=workforce');
    }
    const activeBreakRow=get('work_breaks').find((row)=>row.data.technician_id===uid&&row.data.status==='active'),activeBreak=activeBreakRow?.data;
    if(activeBreak&&Date.parse(activeBreak.started_at)<=now.getTime()-breakLimit*60000){
      await notify([uid],`long-break:${activeBreakRow!.id}`,'Break time exceeded','Your break has passed the configured limit. End the break when you return to work.','/?section=workforce');
    }
    if(clock>=outAt+grace&&session?.status==='active'){
      await notify([uid],`late-clock-out:${today}`,'Clock-out is overdue','Your scheduled workday ended. Please clock out when your work is finished.','/?section=workforce');
      await notify(hr.map((person)=>person.id),`hr-late-out:${uid}:${today}`,'Late clock-out',`${String(tech.data.displayName||tech.data.email||'A technician')} has not clocked out.`,'/?section=workforce');
    }
  }

  const completedIds=new Set(get('installations').filter((row)=>clean(row)&&((row.data.unit_index===undefined)||(Number(row.data.progress_completed||0)===Number(row.data.progress_total||-1)))).map((row)=>String(row.data.shift_id||row.id)));
  for(const shift of get('shifts')){
    const data=shift.data;if(!clean(shift)||!data.technician_id||!['assigned','in_progress'].includes(data.status||'assigned')||completedIds.has(shift.id))continue;
    const scheduled=Date.parse(data.scheduled_at||'');if(!Number.isFinite(scheduled))continue;
    const due=scheduled-15*60000;if(due<=now.getTime()&&due>now.getTime()-5*60000)await notify([String(data.technician_id)],`job-reminder:${shift.id}:${String(data.scheduled_at)}`,'SecureTrack job in 15 minutes','Your assigned job is coming up. Open SecureTrack to review the schedule.','/?section=jobs');
  }

  const movementRows=get('inventory_logs').map((row)=>row.data);
  for(const tech of technicians){
    const account=get('inventory_accounts').find((row)=>row.id===tech.id)?.data;if(!account?.opening)continue;
    const stock:Record<string,number>=Object.fromEntries([...DEVICE_KEYS,...SIM_KEYS].map((key)=>[key,Number(account.opening[key]||0)]));
    for(const move of movementRows.filter((item)=>item.technician_id===tech.id)){
      if(move.type==='adjustment'){if(move.device_model&&stock[move.device_model]!==undefined)stock[move.device_model]+=Number(move.quantity_delta||0);else{const sim=move.sim_provider?`SIM ${move.sim_provider}`:'SIM';if(stock[sim]!==undefined)stock[sim]+=Number(move.sim_delta||0)}continue}
      const sign=move.type==='received'?1:-1;if(move.device_model&&stock[move.device_model]!==undefined)stock[move.device_model]+=sign*Number(move.quantity||0);
      const sim=move.sim_provider?`SIM ${move.sim_provider}`:'SIM';if(stock[sim]!==undefined)stock[sim]+=sign*Number(move.sim_count||0);
      for(const key of ['Relay 12V','Relay 24V','Wire'])stock[key]+=sign*Number(move[key.toLowerCase().replace(' ','_')+'_count']||0);
    }
    for(const [key,value] of Object.entries(stock)){
      const minimum=Math.max(0,Number((key.startsWith('SIM')?config.sim_minimums?.[key]:config.device_minimums?.[key])??config.threshold??2));if(value>minimum)continue;
      const body=`${String(tech.data.displayName||tech.data.email||'Technician')}: ${key} has ${value} remaining (minimum ${minimum}).`;
      for(const recipient of [...staff,...(users.find((row)=>row.id===tech.id)?[tech]:[])])await enqueuePush(pool,recipient.id,`low-stock:${tech.id}:${key}:${minimum}`,{title:'Low stock alert',body,url:'/?section=inventory'});
    }
  }

  const expirySoon=Date.parse(`${today}T12:00:00Z`)+30*86400000,todayMs=Date.parse(`${today}T00:00:00Z`);
  const expiries=get('certificates').filter((row)=>clean(row)&&/^\d{4}-\d{2}-\d{2}$/.test(String(row.data.expiry_date||'')));
  const expired=expiries.filter((row)=>Date.parse(`${row.data.expiry_date}T00:00:00Z`)<todayMs).length;
  const soon=expiries.filter((row)=>{const d=Date.parse(`${row.data.expiry_date}T00:00:00Z`);return d>=todayMs&&d<=expirySoon}).length;
  if(soon||expired)await enqueueForRecipients(pool,`certificate-expiry:${today}`,{title:'Certificate expiry attention',body:`${soon} expiring soon · ${expired} expired. Open SecureTrack to review.`,url:'/?section=certificates'},['master_admin','owner','admin'],[]);

  const carried=get('shifts').filter((row)=>clean(row)&&row.data.carried_forward&&String(row.data.date||'')<=today&&!['completed','cancelled'].includes(row.data.status)&&Number(row.data.completed_units||0)<Math.max(1,Number(row.data.unit_count||1))).length;
  if(carried)await enqueueForRecipients(pool,`carry-forward:${today}`,{title:'Jobs carried forward',body:`${carried} unfinished job${carried===1?' was':'s were'} carried forward to today.`,url:'/?section=jobs'},['master_admin','owner','admin'],[]);
}

export function startNotificationRules(pool: Pool) {
  let busy=false;
  const timer=setInterval(async()=>{if(busy)return;busy=true;try{await runNotificationRules(pool)}catch(error){console.error('Notification rules failed',error)}finally{busy=false}},60000);
  timer.unref();
  void runNotificationRules(pool).catch((error)=>console.error('Initial notification rules failed',error));
}
