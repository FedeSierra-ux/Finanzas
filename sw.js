// NOTE: version suffix must match APP_VERSION in index.html
const CACHE='finanzas-v30.4';
const SHELL=['/Finanzas/','/Finanzas/index.html'];
const FONTS_CACHE='finanzas-fonts-v1';

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(k=>k!==CACHE&&k!==FONTS_CACHE).map(k=>caches.delete(k))
      ))
      .then(()=>self.clients.claim())
      .then(()=>self.clients.matchAll({type:'window'}))
      .then(clients=>clients.forEach(c=>c.postMessage({type:'SW_UPDATED',version:'v30.1'})))
      .then(()=>fireDueNotifs())   // fire any overdue notifications on SW startup
  );
});

self.addEventListener('message',e=>{
  if(e.data?.type==='SKIP_WAITING'){self.skipWaiting();return;}
  if(e.data?.type==='SYNC_NOTIF_QUEUE'){
    e.waitUntil(saveNotifQueue(e.data.items||[]));
  }
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);

  // Google Fonts: cache-first (immutable assets)
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(
      caches.open(FONTS_CACHE).then(cache=>
        cache.match(e.request).then(hit=>{
          if(hit) return hit;
          return fetch(e.request).then(r=>{
            if(r.ok) cache.put(e.request,r.clone());
            return r;
          });
        })
      )
    );
    return;
  }

  // App shell: network-first with cache fallback
  if(url.pathname==='/Finanzas/'||url.pathname==='/Finanzas/index.html'){
    e.respondWith(
      fetch(e.request).then(r=>{
        if(r.ok){const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));}
        return r;
      }).catch(()=>caches.match('/Finanzas/'))
    );
    return;
  }

  // Other same-origin assets: network-first with cache fallback
  if(url.origin===self.location.origin&&url.pathname.startsWith('/Finanzas/')){
    e.respondWith(
      fetch(e.request).then(r=>{
        if(r.ok){const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));}
        return r;
      }).catch(()=>caches.match(e.request))
    );
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

// Periodic Background Sync — fires when browser grants time (Chrome Android)
self.addEventListener('periodicsync',e=>{
  if(e.tag==='fin-notifs') e.waitUntil(fireDueNotifs());
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(cs=>{
    if(cs.length) return cs[0].focus();
    return clients.openWindow(e.notification.data?.url||'/Finanzas/');
  }));
});

// ── IDB helpers ─────────────────────────────────────────────────────────────

function openNotifDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('fin_notifs_v1',1);
    req.onupgradeneeded=ev=>{
      const db=ev.target.result;
      if(!db.objectStoreNames.contains('queue'))
        db.createObjectStore('queue',{keyPath:'tag'});
    };
    req.onsuccess=ev=>resolve(ev.target.result);
    req.onerror=()=>reject(req.error);
  });
}

async function saveNotifQueue(items){
  try{
    const db=await openNotifDB();
    const tx=db.transaction('queue','readwrite');
    const store=tx.objectStore('queue');
    store.clear();
    items.forEach(item=>store.put(item));
  }catch(e){/* ignore */}
}

async function fireDueNotifs(){
  try{
    const db=await openNotifDB();
    const tx=db.transaction('queue','readwrite');
    const store=tx.objectStore('queue');
    const all=await new Promise((res,rej)=>{
      const req=store.getAll();
      req.onsuccess=()=>res(req.result);
      req.onerror=()=>rej(req.error);
    });
    const now=Date.now();
    for(const notif of all){
      if(notif.fireAt<=now){
        await self.registration.showNotification(notif.title,{
          body:notif.body,
          tag:notif.tag,
          icon:'/Finanzas/icon.png',
          data:{url:'/Finanzas/'},
          vibrate:[100,50,100]
        });
        store.delete(notif.tag);
      }
    }
  }catch(e){/* ignore */}
}
