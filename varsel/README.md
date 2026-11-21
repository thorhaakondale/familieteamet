# Varsel — egne push-varsler for Livskraft (og senere Familieteamet)

Liten Cloudflare Worker som sender ekte Web Push-varsler til appene på Hjem-skjermen, i stedet for ntfy.
Varselet kommer fra appen selv (eget ikon på telefon og Apple Watch), og et trykk åpner appen.

- `src/index.js` — API: `GET /vapid`, `GET /helse`, `POST /abonner`, `/plan`, `/avlys`, `/test`, `/status`. Ett Durable Object per enhet holder abonnementet og én alarm.
- `src/webpush.js` — Web Push med VAPID (RFC 8292) og aes128gcm (RFC 8291), bare WebCrypto, ingen avhengigheter.
- Meldingene sendes i deklarativt format (`web_push: 8030`) så iOS 18.4+ viser og åpner dem selv; service workeren i appen viser dem på eldre iOS.
- Ingen navn, ingen familiekode: bare en tilfeldig enhets-id, push-abonnementet og neste melding.

Tester: `npm run test:rfc` (krypteringen mot RFC 8291 vedlegg A) og `test:e2e` (ekte Worker lokalt via `wrangler dev` mot en falsk push-tjeneste som sjekker VAPID-signaturen og dekrypterer).

Utrulling skjer i GitHub Actions (`.github/workflows/varsel.yml`) med hemmelighetene `CLOUDFLARE_API_TOKEN` og `CLOUDFLARE_ACCOUNT_ID`. VAPID-nøkkelen lages første gang inne i Cloudflare og forlater den aldri. Adressen skrives til `varsel/adresse.txt`.
