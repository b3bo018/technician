export type ApiUser={uid:string;email:string;displayName:string;role:string;status:string;photoDataUrl?:string};
const API=(import.meta.env.VITE_API_BASE_URL||'/api').replace(/\/$/,'');
let token:string|null=localStorage.getItem('securetrack:access-token');
export function setAccessToken(value:string|null){token=value;if(value)localStorage.setItem('securetrack:access-token',value);else localStorage.removeItem('securetrack:access-token')}
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers);headers.set('Content-Type','application/json');if(token)headers.set('Authorization',`Bearer ${token}`);
 const response=await fetch(API+path,{...init,headers});if(response.status===401)setAccessToken(null);
 const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.message||`Request failed (${response.status})`);return body as T;
}
export const api={
 login:(email:string,password:string)=>request<{accessToken:string;user:ApiUser}>('/auth/login',{method:'POST',body:JSON.stringify({email,password})}),
 logout:()=>request<void>('/auth/logout',{method:'POST'}).finally(()=>setAccessToken(null)),
 me:()=>request<ApiUser>('/auth/me'),
 list:<T>(resource:string,params:Record<string,string|undefined>={})=>{const q=new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined) as [string,string][]);return request<T[]>(`/${resource}${q.size?'?'+q:''}`)},
 get:<T>(resource:string,id:string)=>request<T>(`/${resource}/${encodeURIComponent(id)}`),
 post:<T>(path:string,data:unknown)=>request<T>(path,{method:'POST',body:JSON.stringify(data)}),
 put:<T>(path:string,data:unknown)=>request<T>(path,{method:'PUT',body:JSON.stringify(data)}),
 patch:<T>(path:string,data:unknown)=>request<T>(path,{method:'PATCH',body:JSON.stringify(data)}),
 delete:<T>(path:string,data?:unknown)=>request<T>(path,{method:'DELETE',body:data===undefined?undefined:JSON.stringify(data)})
};
