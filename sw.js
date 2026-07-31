// Versión tomada del query string con el que index.html registra este worker
// (?v=APP_VERSION) — una sola fuente de verdad, no hay que sincronizar a mano.
const _swVersion=new URL(self.location.href).searchParams.get('v')||'0';
const CACHE='finanzas-v'+_swVersion;
const SHELL=['/Finanzas/','/Finanzas/index.html'];
const FONTS_CACHE='finanzas-fonts-v1';
// Logos de bancos y servicios. Antes viajaban embebidos en base64 dentro del
// index.html (360 kb que se volvían a bajar enteros en cada actualización);
// ahora son archivos aparte, con su propio cache de larga duración.
const ASSETS_CACHE='finanzas-assets-v1';
const ASSETS=['mercadopago','santander','macro','naranjax','netflix','hbomax','spotify','agua','luz','gas']
  .map(n=>`/Finanzas/assets/${n}.jpg`);

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    await c.addAll(SHELL);
    // Los assets se precachean con tolerancia a fallos: addAll es atómico y un
    // solo 404 abortaría la instalación entera del worker.
    const a=await caches.open(ASSETS_CACHE);
    await Promise.allSettled(ASSETS.map(u=>a.add(u)));
  })());
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

  // Logos: cache-first. Son inmutables — si alguno cambia, cambia su nombre de
  // archivo. Así no se vuelven a pedir en cada arranque ni en cada versión nueva.
  if(url.origin===self.location.origin&&url.pathname.startsWith('/Finanzas/assets/')){
    e.respondWith(
      caches.open(ASSETS_CACHE).then(cache=>
        cache.match(e.request).then(hit=>
          hit||fetch(e.request).then(r=>{
            if(r.ok) cache.put(e.request,r.clone());
            return r;
          })
        )
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

// Se espera a que la transacción cierre: la llamada viene de un e.waitUntil(), y sin
// el await el worker se puede dormir con la escritura a medio camino.
async function saveNotifQueue(items){
  try{
    const db=await openNotifDB();
    await new Promise((res,rej)=>{
      const tx=db.transaction('queue','readwrite');
      const store=tx.objectStore('queue');
      store.clear();
      items.forEach(item=>store.put(item));
      tx.oncomplete=()=>res();
      tx.onerror=()=>rej(tx.error);
      tx.onabort=()=>rej(tx.error);
    });
  }catch(e){/* ignore */}
}

// Las transacciones de IndexedDB se auto-cierran apenas el control vuelve al event
// loop sin pedidos pendientes. Antes esto hacía `await showNotification()` dentro de
// la transacción y después `store.delete()`: para entonces la transacción ya estaba
// muerta, el delete tiraba excepción, y el catch se la comía. Resultado: el aviso
// nunca salía de la cola y volvía a dispararse en cada arranque del worker, y como
// la excepción cortaba el for, de una tanda solo llegaba el primero.
// Por eso ahora va en tres etapas separadas: leer, notificar, borrar.
async function fireDueNotifs(){
  try{
    const db=await openNotifDB();

    // 1. Leer todo dentro de una transacción propia que se cierra sola.
    const all=await new Promise((res,rej)=>{
      const req=db.transaction('queue','readonly').objectStore('queue').getAll();
      req.onsuccess=()=>res(req.result||[]);
      req.onerror=()=>rej(req.error);
    });

    const due=all.filter(n=>n.fireAt<=Date.now());
    if(!due.length) return;

    // 2. Notificar sin ninguna transacción abierta. Si una notificación falla, las
    //    demás igual salen y esa se reintenta en el próximo arranque.
    const shown=[];
    for(const notif of due){
      try{
        await self.registration.showNotification(notif.title,{
          body:notif.body,
          tag:notif.tag,
          icon:notif.icon||'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23080c14"/><text y="44" x="10" font-size="38">%F0%9F%92%B0</text></svg>',
          data:{url:'/Finanzas/'},
          vibrate:[100,50,100]
        });
        shown.push(notif.tag);
      }catch(e){/* esta notificación no salió: se deja en la cola */}
    }
    if(!shown.length) return;

    // 3. Recién ahora, transacción nueva para sacar de la cola lo que sí se mostró.
    await new Promise((res,rej)=>{
      const tx=db.transaction('queue','readwrite');
      const store=tx.objectStore('queue');
      shown.forEach(tag=>store.delete(tag));
      tx.oncomplete=()=>res();
      tx.onerror=()=>rej(tx.error);
      tx.onabort=()=>rej(tx.error);
    });
  }catch(e){/* ignore */}
}
