import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryUnitCount, jobTypeUnitCount, shiftMatchesServiceCategory } from '../src/lib/reporting';

const shift=(type:string,unitJobs?:any[])=>({job_type:type,unit_count:unitJobs?.length||1,unit_jobs:unitJobs} as any);

test('service report groups inspection and device or SIM changes as complaints',()=>{
 const rows=[shift('new_installation'),shift('inspection'),shift('mixed',[{job_type:'device_change'},{job_type:'sim_change'},{job_type:'sim_device_change'}]),shift('device_removal')];
 assert.equal(categoryUnitCount(rows,'new_installation'),1);
 assert.equal(categoryUnitCount(rows,'complaints'),4);
 assert.equal(categoryUnitCount(rows,'removals'),1);
 assert.equal(jobTypeUnitCount(rows,'sim_change'),1);
 assert.equal(shiftMatchesServiceCategory(rows[2],'complaints'),true);
 assert.equal(shiftMatchesServiceCategory(rows[2],'new_installation'),false);
});

test('legacy multi-unit jobs count every vehicle',()=>{
 assert.equal(categoryUnitCount([shift('new_installation') as any,{...shift('new_installation'),unit_count:6}],'new_installation'),7);
});
