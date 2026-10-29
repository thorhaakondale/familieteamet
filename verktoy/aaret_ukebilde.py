#!/usr/bin/env python3
"""Ukebildet av «Året» — for kortet i Familiekalenderen.

Kjøres av Ukesjekken hver søndag. Regner ut nøyaktig det samme som Året-seksjonen
i appen (window.aaretData() i aaret.js), uten å åpne den ekte appen: siden lastes
fra en lokal kopi av repoet med testkode, ALL nettrafikk utenfor 127.0.0.1 blokkeres
(ingen Firebase, ingen ntfy), og familiens data legges inn fra JSON-filer.
Ingenting skrives noe sted — utdata er én JSON-fil.

Bruk:
  python3 -I verktoy/aaret_ukebilde.py <datamappe> <repomappe> <utfil.json>
<datamappe> må ha oppgaver.json, uker.json, fravaer.json, innstillinger.json,
turer.json og aaret.json (rå GET fra Firebase; null er greit).
Familiekoden står aldri i denne fila.
"""
import json, os, socket, subprocess, sys, time, datetime
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright

D, REPO, UT = sys.argv[1], sys.argv[2], sys.argv[3]


def les(n):
    try:
        with open(os.path.join(D, n + '.json'), encoding='utf-8') as f:
            return json.load(f) or {}
    except FileNotFoundError:
        return {}


data = {k: les(k) for k in ['oppgaver', 'fravaer', 'innstillinger', 'turer', 'uker']}
aar = les('aaret')
if not data['oppgaver']:
    sys.exit('oppgaver.json er tom — avbryter')

s = socket.socket(); s.bind(('127.0.0.1', 0)); PORT = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
                       cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
LOKAL = 'http://127.0.0.1:%d/' % PORT
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); feil = []
        pg.on('pageerror', lambda e: feil.append(str(e)[:200]))
        pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith(LOKAL) else r.abort())
        ls = {'terskel': aar.get('terskel', 180), 'helg': aar.get('helg') or {}, 'sesong': aar.get('sesong') or {},
              'tilbake': aar.get('tilbake') or {}, 'innboks': aar.get('innboks') or {}}
        pg.add_init_script("localStorage.setItem('ft-aaret',%s)" % json.dumps(json.dumps(ls)))
        pg.goto(LOKAL + 'index.html?k=test&p=thor'); pg.wait_for_timeout(2500)
        pg.evaluate("""d=>{FRAVAER=d.fravaer||{};INNST=Object.assign(INNST||{},d.innstillinger||{});TURER=d.turer||{};UKER=d.uker||{};
          slaaSammenOppg(Object.keys(d.oppgaver).map(k=>d.oppgaver[k]));OPPG_LASTET=true;UKER_LASTET=true;VIS_OFF=0;tegn()}""", data)
        pg.wait_for_timeout(500)
        r = pg.evaluate("window.aaretData()")
        versjon = pg.evaluate("typeof VERSJON!=='undefined'?VERSJON:''")
        b.close()
finally:
    srv.terminate()

if feil:
    sys.exit('Feil i appen: ' + ' | '.join(feil))
if not r or not r.get('uker'):
    sys.exit('aaretData() ga ingen uker')

naa = datetime.datetime.now(ZoneInfo('Europe/Oslo'))
iso = naa.isocalendar()
tilbake = ls['tilbake']
doc = {
    'uke': '%d-W%02d' % (iso[0], iso[1]),
    'oppdatert': naa.strftime('%Y-%m-%d'),
    'versjon': versjon,
    'terskel': r.get('terskel') or 180,
    'etterslep': r.get('etterslep') or 0,
    'uker': [{'u': u['key'], 'nr': u['nr'], 'man': u['man'], 'min': u['min'], 'type': u['type'],
              'hvorfor': u.get('hvorfor') or '', 'oppg': (u.get('oppg') or [])[:4]} for u in r['uker']],
    'sesong': [{'id': x['id'], 'key': x['key'], 'd': x['dato'], 'navn': x['navn'], 'overstyrt': bool(x.get('overstyrt')),
                'tilbake': (tilbake.get(x['key']) or {}).get('vekt') or ''} for x in r.get('sesong') or []],
    'innboks': len(ls['innboks']),
    'kilde': 'ukesjekken', 'by': 'bjorn', 'ts': naa.isoformat(timespec='seconds'),
}
with open(UT, 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False)
print('OK', doc['uke'], 'app', versjon, len(doc['uker']), 'uker,', len(doc['sesong']), 'sesonghelger')
