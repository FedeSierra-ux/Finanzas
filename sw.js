// Versión tomada del query string con el que index.html registra este worker
// (?v=APP_VERSION) — una sola fuente de verdad, no hay que sincronizar a mano.
const _swVersion=new URL(self.location.href).searchParams.get('v')||'0';
const CACHE='finanzas-v'+_swVersion;
// Ruta base de la app, sacada del scope con el que se registró el worker:
// "/Finanzas/" en GitHub Pages, "/" si se sirve desde la raíz. Así el shell
// cacheado y el fallback sin red valen para cualquier ruta, sin hardcodear.
const BASE=new URL(self.registration.scope).pathname;
const SHELL=[BASE,BASE+'index.html'];
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
const LOGOS_URL=BASE+'logos.js?v=3';

// SheetJS autoalojado (importar Excel). Mismo criterio que logos.js: la clave
// es la URL con el ?v= (la versión de la librería) y va a ASSETS_CACHE, así no
// se vuelve a bajar (~950kb) en cada versión de la app. Debe coincidir con el
// src que arma handleExcelFile en index.html.
const XLSX_URL=BASE+'xlsx.full.min.js?v=0.20.3';

// Cuánto se espera al servidor por el shell antes de abrir del cache: con
// señal "colgada" (conecta y no contesta) el pedido no falla, solo no termina,
// y la app instalada quedaba en blanco.
const SHELL_TIMEOUT_MS=3500;

self.addEventListener('install',e=>{
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c=>c.addAll(SHELL)),
    // Los logos van a su propia caché ya en la instalación: si no, la primera
    // carga sin red después de instalar los pierde (todavía no se pidieron
    // nunca con el worker al mando). Si falla, no se aborta la instalación —
    // se bajan solos la próxima vez que haya red.
    // Solo se baja lo que todavía no está: el cache sobrevive a las versiones.
    caches.open(ASSETS_CACHE).then(c=>Promise.all([LOGOS_URL,XLSX_URL].map(u=>
      c.match(u).then(hit=>hit||c.add(u)).catch(()=>{})
    ))),
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
  if(e.data?.type==='SYNC_NOTIF_QUEUE'){
    e.waitUntil(saveNotifQueue(e.data.items||[]));
  }
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);

  // La consulta de versión nueva (version.json) va siempre a la red, sin cache
  // ni respaldo: sin red tiene que fallar para que la app sepa que no hay
  // conexión (checkForUpdate no borra nada si no responde).
  if(url.origin===self.location.origin&&url.pathname===BASE+'version.json') return;

  // Google Fonts: cache-first (immutable assets). La hoja de estilos se pide
  // sin CORS (<link>), así que la respuesta es opaca (status 0, r.ok falso):
  // se guarda igual, si no las fuentes nunca quedaban para abrir sin red.
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(
      caches.open(FONTS_CACHE).then(cache=>
        cache.match(e.request).then(hit=>{
          if(hit) return hit;
          return fetch(e.request).then(r=>{
            if(r.ok||r.type==='opaque') cache.put(e.request,r.clone());
            return r;
          });
        })
      )
    );
    return;
  }

  // logos.js y SheetJS: cache-first, igual que las fuentes. Son inmutables
  // para un ?v= dado, así que una vez bajados no vuelven a salir a la red
  // aunque se actualice la app. Uno nuevo entra subiendo el ?v= en index.html
  // (y su constante acá): la URL cambia, no hay entrada y se baja una sola vez.
  if(url.origin===self.location.origin&&(url.pathname.endsWith('/logos.js')||url.pathname.endsWith('/xlsx.full.min.js'))){
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
  if(url.origin===self.location.origin&&(url.pathname===BASE||url.pathname===BASE+'index.html')){
    // cache:'no-cache' = siempre revalidar con el servidor: GitHub Pages manda
    // max-age=600 y sin esto el shell salía del cache HTTP hasta 10 minutos
    // después de un deploy.
    e.respondWith(redPrimero(e,{cache:'no-cache'},caches.match(BASE)));
    return;
  }

  // Other same-origin assets: network-first with cache fallback
  if(url.origin===self.location.origin&&url.pathname.startsWith(BASE)){
    e.respondWith(redPrimero(e,{},caches.match(e.request)));
  }
});

// Network-first con tope de espera: si el servidor no contesta en
// SHELL_TIMEOUT_MS y hay copia en cache, se sirve esa. Sin copia (primera
// visita) se sigue esperando a la red: no hay otra cosa que mostrar. La
// respuesta tardía igual se guarda para la próxima. `cached` es la promesa del
// respaldo (se arma antes de esperar, solo se lee si hace falta).
async function redPrimero(e,init,cached){
  const net=fetch(e.request,init);
  net.then(r=>{
    if(r.ok){const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));}
  },()=>{});
  let timer;
  const tope=new Promise(res=>{timer=setTimeout(()=>res(null),SHELL_TIMEOUT_MS);});
  const r=await Promise.race([net.catch(()=>null),tope]);
  clearTimeout(timer);
  if(r&&r.ok) return r;
  const hit=await cached;
  if(hit) return hit;
  // Sin copia: se entrega lo que haya, o se espera a la red (si falla, el
  // navegador ve el error de red como siempre).
  return r||net.catch(()=>undefined);
}

self.addEventListener('push',e=>{
  if(!e.data) return;
  // El cuerpo no tiene por qué ser JSON (un push de prueba desde las
  // DevTools, o el Worker mandando texto): sin el try, json() tiraba y el
  // aviso no salía. Si no es un objeto, se muestra como texto.
  let d;
  try{d=e.data.json();}catch(_){try{d={body:e.data.text()};}catch(__){d={};}}
  if(!d||typeof d!=='object') d={body:String(d??'')};
  e.waitUntil(self.registration.showNotification(d.title||'Mis Finanzas',{
    body:d.body||'',
    icon:d.icon||'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23080c14"/><text y="44" x="10" font-size="38">%F0%9F%92%B0</text></svg>',
    tag:d.tag||'fin',
    data:{url:d.url||BASE},
    vibrate:[100,50,100]
  }));
});

// Periodic Background Sync — fires when browser grants time (Chrome Android)
self.addEventListener('periodicsync',e=>{
  if(e.tag==='fin-notifs') e.waitUntil(fireDueNotifs());
});

// A dónde lleva un aviso: data.url relativa al origen de la app, y solo de la
// app (una URL de otro origen o fuera del scope vuelve a la raíz).
function urlDeAviso(raw){
  try{
    const u=new URL(raw||BASE,self.location.origin);
    return u.origin===self.location.origin&&u.pathname.startsWith(BASE)?u:new URL(BASE,self.location.origin);
  }catch(_){return new URL(BASE,self.location.origin);}
}
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const destino=urlDeAviso(e.notification.data?.url);
  // Solo se navega si el aviso apunta a algo más que la raíz de la app (una
  // acción, ?action=new-gasto): recargar la raíz tiraría lo que haya a medio cargar.
  const profundo=!!(destino.search||destino.hash)||(destino.pathname!==BASE&&destino.pathname!==BASE+'index.html');
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    const mias=cs.filter(c=>{try{const u=new URL(c.url);return u.origin===destino.origin&&u.pathname.startsWith(BASE);}catch(_){return false;}});
    const c=mias[0];
    if(c){
      const f=c.focus();
      if(profundo&&c.url!==destino.href&&typeof c.navigate==='function')
        return Promise.resolve(f).then(()=>c.navigate(destino.href)).catch(()=>{});
      return f;
    }
    return clients.openWindow(destino.pathname+destino.search+destino.hash);
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
    const all=await new Promise((res,rej)=>{
      const req=db.transaction('queue','readonly').objectStore('queue').getAll();
      req.onsuccess=()=>res(req.result);
      req.onerror=()=>rej(req.error);
    });
    const now=Date.now();
    const due=all.filter(n=>n.fireAt<=now);
    if(!due.length) return;
    // Primero se sacan de la cola, en una transacción propia: un await adentro
    // de la transacción (showNotification) la cerraba, el delete tiraba error y
    // de varios avisos vencidos salía solo el primero, repetido en cada arranque.
    await new Promise(res=>{
      const tx=db.transaction('queue','readwrite');
      const store=tx.objectStore('queue');
      due.forEach(n=>store.delete(n.tag));
      tx.oncomplete=tx.onerror=tx.onabort=()=>res();
    });
    for(const notif of due){
      try{
        await self.registration.showNotification(notif.title,{
          body:notif.body,
          tag:notif.tag,
          icon:notif.icon||'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23080c14"/><text y="44" x="10" font-size="38">%F0%9F%92%B0</text></svg>',
          data:{url:BASE},
          vibrate:[100,50,100]
        });
      }catch(e){/* sigue con el próximo */}
    }
  }catch(e){/* ignore */}
}
