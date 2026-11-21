/* Web Push (RFC 8030) med VAPID (RFC 8292) og aes128gcm-kryptering (RFC 8291) — bare WebCrypto,
   så samme kode kjører i Cloudflare Workers og i Node (test). Ingen avhengigheter. */
const te = new TextEncoder();

export function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fraB64u(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function slaSammen(...deler) {
  const n = deler.reduce((a, d) => a + d.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const d of deler) { out.set(d, o); o += d.length; }
  return out;
}
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

/* Krypter payload for ett abonnement. asNokler/salt kan gis inn for testvektorer (RFC 8291 vedlegg A). */
export async function krypter(sub, payload, asNokler, salt) {
  const uaPub = fraB64u(sub.keys.p256dh);
  const auth = fraB64u(sub.keys.auth);
  const as = asNokler || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const delt = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, delt, slaSammen(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  salt = salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const klar = slaSammen(typeof payload === 'string' ? te.encode(payload) : payload, new Uint8Array([2]));
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const chiffer = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, klar));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return slaSammen(salt, rs, new Uint8Array([asPub.length]), asPub, chiffer);
}

/* VAPID: JWT signert med ES256. jwk = privat P-256-nøkkel som JWK (d, x, y). */
export async function vapidHode(endpoint, jwk, sub) {
  const aud = new URL(endpoint).origin;
  const hode = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const krav = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })));
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: jwk.d, x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(hode + '.' + krav)));
  return `vapid t=${hode}.${krav}.${b64u(sig)}, k=${offentligNokkel(jwk)}`;
}
export function offentligNokkel(jwk) {
  return b64u(slaSammen(new Uint8Array([4]), fraB64u(jwk.x), fraB64u(jwk.y)));
}

/* Send én melding. Returnerer HTTP-status fra push-tjenesten (201 = levert til Apple/Google/Mozilla). */
export async function sendPush(sub, data, jwk, vapidSub, opts = {}) {
  const body = await krypter(sub, JSON.stringify(data));
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHode(sub.endpoint, jwk, vapidSub),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opts.ttl || 120),
      Urgency: 'high',
      ...(opts.topic ? { Topic: opts.topic } : {}),
    },
    body,
  });
  return { status: r.status, tekst: r.status >= 300 ? (await r.text()).slice(0, 300) : '' };
}
