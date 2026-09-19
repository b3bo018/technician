import test from 'node:test';
import assert from 'node:assert/strict';
import {captureLocation} from '../src/lib/location';
function setup(fn:any){Object.defineProperty(globalThis,'window',{value:{isSecureContext:true},configurable:true});Object.defineProperty(globalThis,'navigator',{value:{geolocation:{getCurrentPosition:fn}},configurable:true});}
test('GPS retries with high accuracy after a cached-position failure',async()=>{
 const modes:boolean[]=[];setup((ok:any,fail:any,options:any)=>{modes.push(options.enableHighAccuracy);if(!options.enableHighAccuracy)fail({code:3});else ok({coords:{latitude:25,longitude:55,accuracy:12}});});
 assert.deepEqual(await captureLocation(),{latitude:25,longitude:55,accuracy_m:12});assert.deepEqual(modes,[false,true]);
});
test('permission denial does not trigger repeated location requests',async()=>{
 let calls=0;setup((ok:any,fail:any)=>{calls++;fail({code:1});});await assert.rejects(captureLocation(),/permission is blocked/);assert.equal(calls,1);
});
test('unavailable location rejects without inventing coordinates',async()=>{
 setup((ok:any,fail:any)=>fail({code:2}));await assert.rejects(captureLocation(),/could not determine/);
});
