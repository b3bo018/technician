export type NotificationState='granted'|'denied'|'default'|'unsupported';

export function notificationState():NotificationState{return typeof Notification==='undefined'?'unsupported':Notification.permission}
export async function requestNotifications():Promise<NotificationState>{if(typeof Notification==='undefined')return'unsupported';return await Notification.requestPermission()}

export async function sendAppNotification(title:string,body:string,tag:string){
 if(notificationState()!=='granted')return false;
 const options:NotificationOptions={body,tag,icon:'/icon-192.png',badge:'/icon-192.png',data:{url:'/'}};
 try{if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.ready;await registration.showNotification(title,options);return true}new Notification(title,options);return true}catch{return false}
}

export function notificationSeen(uid:string,key:string){return localStorage.getItem(`securetrack:notification:${uid}:${key}`)==='1'}
export function rememberNotification(uid:string,key:string){localStorage.setItem(`securetrack:notification:${uid}:${key}`,'1')}
