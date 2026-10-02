import { api } from './api';
export async function confirmJobArrival(uid:string,jobId:string,coords:{latitude:number;longitude:number;accuracy_m:number}){
 if(!uid)throw new Error('Sign in before confirming arrival.');
 if(![coords.latitude,coords.longitude,coords.accuracy_m].every(Number.isFinite)||Math.abs(coords.latitude)>90||Math.abs(coords.longitude)>180||coords.accuracy_m<0)throw new Error('A valid location is required. Allow location access and try again.');
 return api.post<void>(`/jobs/${encodeURIComponent(jobId)}/arrival`,{...coords});
}
