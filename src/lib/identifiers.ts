export function normalizeIdentifier(value:string){
 return value.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
}

export function isValidIccid(value:string){
 return /^89\d{16,20}$/.test(value);
}

export function extractIccid(raw:string){
 const candidates=raw.match(/\d{18,22}/g)||[];
 return candidates.find(isValidIccid)||'';
}
