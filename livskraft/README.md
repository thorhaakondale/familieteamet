# Livskraft — treningsappen (Liv)

Statisk PWA i samme repo som Familieteamet. Egen dør: `livskraft/?k=<familiekode>&p=thor` eller `&p=anniken`.

- `index.html` — appen (ingen byggesteg). Logg lagres lokalt og speiles til Firebase under `fam/<kode>/okt/<person>/…` — samme database og samme regler som Familieteamet, ingen ny konfigurasjon.
- `data/program.json` — programmet (agentstyrt: Liv oppdaterer). Fasit: programkortet «Sprek til 100» v3 i Dale Livsstil & PT + liv-treningsspesifikasjon.md v1.2.
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — «Legg til på Hjem-skjerm», virker uten dekning etter første åpning.

Anniken har ingen program i data — det lages sammen med henne. Loggen hennes (søvn, skritt, vekt) virker allerede.


v1.2 (13.9.2026, Liv-skill v2): sesong, ukemodus (vanlig/minimum/syk), kort økt, tilbakefallsprotokoll (2 på rad / 21+ dager → 70 %), affekt-spørsmål, milepæler, «økter siste 4 uker», Annikens minimumsnivå + midjemål. SW rydder bare lk-*-cacher; manifest uten start_url; localStorage-nøkler lk-*.
