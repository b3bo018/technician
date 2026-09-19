import { Download, X } from 'lucide-react';
import { useState } from 'react';
export function PwaInstallPrompt({canInstallPrompt,onInstall}:{canInstallPrompt:boolean;onInstall:()=>void}){
 const [dismissed,setDismissed]=useState(false); if(dismissed||!canInstallPrompt)return null;
 return <div className="notice"><Download size={17}/><span>Keep your workspace one tap away.</span><button onClick={onInstall}>Install app</button><button aria-label="Dismiss install prompt" onClick={()=>setDismissed(true)}><X size={15}/></button></div>;
}
