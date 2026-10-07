import test from 'node:test';
import assert from 'node:assert/strict';
import { extractIccid, isValidIccid } from '../src/lib/identifiers';
import { validateOperation } from '../src/lib/domain';

test('accepts ICCIDs beginning with 89',()=>{
 assert.equal(isValidIccid('8997112212789413817'),true);
 assert.equal(isValidIccid('89971122127894138170'),true);
});

test('rejects a camera misread with the wrong prefix',()=>{
 assert.equal(isValidIccid('1297112212789415271516'),false);
 assert.equal(extractIccid('1297112212789415271516'),'');
});

test('extracts a valid ICCID from scanner text without guessing',()=>{
 assert.equal(extractIccid('ICCID: 8997112212789413817'),'8997112212789413817');
 assert.equal(extractIccid('prefix-1297112212789415271516-suffix'),'');
});

test('job completion validation blocks a misread ICCID before saving',()=>{
 const completion:any={kind:'job-completed',shift_id:'shift-1',job_type:'sim_change',device_model:'',quantity:0,sim_count:1,sim_provider:'Etisalat',customer_ref:'Customer',sim_numbers:['1297112212789415271516'],completion_latitude:25.2,completion_longitude:55.3,completion_accuracy_m:8};
 assert.throws(()=>validateOperation(completion),/must start with 89/);
 assert.doesNotThrow(()=>validateOperation({...completion,sim_numbers:['8997112212789413817']}));
});
