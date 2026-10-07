function readAsDataUrl(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('Unable to read the signature image.'));reader.readAsDataURL(blob)})}

export async function signatureImage(file:File):Promise<string>{
 if(!file.type.startsWith('image/'))throw new Error('Choose an image file for the authorized signature.');
 if(file.size>5*1024*1024)throw new Error('The signature image must be 5 MB or smaller.');
 return readAsDataUrl(file);
}

export async function normalizeSignatureSource(source:string):Promise<string>{
 if(!source||source.startsWith('data:image/'))return source;
 const response=await fetch(source,{credentials:'same-origin'});
 if(!response.ok)throw new Error('Unable to load the authorized signature image.');
 const blob=await response.blob();
 if(!blob.type.startsWith('image/'))throw new Error('The authorized signature is not an image.');
 return readAsDataUrl(blob);
}
