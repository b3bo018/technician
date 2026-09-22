import { useEffect } from 'react';
import { Installation, Movement, Shift, Technician, WorkBreak, WorkSession, jobLabel } from '../types';
import { dayKey, displayTime, TIME_ZONE } from '../lib/domain';
import { notificationSeen, rememberNotification, sendAppNotification } from '../lib/notifications';

function dubaiMinutes(now:number){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));return Number(parts.find(p=>p.type==='hour')?.value||0)*60+Number(parts.find(p=>p.type==='minute')?.value||0)}

export function useTechnicianNotifications(profile:Technician|null,shifts:Shift[],installations:Installation[],movements:Movement[],sessions:WorkSession[],breaks:WorkBreak[],now:number){
 useEffect(()=>{if(!profile||profile.role!=='technician')return;const uid=profile.uid;const today=dayKey(new Date(now));const completed=new Set(installations.map(item=>item.shift_id||item.id));const recent=now-24*60*60*1000;
  for(const shift of shifts.filter(item=>item.date>=today&&!completed.has(item.id)&&Date.parse(item.assigned_at||item.scheduled_at)>=recent)){const key=`job:${shift.id}`;if(notificationSeen(uid,key))continue;void sendAppNotification('New SecureTrack job assigned',`${shift.company_name||shift.site_name} · ${jobLabel(shift.job_type)} · ${displayTime(shift.scheduled_at,shift.timezone)}`,key).then(sent=>{if(sent)rememberNotification(uid,key)})}
  for(const move of movements.filter(item=>item.type==='received'&&Date.parse(item.timestamp)>=recent)){const key=`stock:${move.id}`;if(notificationSeen(uid,key))continue;const parts=[move.quantity?`${move.quantity} ${move.device_model}`:'',move.sim_count?`${move.sim_count} SIM`:''].filter(Boolean).join(' and ');void sendAppNotification('Inventory received',`${parts} added to your SecureTrack inventory.`,key).then(sent=>{if(sent)rememberNotification(uid,key)})}
  const minutes=dubaiMinutes(now);const todaySession=sessions.find(item=>item.technician_id===uid&&item.date===today);if(minutes>=9*60+5&&minutes<18*60&&!todaySession){const key=`late-clock-in:${today}`;if(!notificationSeen(uid,key))void sendAppNotification('Clock-in is overdue','Your SecureTrack workday started at 09:00. Please clock in now.',key).then(sent=>{if(sent)rememberNotification(uid,key)})}
  const activeBreak=breaks.find(item=>item.technician_id===uid&&item.status==='active');if(activeBreak&&now-Date.parse(activeBreak.started_at)>=60*60*1000){const key=`long-break:${activeBreak.id}`;if(!notificationSeen(uid,key))void sendAppNotification('Break time exceeded','Your break has passed 60 minutes. End the break when you return to work.',key).then(sent=>{if(sent)rememberNotification(uid,key)})}
  if(minutes>=18*60+5&&todaySession?.status==='active'){const key=`late-clock-out:${today}`;if(!notificationSeen(uid,key))void sendAppNotification('Clock-out is overdue','Your normal workday ended at 18:00. Please clock out when your work is finished.',key).then(sent=>{if(sent)rememberNotification(uid,key)})}
 },[profile,shifts,installations,movements,sessions,breaks,now]);
}
