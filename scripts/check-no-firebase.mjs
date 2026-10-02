import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const roots=['src'];const forbidden=[/from ['"]firebase\//,/from ['"].*lib\/firebase['"]/,/firebaseConfig/];
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else if(/\.(ts|tsx|js|jsx)$/.test(e.name))out.push(p)}return out}
const files=(await Promise.all(roots.map(walk))).flat();const hits=[];for(const file of files){const body=await readFile(file,'utf8');if(forbidden.some(r=>r.test(body)))hits.push(file)}
if(hits.length){console.error('Firebase runtime references remain:\n'+hits.join('\n'));process.exit(1)}console.log('No Firebase runtime imports found.');
