function clearBackground(canvas:HTMLCanvasElement){
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return;
 const image=context.getImageData(0,0,canvas.width,canvas.height),pixels=image.data,border:number[]=[];
 const step=Math.max(1,Math.floor(Math.min(canvas.width,canvas.height)/80));
 for(let x=0;x<canvas.width;x+=step){border.push(x*4,((canvas.height-1)*canvas.width+x)*4)}
 for(let y=0;y<canvas.height;y+=step){border.push((y*canvas.width)*4,(y*canvas.width+canvas.width-1)*4)}
 let black=0,white=0,opaque=0;
 for(const index of border){const r=pixels[index],g=pixels[index+1],b=pixels[index+2],a=pixels[index+3],spread=Math.max(r,g,b)-Math.min(r,g,b);if(a<180)continue;opaque++;if(Math.max(r,g,b)<85&&spread<35)black++;if(Math.min(r,g,b)>215&&spread<35)white++}
 const background=opaque&&black/opaque>.45?'black':opaque&&white/opaque>.45?'white':'transparent';
 if(background==='transparent')return;
 for(let index=0;index<pixels.length;index+=4){const r=pixels[index],g=pixels[index+1],b=pixels[index+2],spread=Math.max(r,g,b)-Math.min(r,g,b);const matches=background==='black'?Math.max(r,g,b)<105&&spread<38:Math.min(r,g,b)>205&&spread<38;if(matches)pixels[index+3]=0}
 context.putImageData(image,0,0);
}

function loadImage(source:string){
 return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The signature image could not be opened.'));image.src=source});
}

export async function normalizeSignatureSource(source:string){
 const image=await loadImage(source),scale=Math.min(1,700/image.width,240/image.height),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);clearBackground(canvas);
 return canvas.toDataURL('image/png');
}

export async function signatureImage(file:File){
 if(!file.type.startsWith('image/'))throw new Error('Choose an image file for the authorized signature.');
 const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('The signature image could not be read.'));reader.readAsDataURL(file)});
 let data=await normalizeSignatureSource(source);
 if(data.length>300000){const image=await loadImage(data),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d')!;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0);data=canvas.toDataURL('image/jpeg',.78)}
 if(data.length>400000)throw new Error('The signature image is still too large. Use a cropped signature image.');
 return data;
}
