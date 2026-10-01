import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const safeFileName=(name:string)=>name.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()||'SecureTrack-file';

function blobBase64(blob:Blob){
 return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(reader.error||new Error('Unable to prepare the file.'));reader.readAsDataURL(blob)});
}

export async function saveDownload(blob:Blob,fileName:string,title='SecureTrack file'){
 const name=safeFileName(fileName);
 if(Capacitor.isNativePlatform()){
  const data=await blobBase64(blob);
  let result;
  try{
   result=await Filesystem.writeFile({path:`SecureTrack/${name}`,data,directory:Directory.Documents,recursive:true});
  }catch{
   result=await Filesystem.writeFile({path:name,data,directory:Directory.Cache,recursive:true});
  }
  await Share.share({title,text:`${name} is ready. Choose where to save or share it.`,files:[result.uri],dialogTitle:'Save or share file'});
  return result.uri;
 }
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);return url;
}
