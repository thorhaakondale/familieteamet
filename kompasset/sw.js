/* Kompasset — appskallet caches så siden åpner uten dekning. Rydder BARE egne cacher (kp-*): Familieteamet (ft-*) og Livskraft (lk-*) bor på samme origin. */
var C='kp-v1';
self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-180.png'])}).then(function(){self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==C&&k.indexOf('kp-')===0}).map(function(k){return caches.delete(k)}))}).then(function(){return clients.claim()}))});
self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;var u=new URL(e.request.url);if(u.origin!==location.origin)return;if(u.pathname.indexOf('/kompasset/')<0)return;
  e.respondWith(fetch(e.request).then(function(r){var c=r.clone();caches.open(C).then(function(ca){ca.put(e.request,c)});return r}).catch(function(){return caches.match(e.request,{ignoreSearch:true}).then(function(m){return m||(e.request.mode==='navigate'?caches.match('index.html'):Response.error())})}))});
