/* Livskraft — appskallet caches så siden åpner uten dekning på gymmet; data/program.json hentes nettverk først */
var C='lk-v55';
self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-180.png','img/birddog.webp','img/sideplanke.webp','img/deadhang.webp','img/suitcase.webp','img/goblet.webp','img/hoftehev.webp','img/rdlmanual.webp'])}).then(function(){self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==C&&k.indexOf('lk-')===0}) /* rydder BARE egne cacher — Familieteamet (ft-*) bor på samme origin */.map(function(k){return caches.delete(k)}))}).then(function(){return clients.claim()}))});
self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;var u=new URL(e.request.url);if(u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(function(r){var c=r.clone();caches.open(C).then(function(ca){ca.put(e.request,c)});return r}).catch(function(){return caches.match(e.request,{ignoreSearch:true}).then(function(m){return m||(e.request.mode==='navigate'?caches.match('index.html'):Response.error())})}))});
/* v1.40 (Thor 21.11.2026): Livskraft-varsler. Meldingen kommer i deklarativt format ({web_push:8030, notification:{…}}).
   iOS 18.4+ viser den selv; da kommer push-hendelsen hit med samme innhold, og vi viser den på nytt med samme tag
   (erstatter, ikke dobbelt). Eldre iOS: bare denne veien. Safari krever at HVER push gir et synlig varsel. */
self.addEventListener('push',function(e){var d={};try{d=e.data?e.data.json():{}}catch(x){d={notification:{title:'Livskraft',body:e.data?e.data.text():''}}}
  var n=d.notification||d||{};
  e.waitUntil(self.registration.showNotification(n.title||'Livskraft',{body:n.body||'',tag:n.tag||'livskraft',lang:'nb',icon:'icon-192.png',badge:'icon-192.png',data:{url:n.navigate||'./'}}))});
self.addEventListener('notificationclick',function(e){e.notification.close();var url=(e.notification.data&&e.notification.data.url)||'./';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(l){
    for(var i=0;i<l.length;i++){if(l[i].url.indexOf('/livskraft/')>=0&&'focus' in l[i])return l[i].focus()} /* appen lever i bakgrunnen: hent den fram som den var — økta og timeren står der */
    return self.clients.openWindow(url)}))});
