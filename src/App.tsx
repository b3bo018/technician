import { LoginLocation } from './components/LoginLocation';
import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { BarChart3, BriefcaseBusiness, CalendarCheck, CalendarPlus, ClipboardList, Gauge, LayoutDashboard, LogOut, MapPin, Package, PackagePlus, RefreshCw, Settings as SettingsIcon, Users, Wifi, WifiOff, Wrench } from 'lucide-react';
import { auth } from './lib/firebase';
import { Attendance, DEVICE_MODELS, Installation, InventoryAccount, Movement, PendingOperation, Shift, Technician, WorkBreak, WorkSession, roleLabel, jobLabel } from './types';
import { ensureInventory, ensureProfile, legacyQueueCount, mapAccount, mapAttendance, mapInstallation, mapMovement, mapShift, mapWorkBreak, mapWorkSession, observe, observeProfile, pending, queueOperation, syncOperations } from './lib/data';
import { TIME_ZONE, attendanceStatus, dayKey, displayTime, simTotal, stockAt } from './lib/domain';
import { LoginScreen } from './components/LoginScreen';
import { StockGrid } from './components/StockGrid';
import { AttendancePanel } from './components/AttendancePanel';
import { AdminDashboard, type AdminSection } from './components/AdminDashboard';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { ProfileSettings } from './components/ProfileSettings';
import { WorkdayPanel } from './components/WorkdayPanel';
type Tab = 'overview' | 'inventory' | 'installations' | 'attendance' | 'settings' | 'admin';
export default function App() {
 const [user,setUser] = useState<User|null>(null); const [ready,setReady] = useState(false); const [profile,setProfile] = useState<Technician|null>(null);
 const [tab,setTab] = useState<Tab>('overview'); const [online,setOnline] = useState(navigator.onLine); const [now,setNow] = useState(Date.now());
 const [installations,setInstallations] = useState<Installation[]>([]); const [legacy,setLegacy] = useState<Installation[]>([]); const [movements,setMovements] = useState<Movement[]>([]); const [accounts,setAccounts] = useState<InventoryAccount[]>([]); const [shifts,setShifts] = useState<Shift[]>([]); const [attendance,setAttendance] = useState<Attendance[]>([]); const [technicians,setTechnicians] = useState<Technician[]>([]);
 const [loginLogs,setLoginLogs]=useState<Attendance[]>([]);
 const [workSessions,setWorkSessions]=useState<WorkSession[]>([]);const [workBreaks,setWorkBreaks]=useState<WorkBreak[]>([]);
 const [queue,setQueue] = useState<PendingOperation[]>([]); const [syncing,setSyncing] = useState(false); const [error,setError] = useState(''); const [oldPending,setOldPending] = useState(0); const [prompt,setPrompt] = useState<any>(null);
 const [locationSession,setLocationSession]=useState('');
 const [adminSection,setAdminSection]=useState<AdminSection>('jobs');
 const [mobileNavHidden,setMobileNavHidden]=useState(false);
 const isStaff = !!profile && profile.role !== 'technician';
 const adminNav=profile?[{id:'jobs' as AdminSection,label:'Job activity',icon:BriefcaseBusiness},...(['master_admin','admin','manager','hr'].includes(profile.role)?[{id:'workforce' as AdminSection,label:'Shift attendance',icon:CalendarCheck},{id:'completed' as AdminSection,label:'Completed jobs',icon:ClipboardList}]:[]),...(['master_admin','admin'].includes(profile.role)?[{id:'assign' as AdminSection,label:'Add job',icon:CalendarPlus}]:[]),...(['master_admin','admin','hr'].includes(profile.role)?[{id:'performance' as AdminSection,label:'Performance',icon:Gauge}]:[]),...(profile.role!=='hr'?[{id:'inventory' as AdminSection,label:'Inventory',icon:PackagePlus}]:[]),...(['master_admin','admin','accountant'].includes(profile.role)?[{id:'stock' as AdminSection,label:'Issue stock',icon:PackagePlus}]:[]),...(['master_admin','admin','manager','hr'].includes(profile.role)?[{id:'reports' as AdminSection,label:'Reports',icon:BarChart3}]:[]),...(profile.role==='master_admin'?[{id:'people' as AdminSection,label:'People & roles',icon:Users}]:[])]:[];
 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setProfile(null);setReady(true);setError('');}),[]);
 useEffect(()=>{if(profile)setAdminSection('jobs')},[profile?.role]);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);const timer=setInterval(()=>setNow(Date.now()),30000);const install=(e:Event)=>{e.preventDefault();setPrompt(e);};window.addEventListener('online',update);window.addEventListener('offline',update);window.addEventListener('beforeinstallprompt',install);return()=>{clearInterval(timer);window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener('beforeinstallprompt',install);};},[]);
 useEffect(()=>{let previous=window.scrollY;const scroll=()=>{const current=window.scrollY;if(current<80)setMobileNavHidden(false);else if(current>previous+7)setMobileNavHidden(true);else if(current<previous-7)setMobileNavHidden(false);previous=current};window.addEventListener('scroll',scroll,{passive:true});return()=>window.removeEventListener('scroll',scroll)},[]);
 useEffect(()=>{
  setInstallations([]);setLegacy([]);setMovements([]);setAccounts([]);setShifts([]);setAttendance([]);setLoginLogs([]);setWorkSessions([]);setWorkBreaks([]);setTechnicians([]);setQueue([]);setTab('overview');
  if(!user)return;
  let active=true;
  ensureProfile(user).catch(e=>{if(active)setError('Account setup: '+e.message);});
  const unsub=observeProfile(user.uid,p=>{if(active)setProfile(p);},e=>setError(e.message));
  legacyQueueCount().then(n=>{if(active)setOldPending(n);});
  return()=>{active=false;unsub();};
 },[user?.uid]);
 const refresh = useCallback(async()=>{if(user)setQueue(await pending(user.uid));},[user?.uid]);
 const sync = useCallback(async()=>{
  if(!profile||!navigator.onLine)return;
  setSyncing(true);
  try{await syncOperations(profile);setError('');}catch(e:any){setError('Sync needs attention: '+e.message);}finally{setSyncing(false);await refresh();}
 },[profile,refresh]);
 useEffect(()=>{refresh();if(profile&&online)sync();},[profile?.uid,online]);
 useEffect(()=>{
  if(!profile||profile.status==='deactivated')return;
  const uid=isStaff?null:profile.uid;
  const fail=(e:Error)=>setError('Data access: '+e.message);
  const subs=[
   observe('installations',uid,mapInstallation,setInstallations,fail),
   ...(isStaff?[]:[observe('installations',uid,mapInstallation,setLegacy,fail,'tech_id')]),
   observe('inventory_logs',uid,mapMovement,setMovements,fail),
   observe('inventory_accounts',uid,mapAccount,setAccounts,fail),
   observe('shifts',uid,mapShift,setShifts,fail),
   observe('attendance_logs',uid,mapAttendance,setAttendance,fail),
   observe('login_logs',uid,mapAttendance,setLoginLogs,fail),
   observe('work_sessions',uid,mapWorkSession,setWorkSessions,fail),
   observe('work_breaks',uid,mapWorkBreak,setWorkBreaks,fail),
   ...(isStaff?[observe<Technician>('users',null,(id,d)=>({...d,uid:id}),setTechnicians,fail)]:[])
  ];
  if(online&&profile.role==='technician')ensureInventory(profile).catch(fail);
  return()=>subs.forEach(u=>u());
 },[profile?.uid,isStaff,profile?.status]);
 async function save(op:Omit<PendingOperation,'uid'|'captured_at'>) {
  if(!profile)throw new Error('Please sign in.');
  const operation={...op,uid:profile.uid,captured_at:new Date().toISOString()};
  await queueOperation(operation);await refresh();
  if(!navigator.onLine)throw new Error('Connect to the internet to complete this job. The entry is safely queued and can be submitted with Sync now.');
  try{await syncOperations(profile);setError('');}catch(e:any){setError('Sync needs attention: '+e.message);throw e}finally{await refresh()}
 }
 const allInstallations=Array.from(new Map([...installations,...legacy].map(i=>[i.id,i])).values()).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
 const ownInstallations=allInstallations.filter(i=>i.technician_id===user?.uid);
 const ownMoves=movements.filter(m=>m.technician_id===user?.uid).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
 const stock=stockAt(accounts.find(a=>a.technician_id===user?.uid),ownMoves);
 const ownShifts=shifts.filter(s=>s.technician_id===user?.uid).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at));
 const today=dayKey(new Date(now)); const todayShifts=ownShifts.filter(s=>s.date===today);
 const todayWorkSession=workSessions.find(s=>s.technician_id===user?.uid&&s.date===today);
 const completed=todayShifts.filter(s=>attendance.some(a=>a.id===s.id)).length;
 if(!ready)return <div className="loading">Opening your workspace…</div>;
 if(!user)return <LoginScreen/>;
 if(!profile)return <div className="loading"><h2>Loading your account</h2><p>{error||'Connecting to SecureTrack…'}</p><button className="secondary" onClick={()=>window.location.reload()}>Retry</button><button className="text-button" onClick={()=>signOut(auth)}>Sign out</button></div>;
 if(profile.status==='deactivated')return <div className="loading"><h2>Account deactivated</h2><p>Contact your administrator.</p><button className="secondary" onClick={()=>signOut(auth)}>Sign out</button></div>;
 const sessionKey=user.uid+':'+user.metadata.lastSignInTime;
 const signedInName=(profile.displayName||profile.email.split('@')[0]).trim();

 const nav=[{id:'overview',label:'Today',icon:LayoutDashboard},{id:'attendance',label:'My jobs',icon:MapPin},{id:'inventory',label:'Inventory',icon:Package},{id:'installations',label:'Completed',icon:Wrench},{id:'settings',label:'Settings',icon:SettingsIcon}];
 return <div className="app-shell"><aside className="sidebar"><a className="brand-logo" href="#" onClick={e=>{e.preventDefault();setTab(isStaff?'admin':'overview');}}><img src="/securetrack-logo.png" alt="SecureTrack"/></a><div className="workspace-label">OPERATIONS <span>LIVE</span></div><nav>{isStaff?adminNav.map(n=><button key={n.id} className={adminSection===n.id?'active':''} onClick={()=>{setTab('admin');setAdminSection(n.id)}}><n.icon size={19}/>{n.label}{adminSection===n.id&&<span className="nav-dot"/>}</button>):nav.map(n=><button key={n.id} className={tab===n.id?'active':''} onClick={()=>setTab(n.id as Tab)}><n.icon size={19}/>{n.label}{tab===n.id&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="user-block"><div className="avatar">{profile.photoDataUrl?<img src={profile.photoDataUrl} alt=""/>:(profile.displayName||profile.email).slice(0,2).toUpperCase()}</div><div><strong>{profile.displayName||profile.email.split('@')[0]}</strong><small>{roleLabel(profile.role)}</small></div><button aria-label="Sign out" onClick={()=>signOut(auth)}><LogOut size={18}/></button></div></div></aside>
 <div className="main-shell"><header className="topbar"><span>SecureTrack <span className="slash">/</span> <strong>{isStaff?adminNav.find(n=>n.id===adminSection)?.label||'Operations':nav.find(n=>n.id===tab)?.label||nav[0].label}</strong></span><div className="top-actions"><button className="text-button" onClick={()=>signOut(auth)} aria-label="Sign out of account"><LogOut size={16}/></button><span className={'connection '+(online?'':'offline')}>{online?<Wifi size={14}/>:<WifiOff size={14}/>}<span>{online?'Live':'Offline'}</span></span><span className="date-label">{new Date(now).toLocaleDateString('en-GB',{timeZone:TIME_ZONE,day:'numeric',month:'short',year:'numeric'})}</span></div></header>
 <main className="workspace">{!isStaff&&<div className={'mobile-nav '+(mobileNavHidden?'hidden':'')}>{nav.map(n=><button key={n.id} onClick={()=>setTab(n.id as Tab)} className={tab===n.id?'active':''}><n.icon size={17}/><span>{n.label}</span></button>)}</div>}
 {!isStaff && locationSession!==sessionKey && <LoginLocation key={sessionKey} user={user} onComplete={()=>setLocationSession(sessionKey)}/>}
 {error&&<div className="notice error" role="alert">{error}<button onClick={sync} disabled={syncing}>Retry sync</button></div>}
 {oldPending>0&&<div className="notice warning">This browser has {oldPending} unsynced entries from the previous app. They remain preserved. Ask an administrator to reconcile them before using the new stock balances.</div>}
 {queue.length>0&&<div className="notice warning"><RefreshCw size={16}/>{queue.length} entries awaiting cloud confirmation. Stock below shows confirmed entries only.<button disabled={!online||syncing} onClick={sync}>{syncing?'Syncing…':'Sync now'}</button></div>}
 <PwaInstallPrompt canInstallPrompt={!!prompt} onInstall={async()=>{await prompt?.prompt();setPrompt(null);}}/>
 {isStaff?<AdminDashboard section={adminSection} onSectionChange={setAdminSection} loginLogs={loginLogs} workSessions={workSessions} workBreaks={workBreaks} currentUid={user.uid} currentRole={profile.role} technicians={technicians} installations={allInstallations} movements={movements} accounts={accounts} shifts={shifts} attendance={attendance} now={now}/>:<>
 <div className="page-heading"><div><span className="eyebrow">{tab==='overview'?'TODAY AT A GLANCE':'MY FIELD WORKSPACE'}</span><h1>{tab==='overview'?`Good to see you, ${signedInName}`:tab==='inventory'?'Stock on hand':tab==='installations'?'Completed jobs':'My assignments'}<span className="accent">.</span></h1><p>{tab==='overview'?'Here is today’s field plan.':tab==='inventory'?'Issued stock updates automatically as jobs are completed.':tab==='installations'?'A permanent record of completed field work.':'Customer details, directions, arrival and completion in one place.'}</p></div></div>
 {(tab==='overview'||tab==='attendance')&&<WorkdayPanel profile={profile} sessions={workSessions} breaks={workBreaks} now={now} onError={message=>setError(message)}/>}
 {tab==='overview'&&<><div className="metrics"><div className="metric"><div><span>JOBS TODAY</span><Wrench size={19}/></div><strong>{todayWorkSession?todayShifts.length:'—'}</strong><small>{todayWorkSession?`${todayShifts.filter(s=>ownInstallations.some(i=>i.shift_id===s.id||i.id===s.id)).length} completed`:'Clock in to view'}</small></div><div className="metric"><div><span>DEVICES ON HAND</span><Package size={19}/></div><strong>{stock?DEVICE_MODELS.reduce((n,key)=>n+stock[key],0):'—'}</strong><small>{simTotal(stock)??'—'} SIM cards available</small></div><div className="metric"><div><span>SITE ARRIVALS</span><CalendarCheck size={19}/></div><strong>{todayWorkSession?completed:'—'}{todayWorkSession&&<em> / {todayShifts.length}</em>}</strong><small>{todayWorkSession?'Confirmed with GPS':'Clock in to view'}</small></div></div>{todayWorkSession?<AttendancePanel shifts={todayShifts} attendance={attendance} installations={ownInstallations} save={save} now={now}/>:<div className="notice warning">Clock in above to open today’s job list.</div>}<section className="panel"><div className="section-label"><h2>Stock at a glance</h2><button className="text-button" onClick={()=>setTab('inventory')}>View full inventory ↗</button></div><StockGrid stock={stock}/></section></>}
 {tab==='inventory'&&<div className="stack"><section className="panel"><div className="section-label"><h2>Stock on hand</h2><span>Confirmed balance</span></div><StockGrid stock={stock}/>{stock&&Object.values(stock).some(n=>n<0)&&<div className="notice warning">A stock balance is negative. Check missing receipts or incorrect entries with your administrator.</div>}</section><section className="panel"><div className="section-title"><ClipboardList size={20}/><div><h2>Stock history</h2><p>Newest entries first</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Movement</th><th>Device</th><th>Quantity</th><th>SIMs</th><th>Network</th><th>Notes</th></tr></thead><tbody>{ownMoves.slice(0,100).map(m=><tr key={m.id}><td>{displayTime(m.timestamp)}</td><td><span className={'badge '+(m.type==='received'?'good':'')}>{m.type}</span></td><td>{m.device_model||'SIM only'}</td><td>{m.type==='adjustment'?(m.quantity_delta&&m.quantity_delta>0?'+':'')+(m.quantity_delta||0):(m.type==='received'?'+':'−')+m.quantity}</td><td>{m.type==='adjustment'?(m.sim_delta&&m.sim_delta>0?'+':'')+(m.sim_delta||0):(m.type==='received'?'+':'−')+m.sim_count}</td><td>{m.sim_provider||'Legacy / unassigned'}</td><td>{m.notes||'—'}</td></tr>)}</tbody></table>{!ownMoves.length&&<div className="empty">No stock movements yet.</div>}</div>{ownMoves.length>100&&<p className="fine-print">Showing the most recent 100 entries. Admin reports include the full history.</p>}</section></div>}
 {tab==='installations'&&<section className="panel"><div className="section-title"><ClipboardList size={20}/><div><h2>Completed jobs</h2><p>Device and SIM identifiers are stored with each assignment.</p></div></div><div className="table-wrap"><table><thead><tr><th>Completed</th><th>Company</th><th>Job</th><th>Units</th><th>Device</th><th>SIM network</th><th>Identifiers</th></tr></thead><tbody>{ownInstallations.slice(0,100).map(i=><tr key={i.id}><td>{displayTime(i.timestamp)}</td><td>{i.customer_ref}</td><td>{jobLabel(i.job_type||'new_installation')}</td><td>{i.unit_count||1}</td><td>{i.device_model||'—'}</td><td>{i.sim_count?i.sim_provider||'Legacy / unassigned':'—'}</td><td>{[...(i.device_imeis||[]),...(i.sim_numbers||[])].join(' · ')||'Legacy record'}</td></tr>)}</tbody></table>{!ownInstallations.length&&<div className="empty">Completed assignments will appear here.</div>}</div></section>}
 {tab==='attendance'&&(todayWorkSession?<AttendancePanel shifts={ownShifts} attendance={attendance} installations={ownInstallations} save={save} now={now}/>:<div className="notice warning">Clock in above to open your assigned jobs.</div>)}
 {tab==='settings'&&<ProfileSettings profile={profile}/>}
 </>}
 <footer className="workspace-footer"><span>SECURETRACK · FIELD OPERATIONS</span><span>Reporting timezone: {TIME_ZONE}</span></footer>
 </main></div></div>;
}

