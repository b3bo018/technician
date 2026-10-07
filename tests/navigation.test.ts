import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardTarget,matchesJobStatus,stockMatches} from '../src/lib/navigation';

test('dashboard links carry exact date, category and stock scope',()=>{
 const date='2026-10-02';
 assert.deepEqual(dashboardTarget('Jobs scheduled today',date),{section:'jobs',filters:{date,jobStatus:'scheduled'}});
 assert.equal(dashboardTarget('Jobs completed today',date).filters.jobStatus,'completed');
 assert.equal(dashboardTarget('Jobs pending today',date).filters.jobStatus,'pending');
 assert.equal(dashboardTarget('Jobs carried forward',date).filters.jobStatus,'carried');
 assert.deepEqual(dashboardTarget('Installations today',date),{section:'completed',filters:{date,workType:'installation'}});
 assert.equal(dashboardTarget('Removals today',date).filters.workType,'removal');
 assert.equal(dashboardTarget('Available GPS stock',date).filters.stockKind,'gps');
 assert.equal(dashboardTarget('Available SIM stock',date).filters.stockKind,'sim');
 assert.equal(dashboardTarget('Technicians working',date).filters.date,date);
});
test('job drill-down excludes drafts and completed jobs from pending counts',()=>{
 const job:any={status:'assigned',unit_count:6,completed_units:2,carried_forward:true};
 assert.equal(matchesJobStatus(job,'pending'),true);
 assert.equal(matchesJobStatus(job,'scheduled'),true);
 assert.equal(matchesJobStatus(job,'carried'),true);
 assert.equal(matchesJobStatus({...job,status:'draft'},'scheduled'),false);
 assert.equal(matchesJobStatus({...job,status:'cancelled'},'pending'),false);
 assert.equal(matchesJobStatus({...job,completed_units:6},'completed'),true);
 assert.equal(matchesJobStatus({...job,completed_units:6},'scheduled'),false);
 assert.equal(matchesJobStatus({...job,completed_units:6},'pending'),false);
});
test('low-stock navigation uses separate configured GPS and SIM thresholds',()=>{
 const settings:any={threshold:2,device_minimums:{FMC920:5},sim_minimums:{'SIM du':10}};
 assert.equal(stockMatches('FMC920',4,{stockKind:'gps',lowStock:true},settings),true);
 assert.equal(stockMatches('SIM du',4,{stockKind:'gps',lowStock:true},settings),false);
 assert.equal(stockMatches('SIM du',9,{stockKind:'sim',lowStock:true},settings),true);
 assert.equal(stockMatches('SIM du',11,{stockKind:'sim',lowStock:true},settings),false);
});
