/* Livskraft — appskallet caches så siden åpner uten dekning på gymmet; data/program.json hentes nettverk først */
var C='lk-v1';
self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-180.png'])}).then(function(){self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==C}).map(function(k){return caches.delete(k)}))}).then(function(){return clients.claim()}))});
self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;var u=new URL(e.request.url);if(u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(function(r){var c=r.clone();caches.open(C).then(function(ca){ca.put(e.request,c)});return r}).catch(function(){return caches.match(e.request,{ignoreSearch:true}).then(function(m){return m||caches.match('index.html')})}))});
