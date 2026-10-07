self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{}}catch{payload={body:event.data?.text()||''}}
 const title=String(payload.title||'SecureTrack update').slice(0,120);
 const options={body:String(payload.body||'Open SecureTrack to view the update.').slice(0,500),tag:String(payload.id||'securetrack-update'),icon:'/icon-192.png',badge:'/icon-192.png',data:{url:typeof payload.url==='string'&&payload.url.startsWith('/')&&!payload.url.startsWith('//')?payload.url:'/'},renotify:false};
 event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=event.notification.data?.url||'/';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{for(const client of windows){if('focus'in client){if('navigate'in client&&client.url!==new URL(target,self.location.origin).href)await client.navigate(target);return client.focus()}}return clients.openWindow?clients.openWindow(target):undefined}))});
