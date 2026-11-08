"""Livskraft bildestandard v1 (8.11.2026) — komponerer øvelsesbilder.
Bruk: compose(frames, layout, cue, markers, labels, out)
  frames  : liste med 1 eller 2 bildestier (4:3, generert i samme stil og seed)
  layout  : 'stack' (640x640, til 10-minutteren/guiden) eller 'row' (800x400, til A/B/H-øvelser)
  cue     : én kort setning (det ene å passe på) — vises i toppbåndet, grønn
  markers : [(panel, (x0,y0,x1,y1) i panelets 400x300-koordinater, farge)] grønn stiplet ellipse
  labels  : [(panel, (x,y), tekst, farge)] i panelets koordinater
  arrow   : True = lilla bevegelsespil fra ① til ②
"""
from PIL import Image, ImageDraw, ImageFont
import base64, json, math, subprocess, sys

P=(124,58,237,255); G=(22,163,74,255); GR=(75,85,99,255); BG=(253,248,238,255)
F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
PW,PH=400,300

def _font(s): return ImageFont.truetype(F,s)

def _badge(d,xy,n):
    x,y=xy; d.ellipse([x,y,x+34,y+34],fill=P); d.text((x+17,y+17),str(n),fill=(255,255,255,255),font=_font(20),anchor='mm')

def _dashed_ellipse(d,box,color):
    for t in range(0,360,22): d.arc(box,t,t+11,fill=color,width=5)

def _arrow(d,pts,color=P,w=8):
    d.line(pts,fill=color,width=w,joint='curve')
    (x0,y0),(x1,y1)=pts[-4],pts[-1]; a=math.atan2(y1-y0,x1-x0); L=24
    d.polygon([(x1,y1),(x1-L*math.cos(a-.5),y1-L*math.sin(a-.5)),(x1-L*math.cos(a+.5),y1-L*math.sin(a+.5))],fill=color)

def _bez(p0,p1,p2,n=40):
    return [((1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0],(1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1]) for t in [i/n for i in range(n+1)]]

def compose(frames,layout,cue,markers=(),labels=(),arrow=True,out='/tmp/out.webp',quality=80):
    fr=[Image.open(f).convert('RGBA').resize((PW,PH),Image.LANCZOS) for f in frames]
    if layout=='stack':
        W,H=640,640; top=40
        pos=[(120,top),(120,top+PH)] if len(fr)==2 else [(120,top+150)]
    else:
        W,H=800,400; top=40
        pos=[(0,top),(PW,top)] if len(fr)==2 else [(200,top)]
    im=Image.new('RGBA',(W,H),BG)
    for f,p in zip(fr,pos): im.alpha_composite(f,p)
    d=ImageDraw.Draw(im)
    # markører og etiketter i panelkoordinater
    for (pi,box,col) in markers:
        ox,oy=pos[pi]; _dashed_ellipse(d,[box[0]+ox,box[1]+oy,box[2]+ox,box[3]+oy],col)
    for (pi,(x,y),txt,col) in labels:
        ox,oy=pos[pi]; d.text((x+ox,y+oy),txt,fill=col,font=_font(17))
    # toppbånd: cue
    d.text((W//2,top//2),cue,fill=G,font=_font(19 if len(cue)<48 else 16),anchor='mm')
    if len(fr)==2:
        for i,p in enumerate(pos): _badge(d,(p[0]+6,p[1]+6),i+1)
        if arrow:
            if layout=='stack':
                x=pos[0][0]+PW+40; _arrow(d,_bez((x,pos[0][1]+PH*0.45),(x+40,pos[0][1]+PH),(x,pos[1][1]+PH*0.55)))
            else:
                y=pos[0][1]+PH*0.5; _arrow(d,[(pos[0][0]+PW-70,y),(pos[1][0]+70,y)])
    im.convert('RGB').save(out,'WEBP',quality=quality,method=6)
    b=open(out,'rb').read()
    return out,len(b),'data:image/webp;base64,'+base64.b64encode(b).decode()

import os
# Familiekoden ligger ALDRI i repoet: sett miljøvariabelen FAM_KODE før bruk.
B='https://familieteamet-edf81-default-rtdb.europe-west1.firebasedatabase.app/fam/'+os.environ['FAM_KODE']
def push(b64,targets):
    """targets: [(person,id)] — skriver samme bilde til alle, leser tilbake."""
    body=json.dumps({'by':'liv','d':b64})
    for person,eid in targets:
        url=f'{B}/livskraft/bilder/{person}/{eid}.json'
        subprocess.run(['curl','-sS','-X','PUT','-H','Content-Type: application/json',url,'--data-binary',body],capture_output=True)
        r=subprocess.run(['curl','-sS',url],capture_output=True,text=True).stdout
        ok=json.loads(r).get('d','')==b64
        print(f'  {person}/{eid}: {"OK" if ok else "FEIL"} ({len(b64)//1024} kB)')
        if not ok: sys.exit(1)
