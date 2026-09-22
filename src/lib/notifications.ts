import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type NotificationState='granted'|'denied'|'default'|'unsupported';
const native=()=>Capacitor.isNativePlatform();
const notificationId=(tag:string)=>{let hash=0;for(const char of tag)hash=((hash<<5)-hash)+char.charCodeAt(0)|0;return Math.abs(hash)||1}

export function notificationState():NotificationState{return native()?'default':typeof Notification==='undefined'?'unsupported':Notification.permission}
export async function requestNotifications():Promise<NotificationState>{
 if(native()){const result=await LocalNotifications.requestPermissions();return result.display==='granted'?'granted':result.display==='denied'?'denied':'default'}
 if(typeof Notification==='undefined')return'unsupported';return await Notification.requestPermission()
}

export async function sendAppNotification(title:string,body:string,tag:string){
 if(native()){const permission=await LocalNotifications.checkPermissions();if(permission.display!=='granted')return false;await LocalNotifications.schedule({notifications:[{id:notificationId(tag),title,body,schedule:{at:new Date(Date.now()+500)}}]});return true}
 if(notificationState()!=='granted')return false;
 const options:NotificationOptions={body,tag,icon:'/icon-192.png',badge:'/icon-192.png',data:{url:'/'}};
 try{if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.ready;await registration.showNotification(title,options);return true}new Notification(title,options);return true}catch{return false}
}

export async function scheduleJobReminder(title:string,body:string,tag:string,when:string){
 if(!native())return false;
 const at=new Date(Date.parse(when)-15*60*1000);
 if(!Number.isFinite(at.getTime())||at.getTime()<=Date.now())return false;
 const permission=await LocalNotifications.checkPermissions();
 if(permission.display!=='granted')return false;
 await LocalNotifications.schedule({notifications:[{id:notificationId(`reminder:${tag}`),title,body,schedule:{at}}]});
 return true;
}

export function notificationSeen(uid:string,key:string){return localStorage.getItem(`securetrack:notification:${uid}:${key}`)==='1'}
export function rememberNotification(uid:string,key:string){localStorage.setItem(`securetrack:notification:${uid}:${key}`,'1')}
