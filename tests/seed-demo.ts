import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc,setDoc,Timestamp } from 'firebase/firestore';
import { dayKey,localToISO,nextDate } from '../src/lib/domain';
import { emptyStock } from '../src/types';
const env=await initializeTestEnvironment({projectId:'demo-securetrack',firestore:{host:'127.0.0.1',port:8080}});
const people=[{email:'aisha@example.test',name:'Aisha Rahman',role:'technician'},{email:'maya@example.test',name:'Maya Osman',role:'admin'}];
const ids:string[]=[];
for(const p of people){
 let response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:p.email,password:'FieldDemo2026!',returnSecureToken:true})});
 let data:any=await response.json();
 if(!data.localId){response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:p.email,password:'FieldDemo2026!',returnSecureToken:true})});data=await response.json();}
 if(!data.localId)throw Error('Could not seed emulator user');
 ids.push(data.localId);
 await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),'users',data.localId),{uid:data.localId,email:p.email,displayName:p.name,role:p.role,status:'active',inventory_count:22,inventory_breakdown:{fmc920:14,fmc130:8,sim_cards:30}});
  await setDoc(doc(c.firestore(),'inventory_accounts',data.localId),{technician_id:data.localId,opening:{...emptyStock(),FMC920:14,FMC130:8,SIM:30},timestamp:Timestamp.fromDate(new Date('2026-09-01T00:00:00Z'))});
 });
}
const date=dayKey(new Date());
await env.withSecurityRulesDisabled(async c=>{
 const db=c.firestore();
 for(const [n,site,time] of [['1','Al Quoz · Fleet workshop','08:00'],['2','Jebel Ali · Logistics hub','17:30']]){
  await setDoc(doc(db,'shifts','demo-visit-'+n),{technician_id:ids[0],technician_name:'Aisha Rahman',site_name:site,customer_name:n==='1'?'Gulf Fleet Services':'Emirates Logistics',customer_phone:'+971500000000',maps_url:'https://www.google.com/maps?q=25.145,55.232',latitude:25.145,longitude:55.232,radius_m:150,grace_minutes:5,date,timezone:'Asia/Dubai',scheduled_at:Timestamp.fromDate(new Date(localToISO(date,time))),window_start:Timestamp.fromDate(new Date(localToISO(date,'00:00'))),window_end:Timestamp.fromDate(new Date(localToISO(nextDate(date),'00:00'))),created_at:Timestamp.now()});
 }
 await setDoc(doc(db,'attendance_logs','demo-visit-1'),{technician_id:ids[0],latitude:25.1451,longitude:55.2319,accuracy_m:8,timestamp:Timestamp.fromDate(new Date(localToISO(date,'07:56')))});
 for(let n=1;n<=3;n++){
  const base={technician_id:ids[0],technician_name:'Aisha Rahman',device_model:'FMC920',sim_count:1,timestamp:Timestamp.fromDate(new Date(localToISO(date,'09:0'+n))),captured_at:Timestamp.fromDate(new Date(localToISO(date,'09:0'+n))),notes:''};
  await setDoc(doc(db,'installations','demo-install-'+n),{...base,customer_ref:'Gulf Logistics',vehicle_ref:'Fleet 0'+n});
  await setDoc(doc(db,'inventory_logs','demo-install-'+n),{...base,type:'installed',quantity:1});
 }
});
await env.cleanup();
console.log('Seeded isolated local demo accounts and site visits.');

