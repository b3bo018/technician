import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { pushApi } from './cloud/auth';

export type NotificationState='granted'|'denied'|'default'|'unsupported';
const native=()=>Capacitor.isNativePlatform();
const UnifiedPush=registerPlugin<{register(options:{publicKey:string;apiBase:string;token:string}):Promise<void>;unregister():Promise<void>}>('UnifiedPush');
const notificationId=(tag:string)=>{let hash=0;for(const char of tag)hash=((hash<<5)-hash)+char.charCodeAt(0)|0;return Math.abs(hash)||1}

export function notificationsMuted(){return localStorage.getItem('securetrack:notifications-muted')==='1'}
export function setNotificationsMuted(value:boolean){localStorage.setItem('securetrack:notifications-muted',value?'1':'0')}
export function remotePushRegistered(uid:string){return localStorage.getItem(`securetrack:push:${uid}`)==='1'}
function applicationServerKey(value:string){const padded=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');return Uint8Array.from(atob(padded),char=>char.charCodeAt(0))}
export async function enableWebPush(uid:string){
 if(native()||!('serviceWorker'in navigator)||!('PushManager'in window))return false;
 const {publicKey}=await pushApi.getConfig();if(!publicKey)throw new Error('AWS push is not configured.');
 const registration=await navigator.serviceWorker.register('/notification-sw.js',{scope:'/'});await navigator.serviceWorker.ready;
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationServerKey(publicKey)});
 await pushApi.register(subscription.toJSON(),'web');localStorage.setItem(`securetrack:push:${uid}`,'1');localStorage.setItem('securetrack:push:enabled','1');return true;
}
export async function enableAndroidPush(uid:string){
 if(!native())return false;
 const [{publicKey},token]=await Promise.all([pushApi.getConfig(),pushApi.getSessionToken()]);
 if(!token)throw new Error('Sign in again before enabling Android push.');
 const apiBase=pushApi.apiBase||'https://connect.securetrackgo.com';
 await UnifiedPush.register({publicKey,apiBase,token});
 localStorage.setItem(`securetrack:push:${uid}`,'1');localStorage.setItem('securetrack:push:enabled','1');return true;
}
export async function disableWebPush(uid:string){
 if(native()){await UnifiedPush.unregister();localStorage.removeItem(`securetrack:push:${uid}`);localStorage.removeItem('securetrack:push:enabled');return}
 if(!('serviceWorker'in navigator))return;
 const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();
 if(subscription){await pushApi.remove(subscription.endpoint);await subscription.unsubscribe()}
 localStorage.removeItem(`securetrack:push:${uid}`);localStorage.removeItem('securetrack:push:enabled');
}
export function notificationState():NotificationState{return native()?'default':typeof Notification==='undefined'?'unsupported':Notification.permission}
export async function readNotificationState():Promise<NotificationState>{
 if(native()){const result=await LocalNotifications.checkPermissions();return result.display==='granted'?'granted':result.display==='denied'?'denied':'default'}
 return notificationState()
}
export async function requestNotifications():Promise<NotificationState>{
 if(native()){const result=await LocalNotifications.requestPermissions();return result.display==='granted'?'granted':result.display==='denied'?'denied':'default'}
 if(typeof Notification==='undefined')return'unsupported';return await Notification.requestPermission()
}

export async function sendAppNotification(title:string,body:string,tag:string){if(notificationsMuted())return false;
 if(localStorage.getItem('securetrack:push:enabled')==='1')return true;
 if(native()){const permission=await LocalNotifications.checkPermissions();if(permission.display!=='granted')return false;await LocalNotifications.schedule({notifications:[{id:notificationId(tag),title,body,schedule:{at:new Date(Date.now()+500)}}]});return true}
 if(notificationState()!=='granted')return false;
 const options:NotificationOptions={body,tag,icon:'/icon-192.png',badge:'/icon-192.png',data:{url:'/'}};
 try{if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.getRegistration('/');if(registration){await registration.showNotification(title,options);return true}}new Notification(title,options);return true}catch{return false}
}

export async function scheduleJobReminder(title:string,body:string,tag:string,when:string){if(notificationsMuted())return false;
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
