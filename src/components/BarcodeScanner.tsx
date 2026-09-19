import { useEffect, useRef, useState } from 'react';
import { BarcodeDetector as ZXingBarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill';
import { Camera, CameraOff, RefreshCw, ScanLine, X } from 'lucide-react';

export async function requestRearCamera(){
 const attempts:MediaStreamConstraints[]=[
  {audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}},
  {audio:false,video:{facingMode:{ideal:'environment'}}},
  {audio:false,video:true},
 ];
 let lastError:unknown;
 for(const constraints of attempts){try{return await navigator.mediaDevices.getUserMedia(constraints)}catch(error:any){lastError=error;if(error?.name==='NotAllowedError'||error?.name==='SecurityError')throw error}}
 throw lastError;
}

export function BarcodeScanner({label,onScan,onClose,cameraRequest}:{label:string;onScan:(value:string)=>void;onClose:()=>void;cameraRequest:Promise<MediaStream>}){
 const video=useRef<HTMLVideoElement>(null);const canvas=useRef<HTMLCanvasElement>(null);const stream=useRef<MediaStream|null>(null);const detector=useRef<{detect:(source:ImageBitmapSource)=>Promise<Array<{rawValue:string}>>}|null>(null);
 const scanTimer=useRef(0);const stopped=useRef(false);const completed=useRef(false);const detecting=useRef(false);
 const [message,setMessage]=useState('Loading the scanner engine…');const [starting,setStarting]=useState(true);const [failed,setFailed]=useState(false);const [frames,setFrames]=useState(0);
 const expectsSim=/sim/i.test(label);

 function expectedValue(raw:string){
  const candidates=raw.match(/\d{14,22}/g)?.sort((a,b)=>b.length-a.length)||[];
  const value=candidates[0]||raw.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  return expectsSim?/^\d{18,22}$/.test(value)?value:'':/^\d{14,17}$/.test(value)?value:'';
 }
 function stop(){
  stopped.current=true;
  if(scanTimer.current)window.clearTimeout(scanTimer.current);scanTimer.current=0;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  if(video.current){video.current.pause();video.current.srcObject=null}
 }
 function success(raw:string){
  if(completed.current||stopped.current)return;const value=expectedValue(raw);
  if(!value){setMessage(expectsSim?'A code was found, but it is not an 18–22 digit SIM number. Keep scanning.':'A code was found, but it is not a 14–17 digit IMEI. Keep scanning.');return}
  completed.current=true;navigator.vibrate?.(90);setMessage('Code detected. Adding it to the job…');stop();onScan(value);
 }
 async function detectLoop(){
  if(stopped.current||completed.current)return;const source=video.current;const target=canvas.current;const engine=detector.current;
  if(source&&target&&engine&&source.readyState>=2&&source.videoWidth&&source.videoHeight&&!detecting.current){detecting.current=true;try{
   const sx=0;const sw=source.videoWidth;const sy=expectsSim?Math.round(source.videoHeight*.2):0;const sh=expectsSim?Math.round(source.videoHeight*.6):source.videoHeight;const scale=Math.min(1,960/sw);const width=Math.round(sw*scale);const height=Math.round(sh*scale);
   if(target.width!==width||target.height!==height){target.width=width;target.height=height}target.getContext('2d',{alpha:false})?.drawImage(source,sx,sy,sw,sh,0,0,width,height);
   const results=await engine.detect(target);setFrames(count=>count+1);for(const result of results){const value=expectedValue(result.rawValue);if(value){success(value);return}}if(results.length)setMessage(expectsSim?'A different code was found. Center the long SIM barcode inside the frame.':'A different code was found. Center the device QR code inside the frame.');
  }catch{if(!stopped.current)setMessage('Scanner is active but could not read this frame. Hold the code steady and move closer.')}finally{detecting.current=false}}
  if(!stopped.current&&!completed.current)scanTimer.current=window.setTimeout(()=>{void detectLoop()},320);
 }
 async function createDetector(){
  const formats=expectsSim?['code_128','code_39','code_93','itf']:['qr_code'];
  const NativeDetector=(globalThis as any).BarcodeDetector;
  if(NativeDetector){try{
   const supported:string[]=await NativeDetector.getSupportedFormats?.()||[];
   if(formats.some(format=>supported.includes(format)))return new NativeDetector({formats:formats.filter(format=>supported.includes(format))});
  }catch{/* Use the bundled cross-browser engine below. */}}
  await prepareZXingModule({overrides:{locateFile:(path:string)=>path.endsWith('.wasm')?'/assets/zxing_reader.wasm':path},fireImmediately:true});
  return new ZXingBarcodeDetector({formats:formats as any});
 }
 async function start(request:Promise<MediaStream>){
  stop();stopped.current=false;completed.current=false;detecting.current=false;setFrames(0);setStarting(true);setFailed(false);setMessage('Loading the scanner engine…');
  try{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');
   setMessage('Opening the main rear camera…');
   const media=await request;
   if(stopped.current){media.getTracks().forEach(track=>track.stop());return}stream.current=media;
   const track=media.getVideoTracks()[0];const capabilities=track.getCapabilities?.() as any;if(capabilities?.focusMode?.includes?.('continuous'))await track.applyConstraints({advanced:[{focusMode:'continuous'}] as any}).catch(()=>{});
   const element=video.current;if(!element)throw new Error('camera unavailable');element.srcObject=media;element.muted=true;element.setAttribute('playsinline','true');await element.play();
   setStarting(false);setMessage('Camera ready. Starting automatic scanner…');
   detector.current=await createDetector();if(stopped.current)return;
   setMessage(expectsSim?'Scanner ready. Fill the frame with the long SIM barcode.':'Scanner ready. Fill the frame with the device QR code.');void detectLoop();
  }catch(error:any){stop();setStarting(false);setFailed(true);const denied=error?.name==='NotAllowedError'||error?.name==='SecurityError'||/permission|denied|notallowed/i.test(String(error));setMessage(denied?'Camera permission is blocked. Allow Camera for SecureTrack in Chrome settings, then tap Retry.':error?.message==='unsupported'?'Embedded camera access is unavailable. Open SecureTrack in Chrome or the installed PWA.':error?.name==='NotReadableError'?'The camera is busy. Close other camera apps, then tap Retry.':'The camera or scanner could not start on this phone. Tap Retry, or enter the number manually.');}
 }
 useEffect(()=>{void start(cameraRequest);return stop},[]);

 return <div className="scanner-backdrop" role="dialog" aria-modal="true" aria-label={'Scan '+label}><div className="scanner-sheet glass-card"><button className="scanner-close" onClick={()=>{stop();onClose()}} aria-label="Close scanner"><X/></button><div className="scanner-title"><ScanLine/><div><strong>Scan {label}</strong><span>Main rear camera · automatic scanning</span></div></div><div className="scanner-viewfinder"><video ref={video} className="scanner-video" autoPlay muted playsInline/><canvas ref={canvas} className="scanner-capture" aria-hidden="true"/><div className="scan-window"><i/><i/><i/><i/></div>{starting&&<div className="camera-loading"><RefreshCw/><strong>{message}</strong></div>}</div><p className={failed?'scan-error':''}>{message}</p>{failed?<CameraOff size={20}/>:<Camera size={20}/>}<div className="scanner-actions">{failed&&<button className="primary" onClick={()=>{void start(requestRearCamera())}}><RefreshCw/>Retry scanner</button>}<button className="secondary" onClick={()=>{stop();onClose()}}>Enter manually</button></div><small className="scanner-version">ZXING SCANNER ACTIVE · {frames} FRAMES CHECKED</small></div></div>;
}
