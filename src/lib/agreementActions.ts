import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const safeName=(value:string)=>value.trim().replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'Customer';

export async function copyAgreementLink(link:string){
 try{
  if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(link);return}
  throw new Error('Clipboard API unavailable');
 }catch{
  const input=document.createElement('textarea');input.value=link;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();const copied=document.execCommand('copy');input.remove();if(!copied)throw new Error('Copy was blocked. Open the agreement link and copy it from the address bar.');
 }
}

async function waitForAgreementAssets(source:HTMLElement){
 await document.fonts?.ready;
 await Promise.all([...source.querySelectorAll('img')].map(image=>image.complete?Promise.resolve():new Promise<void>(resolve=>{image.addEventListener('load',()=>resolve(),{once:true});image.addEventListener('error',()=>resolve(),{once:true})})));
}

export async function downloadAgreementPdf(elementId:string,client:string,reference:string){
 try{
  const source=document.getElementById(elementId);if(!source)throw new Error('Agreement document is not ready.');
  await waitForAgreementAssets(source);
  const canvas=await html2canvas(source,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,imageTimeout:15000});
  if(!canvas.width||!canvas.height)throw new Error('The agreement could not be rendered. Please reopen it and try again.');
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const pageWidth=210,pageHeight=297,scale=Math.min(pageWidth/canvas.width,pageHeight/canvas.height);
  const width=canvas.width*scale,height=canvas.height*scale;
  pdf.addImage(canvas.toDataURL('image/jpeg',0.96),'JPEG',(pageWidth-width)/2,(pageHeight-height)/2,width,height,undefined,'FAST');
  pdf.save(`SecureTrack_Agreement_${safeName(client)}_${safeName(reference)}.pdf`);
 }catch(error){alert(error instanceof Error?error.message:'Unable to download the agreement PDF.');}
}
