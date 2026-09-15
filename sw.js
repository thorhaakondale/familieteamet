self.addEventListener('install',function(e){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(clients.claim())});
/* nettverk først, fall tilbake til cache — data og haker skal alltid være ferske */
self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(function(r){var c=r.clone();caches.open('ft-v1130').then(function(ca){ca.put(e.request,c)});return r}).catch(function(){return caches.match(e.request)}))});
