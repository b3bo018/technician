import type { AdminSection } from '../components/AdminDashboard';
import type { Shift, Stock, StockAlertSettings } from '../types';

export type NavigationFilters={date?:string;jobStatus?:'all'|'scheduled'|'completed'|'pending'|'carried';workType?:'installation'|'removal';certificateLife?:'Expired'|'Expiring Soon';recordId?:string;search?:string;stockKind?:'gps'|'sim';lowStock?:boolean};
export type NavigateAdmin=(section:AdminSection,filters?:NavigationFilters)=>void;
export function dashboardTarget(label:string,date:string):{section:AdminSection;filters:NavigationFilters}{
 const targets:Record<string,{section:AdminSection;filters:NavigationFilters}>={
  'Jobs scheduled today':{section:'jobs',filters:{date,jobStatus:'scheduled'}},
  'Jobs completed today':{section:'jobs',filters:{date,jobStatus:'completed'}},
  'Jobs pending today':{section:'jobs',filters:{date,jobStatus:'pending'}},
  'Jobs carried forward':{section:'jobs',filters:{date,jobStatus:'carried'}},
  'Installations today':{section:'completed',filters:{date,workType:'installation'}},
  'Removals today':{section:'completed',filters:{date,workType:'removal'}},
  'Vehicles / assets':{section:'vehicle-search',filters:{search:''}},
  'Available GPS stock':{section:'inventory',filters:{stockKind:'gps'}},
  'Available SIM stock':{section:'inventory',filters:{stockKind:'sim'}},
  'Technicians working':{section:'workforce',filters:{date}},
 };
 return targets[label]||{section:'dashboard',filters:{}};
}
export function matchesJobStatus(job:Shift,status:NavigationFilters['jobStatus']){
 const completed=job.status==='completed'||(job.completed_units||0)>=job.unit_count;
 if(!status||status==='all')return true;
 if(job.is_deleted||['draft','cancelled'].includes(job.status||''))return false;
 return status==='scheduled'?!completed:status==='completed'?completed:status==='carried'?!!job.carried_forward&&!completed:!completed;
}
export function stockMatches(key:string,value:number,filters:NavigationFilters,settings:StockAlertSettings){
 const sim=key.startsWith('SIM');
 return (!filters.stockKind||(filters.stockKind==='sim'?sim:!sim))&&(!filters.lowStock||value<=(sim?settings.sim_minimums?.[key]??settings.threshold:settings.device_minimums?.[key]??settings.threshold));
}
