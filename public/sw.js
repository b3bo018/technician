self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).map(name=>caches.delete(name)));
  await self.clients.claim();
  await self.registration.unregister();
  const windows=await self.clients.matchAll({type:'window'});
  await Promise.all(windows.map(client=>client.navigate(client.url)));
})()));
self.addEventListener('fetch',event=>event.respondWith(fetch(event.request,{cache:'no-store'})));
