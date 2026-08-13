// Versión tomada del query string con el que index.html registra este worker
// (?v=APP_VERSION) — una sola fuente de verdad, no hay que sincronizar a mano.
const _swVersion=new URL(self.location.href).searchParams.get('v')||'0';
const CACHE='finanzas-v'+_swVersion;
const SHELL=['/Finanzas/','/Finanzas/index.html'];
const FONTS_CACHE='finanzas-fonts-v1';
// Assets que no cambian con la versión de la app: hoy solo logos.js (~19kb de
// logos de bancos y servicios). Vive fuera de CACHE a propósito — CACHE lleva
// el número de versión y se borra entero en cada actualización, así que tener
// los logos ahí significaba volver a bajarlos cada vez. Su clave de caché es
// la URL con el ?v=, o sea que cambiar un logo es subir ese número en
// index.html; este nombre solo hace falta tocarlo para tirar todo abajo.
const ASSETS_CACHE='finanzas-assets-v1';

// Debe coincidir con el ?v= del <script src="logos.js"> en index.html: es la
// clave de caché, y precargarlo con otro valor deja la entrada al lado de la
// que después se pide, sin servir para nada.
const LOGOS_URL='/Finanzas/logos.js?v=1';

self.addEventListener('install',e=>{
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c=>c.addAll(SHELL)),
    // Los logos van a su propia caché ya en la instalación: si no, la primera
    // carga sin red después de instalar los pierde (todavía no se pidieron
    // nunca con el worker al mando). Si falla, no se aborta la instalación —
    // se bajan solos la próxima vez que haya red.
    caches.open(ASSETS_CACHE).then(c=>c.add(LOGOS_URL)).catch(()=>{}),
  ]));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(k=>k!==CACHE&&k!==FONTS_CACHE&&k!==ASSETS_CACHE).map(k=>caches.delete(k))
      ))
      .then(()=>self.clients.claim())
      .then(()=>self.clients.matchAll({type:'window'}))
      .then(clients=>clients.forEach(c=>c.postMessage({type:'SW_UPDATED',version:CACHE.replace('finanzas-','')})))
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

  // logos.js: cache-first, igual que las fuentes. Es inmutable para un ?v=
  // dado, así que una vez bajado no vuelve a salir a la red aunque se
  // actualice la app. Un logo nuevo entra subiendo el ?v= en index.html: la
  // URL cambia, no hay entrada para ella y se baja una sola vez.
  if(url.origin===self.location.origin&&url.pathname.endsWith('/logos.js')){
    e.respondWith(
      caches.open(ASSETS_CACHE).then(cache=>
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
  // fetch() no rechaza en errores HTTP (500/503/404) — sin este chequeo de
  // r.ok, el .catch() de abajo nunca corría y una respuesta de error rota
  // se servía tal cual en vez de caer al shell cacheado.
  if(url.pathname==='/Finanzas/'||url.pathname==='/Finanzas/index.html'){
    e.respondWith(
      fetch(e.request).then(r=>{
        if(r.ok){const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return r;}
        return caches.match('/Finanzas/').then(cached=>cached||r);
      }).catch(()=>caches.match('/Finanzas/'))
    );
    return;
  }

  // Other same-origin assets: network-first with cache fallback
  if(url.origin===self.location.origin&&url.pathname.startsWith('/Finanzas/')){
    e.respondWith(
      fetch(e.request).then(r=>{
        if(r.ok){const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return r;}
        return caches.match(e.request).then(cached=>cached||r);
      }).catch(()=>caches.match(e.request))
    );
  }
});

self.addEventListener('push',e=>{
  if(!e.data) return;
  const d=e.data.json();
  e.waitUntil(self.registration.showNotification(d.title||'Mis Finanzas',{
    body:d.body||'',
    icon:d.icon||'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23080c14"/><text y="44" x="10" font-size="38">%F0%9F%92%B0</text></svg>',
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
          icon:notif.icon||'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23080c14"/><text y="44" x="10" font-size="38">%F0%9F%92%B0</text></svg>',
          data:{url:'/Finanzas/'},
          vibrate:[100,50,100]
        });
        store.delete(notif.tag);
      }
    }
  }catch(e){/* ignore */}
}
