// Krypteringen mot testvektoren i RFC 8291, vedlegg A — samme input skal gi nøyaktig samme bytes.
import { krypter, fraB64u, b64u } from '../src/webpush.js';
const A = {
  tekst: 'When I grow up, I want to be a watermelon',
  asPriv: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPub: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPub: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  forventet: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const pub = fraB64u(A.asPub);
const jwk = { kty: 'EC', crv: 'P-256', d: A.asPriv, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33)), ext: true };
const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const publicKey = await crypto.subtle.importKey('raw', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
const ut = await krypter({ keys: { p256dh: A.uaPub, auth: A.auth } }, A.tekst, { privateKey, publicKey }, fraB64u(A.salt));
const ok = b64u(ut) === A.forventet;
console.log(ok ? '✅ RFC 8291 vedlegg A: identiske bytes' : '❌ RFC 8291 avviker\n' + b64u(ut));
process.exit(ok ? 0 : 1);
