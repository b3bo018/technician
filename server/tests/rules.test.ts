import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { runNotificationRules } from '../src/rules.js';

test('server evaluates workday, break, job reminder, inventory, certificate, and carried-job rules', async () => {
  const documents = [
    ['users','tech-1',{role:'technician',displayName:'Technician One',status:'active'}],
    ['users','hr-1',{role:'hr',status:'active'}],
    ['users','admin-1',{role:'admin',status:'active'}],
    ['settings','stock_alerts',{clock_in_time:'09:00',clock_out_time:'18:00',late_grace_minutes:5,max_break_minutes:30,threshold:2}],
    ['shifts','job-1',{technician_id:'tech-1',status:'assigned',date:'2026-01-01',scheduled_at:'2026-01-01T06:25:00.000Z'}],
    ['shifts','job-old',{technician_id:'tech-1',status:'assigned',carried_forward:true,date:'2025-12-31',scheduled_at:'2025-12-31T06:00:00.000Z'}],
    ['work_breaks','break-1',{technician_id:'tech-1',status:'active',started_at:'2026-01-01T05:30:00.000Z'}],
    ['inventory_accounts','tech-1',{opening:{FMC920:0,LV02:0}}],
    ['certificates','cert-expired',{expiry_date:'2025-12-20'}],
    ['certificates','cert-soon',{expiry_date:'2026-01-20'}],
  ].map(([collection,id,data])=>({collection,id,data}));
  const queued: any[]=[];
  const fakePool={query:async(sql:string,params:any[]=[])=>{
    if(sql.includes('SELECT collection,id,data FROM documents'))return{rows:documents.filter((row)=>params[0].includes(row.collection))};
    if(sql.includes("SELECT id FROM documents WHERE collection='users'"))return{rows:documents.filter((row)=>row.collection==='users'&&params[0].includes(row.data.role)).map((row)=>({id:row.id}))};
    if(sql.includes('INSERT INTO push_outbox')){queued.push({uid:params[0],key:params[1],title:params[2],body:params[3]});return{rows:[]}}
    throw new Error(`Unexpected SQL in test: ${sql}`);
  }};
  await runNotificationRules(fakePool as unknown as Pool,new Date('2026-01-01T06:10:00.000Z'));
  const has=(key:string,uid?:string)=>queued.some((row)=>row.key===key&&(!uid||row.uid===uid));
  assert.equal(has('late-clock-in:2026-01-01','tech-1'),true);
  assert.equal(has('hr-late-in:tech-1:2026-01-01','hr-1'),true);
  assert.equal(has('long-break:break-1','tech-1'),true);
  assert.equal(has('job-reminder:job-1:2026-01-01T06:25:00.000Z','tech-1'),true);
  assert.equal(queued.some((row)=>row.key.startsWith('low-stock:tech-1:FMC920:2')),true);
  assert.equal(queued.some((row)=>row.key.startsWith('low-stock:tech-1:LV02:')),false);
  assert.equal(has('certificate-expiry:2026-01-01','admin-1'),true);
  assert.equal(has('carry-forward:2026-01-01','admin-1'),true);
});
