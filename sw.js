const CACHE='finanzas-27.28';
const SHELL=['/Finanzas/'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )));
  self.clients.claim();
  self.clients.matchAll({type:'window'}).then(clients=>{
    clients.forEach(c=>c.postMessage({type:'SW_UPDATED',version:'v26.12'}));
  });
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.pathname==='/Finanzas/'||url.pathname==='/Finanzas/index.html'){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
  }
});

self.addEventListener('push',e=>{
  if(!e.data) return;
  const d=e.data.json();
  e.waitUntil(self.registration.showNotification(d.title||'Mis Finanzas',{
    body:d.body||'',
    icon:d.icon||'/Finanzas/icon.png',
    tag:d.tag||'fin',
    data:{url:d.url||'/Finanzas/'},
    vibrate:[100,50,100]
  }));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(cs=>{
    if(cs.length) return cs[0].focus();
    return clients.openWindow(e.notification.data?.url||'/Finanzas/');
  }));
});
