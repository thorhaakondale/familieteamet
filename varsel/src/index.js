/* Varsel — egen push-tjeneste for Livskraft (og senere Familieteamet).
   Appen bestiller «send denne meldingen om N sekunder»; et Durable Object per enhet holder abonnementet og
   én alarm. Når alarmen går, sendes en Web Push-melding til telefonen. Varselet vises med appens eget ikon,
   også på Apple Watch, og et trykk åpner appen. Ingen navn eller familiekode lagres — bare en tilfeldig
   enhets-id, push-abonnementet og neste melding. */
import { DurableObject } from 'cloudflare:workers';
import { sendPush, offentligNokkel } from './webpush.js';

const PUSH_VERTER = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

function cors(req, env) {
  const o = req.headers.get('Origin') || '';
  const lov = (env.ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': lov.includes(o) ? o : lov[0] || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const svar = (obj, status, h) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...h } });
const gyldigDev = d => typeof d === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(d);
function gyldigUrl(u, env) {
  if (typeof u !== 'string' || u.length > 500) return false;
  return (env.ORIGINS || '').split(',').map(s => s.trim()).some(o => o && u.startsWith(o + '/'));
}
function gyldigSub(s, env) {
  try {
    if (!s || !s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) return false;
    const u = new URL(s.endpoint);
    if (env.TEST === '1' && u.hostname === '127.0.0.1') return true;
    return u.protocol === 'https:' && PUSH_VERTER.some(r => r.test(u.hostname));
  } catch { return false; }
}
const kort = (s, n) => String(s || '').slice(0, n);

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/vapid') {
        return svar({ key: offentligNokkel(JSON.parse(env.VAPID_JWK)) }, 200, h);
      }
      if (req.method === 'GET' && url.pathname === '/helse') return svar({ ok: true }, 200, h);
      if (req.method !== 'POST') return svar({ feil: 'ukjent' }, 404, h);
      const b = await req.json().catch(() => null);
      if (!b || !gyldigDev(b.dev)) return svar({ feil: 'dev' }, 400, h);
      const stub = env.ENHET.get(env.ENHET.idFromName(b.dev));
      switch (url.pathname) {
        case '/abonner':
          if (!gyldigSub(b.sub, env)) return svar({ feil: 'sub' }, 400, h);
          return svar(await stub.abonner(b.sub, kort(b.app, 20)), 200, h);
        case '/plan': {
          const sek = Number(b.sek);
          if (!(sek >= 1 && sek <= 6 * 3600)) return svar({ feil: 'sek' }, 400, h);
          if (b.url && !gyldigUrl(b.url, env)) return svar({ feil: 'url' }, 400, h);
          return svar(await stub.plan(sek, { tittel: kort(b.tittel, 60), tekst: kort(b.tekst, 200), url: b.url || '', tag: kort(b.tag, 40) }), 200, h);
        }
        case '/avlys': return svar(await stub.avlys(), 200, h);
        case '/test': return svar(await stub.sendNa({ tittel: kort(b.tittel || 'Livskraft', 60), tekst: kort(b.tekst || 'Testvarsel — virker det, er alt klart.', 200), url: gyldigUrl(b.url, env) ? b.url : '', tag: 'test' }), 200, h);
        case '/status': return svar(await stub.status(), 200, h);
        default: return svar({ feil: 'ukjent' }, 404, h);
      }
    } catch (e) {
      return svar({ feil: 'intern', melding: String(e && e.message || e).slice(0, 200) }, 500, h);
    }
  },
};

export class Enhet extends DurableObject {
  async abonner(sub, app) {
    await this.ctx.storage.put('sub', sub);
    await this.ctx.storage.put('app', app || '');
    return { ok: true };
  }
  async plan(sek, melding) {
    if (!(await this.ctx.storage.get('sub'))) return { ok: false, feil: 'ikke abonnert' };
    const id = crypto.randomUUID();
    const naar = Date.now() + sek * 1000;
    await this.ctx.storage.put('jobb', { id, naar, ...melding });
    await this.ctx.storage.setAlarm(naar);
    return { ok: true, id, naar };
  }
  async avlys() {
    await this.ctx.storage.delete('jobb');
    await this.ctx.storage.deleteAlarm();
    return { ok: true };
  }
  async status() {
    return { abonnert: !!(await this.ctx.storage.get('sub')), app: await this.ctx.storage.get('app'), jobb: await this.ctx.storage.get('jobb') || null, sist: await this.ctx.storage.get('sist') || null };
  }
  async sendNa(melding) {
    const sub = await this.ctx.storage.get('sub');
    if (!sub) return { ok: false, feil: 'ikke abonnert' };
    // Deklarativ Web Push (WebKit, iOS 18.4+): iOS viser varselet selv og åpner «navigate» ved trykk, uten å være
    // avhengig av service workeren. Eldre iOS og andre nettlesere sender meldingen til service workeren, som viser den.
    const data = { web_push: 8030, notification: { title: melding.tittel || 'Livskraft', body: melding.tekst || '', navigate: melding.url || this.env.VAPID_SUB, tag: melding.tag || 'varsel', silent: false, lang: 'nb' } };
    const r = await sendPush(sub, data, JSON.parse(this.env.VAPID_JWK), this.env.VAPID_SUB, { ttl: 120, topic: melding.tag ? melding.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : undefined });
    const sist = { ts: Date.now(), status: r.status, tekst: r.tekst };
    await this.ctx.storage.put('sist', sist);
    if (r.status === 404 || r.status === 410) await this.ctx.storage.delete('sub'); // abonnementet er borte (appen slettet / varsler slått av)
    return { ok: r.status >= 200 && r.status < 300, ...sist };
  }
  async alarm() {
    const jobb = await this.ctx.storage.get('jobb');
    if (!jobb) return;
    await this.ctx.storage.delete('jobb');
    const r = await this.sendNa(jobb);
    if (!r.ok && r.status >= 500) throw new Error('push ' + r.status); // 5xx: Cloudflare prøver alarmen på nytt (2 s, 4 s …)
  }
}
