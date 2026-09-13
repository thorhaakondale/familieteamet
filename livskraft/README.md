# Livskraft — treningsappen (Liv)

Statisk PWA i samme repo som Familieteamet. Egen dør: `livskraft/?k=<familiekode>&p=thor` eller `&p=anniken`.

- `index.html` — appen (ingen byggesteg). Logg lagres lokalt og speiles til Firebase under `fam/<kode>/okt/<person>/…` — samme database og samme regler som Familieteamet, ingen ny konfigurasjon.
- `data/program.json` — programmet (agentstyrt: Liv oppdaterer). Fasit: programkortet «Sprek til 100» v3 i Dale Livsstil & PT + liv-treningsspesifikasjon.md v1.1.
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — «Legg til på Hjem-skjerm», virker uten dekning etter første åpning.

Anniken har ingen program i data — det lages sammen med henne. Loggen hennes (søvn, skritt, vekt) virker allerede.
