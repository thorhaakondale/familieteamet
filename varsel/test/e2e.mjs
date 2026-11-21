// Ende-til-ende lokalt: ekte Worker + Durable Object (wrangler dev / workerd) mot en falsk push-tjeneste
// som sjekker VAPID-signaturen og dekrypterer meldingen med telefonens nøkler — slik Apple og iOS gjør.
import http from 'node:http';
import { b64u, fraB64u } from '../src/webpush.js';
const W = process.env.W || 'http://127.0.0.1:8787';
const te = new TextEncoder(), td = new TextDecoder();
let ok = 0, feil = 0; const sjekk = (n, c) => { c ? ok++ : feil++; console.log((c ? '✅ ' : '❌ ') + n); };
const vent = ms => new Promise(r => setTimeout(r, ms));
async function hkdf(salt, ikm, info, len) { const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']); return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8)); }
const cat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length } return o };

// «Telefonen»: eget nøkkelpar + auth, som PushManager.subscribe() lager
const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
const auth = crypto.getRandomValues(new Uint8Array(16));
let mottatt = [], svarKode = 201;
const srv = http.createServer(async (req, res) => {
  const deler = []; for await (const d of req) deler.push(d); const body = new Uint8Array(Buffer.concat(deler));
  const t = Date.now(); let ok2 = { vapid: false, tekst: null, hode: req.headers };
  try {
    const m = /vapid t=([^,]+), k=(.+)/.exec(req.headers.authorization || '');
    const [h, k2, s] = m[1].split('.'); const krav = JSON.parse(td.decode(fraB64u(k2)));
    const pk = await crypto.subtle.importKey('raw', fraB64u(m[2]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    ok2.vapid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pk, fraB64u(s), te.encode(h + '.' + k2)) && krav.aud === 'http://127.0.0.1:8790' && krav.exp > t / 1000 && /^https:/.test(krav.sub);
    const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const delt = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
    const ikm = await hkdf(auth, delt, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
    const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
    const kk = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const klar = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, kk, ct));
    ok2.tekst = JSON.parse(td.decode(klar.slice(0, klar.lastIndexOf(2))));
  } catch (e) { ok2.err = String(e) }
  mottatt.push({ t, ...ok2 }); res.writeHead(svarKode); res.end();
}).listen(8790);

const post = (p, b) => fetch(W + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8799' }, body: JSON.stringify(b) }).then(async r => ({ s: r.status, j: await r.json(), h: r.headers }));
const dev = b64u(crypto.getRandomValues(new Uint8Array(16)));
const sub = { endpoint: 'http://127.0.0.1:8790/push/abc', keys: { p256dh: b64u(uaPub), auth: b64u(auth) } };
const U = 'http://localhost:8799/livskraft/#okt';

const v = await fetch(W + '/vapid').then(r => r.json()); sjekk('GET /vapid gir offentlig nøkkel (65 byte)', fraB64u(v.key).length === 65);
sjekk('plan uten abonnement avvises', (await post('/plan', { dev, sek: 2, tekst: 'x' })).j.ok === false);
let r = await post('/abonner', { dev, app: 'livskraft', sub }); sjekk('abonner', r.j.ok === true);
sjekk('CORS tillater appens opprinnelse', r.h.get('access-control-allow-origin') === 'http://localhost:8799');
sjekk('fremmed push-vert avvises', (await post('/abonner', { dev, sub: { ...sub, endpoint: 'https://evil.example/x' } })).s === 400);
sjekk('ugyldig enhets-id avvises', (await post('/plan', { dev: 'kort', sek: 2 })).s === 400);
sjekk('lenke til fremmed side avvises', (await post('/plan', { dev, sek: 2, url: 'https://evil.example/' })).s === 400);
sjekk('for lang pause avvises', (await post('/plan', { dev, sek: 99999 })).s === 400);

// 1) timeren: varsel på riktig sekund
let t0 = Date.now(); r = await post('/plan', { dev, sek: 3, tittel: 'Livskraft', tekst: 'Pausen er over — knebøy sett 2. Kjør.', url: U, tag: 'pause' });
sjekk('plan 3 s', r.j.ok && r.j.id);
await vent(4500);
sjekk('nøyaktig ett varsel kom', mottatt.length === 1);
const m1 = mottatt[0] || {}; const forsink = m1.t - t0;
sjekk(`kom etter ${(forsink / 1000).toFixed(2)} s (mål 3,0 s, toleranse ±0,8)`, Math.abs(forsink - 3000) < 800);
sjekk('VAPID-signatur, aud og sub gyldige', m1.vapid === true);
sjekk('dekryptert innhold: deklarativt format (web_push 8030, tittel, tekst, navigate, tag)', m1.tekst && m1.tekst.web_push === 8030 && m1.tekst.notification.body === 'Pausen er over — knebøy sett 2. Kjør.' && m1.tekst.notification.navigate === U && m1.tekst.notification.title === 'Livskraft' && m1.tekst.notification.tag === 'pause' && m1.tekst.notification.silent === false);
sjekk('hoder: aes128gcm, TTL, Urgency high, Topic', m1.hode && m1.hode['content-encoding'] === 'aes128gcm' && m1.hode['ttl'] === '120' && m1.hode['urgency'] === 'high' && m1.hode['topic'] === 'pause');

// 2) avlys: ingenting skal komme
mottatt = []; await post('/plan', { dev, sek: 2, tekst: 'skal ikke komme' }); await vent(500); await post('/avlys', { dev }); await vent(3000);
sjekk('avlyst varsel kommer ikke', mottatt.length === 0);

// 3) +30-knappen: ny plan erstatter den gamle (bare det siste kommer)
mottatt = []; await post('/plan', { dev, sek: 2, tekst: 'gammel' }); await vent(300); await post('/plan', { dev, sek: 3, tekst: 'ny' }); await vent(4500);
sjekk('ny plan erstatter gammel — ett varsel, det nye', mottatt.length === 1 && mottatt[0].tekst && mottatt[0].tekst.notification.body === 'ny');

// 4) testknappen: med en gang
mottatt = []; t0 = Date.now(); r = await post('/test', { dev, url: U }); sjekk('testvarsel sendt straks (201)', r.j.ok && r.j.status === 201 && mottatt.length === 1);
sjekk('navigate faller aldri bort (påkrevd i deklarativ push)', mottatt[0].tekst.notification.navigate === U);

// 5) to enheter (Thor og Anniken) er helt atskilt
const dev2 = b64u(crypto.getRandomValues(new Uint8Array(16)));
mottatt = []; await post('/abonner', { dev: dev2, sub: { ...sub, endpoint: 'http://127.0.0.1:8790/push/to' } }); await post('/plan', { dev, sek: 2, tekst: 'en' }); await post('/plan', { dev: dev2, sek: 2, tekst: 'to' }); await vent(3500);
sjekk('to enheter får hvert sitt varsel', mottatt.length === 2 && new Set(mottatt.map(m => m.tekst && m.tekst.notification.body)).size === 2);

// 6) Apple sier at abonnementet er borte (410) → slettes, så vi ikke maser
svarKode = 410; mottatt = []; await post('/test', { dev: dev2 }); const st = await post('/status', { dev: dev2 });
sjekk('410 fra push-tjenesten sletter abonnementet', st.j.abonnert === false && st.j.sist.status === 410);
svarKode = 201;
const st1 = await post('/status', { dev }); sjekk('status viser siste levering', st1.j.abonnert && st1.j.sist && st1.j.sist.status === 201);

srv.close(); console.log(`\nOK ${ok}  FEIL ${feil}`); process.exit(feil ? 1 : 0);
