/* 📅 Året — Familieteamet v1.11 (13.9.2026, Bjørn)
   Helgeregnskapet, ukestripa, sesonghelgene, flytteforslag og innboksen.
   Bruker planUke()/forfalte() fra index.html. Egne data ligger under fam/<kode>/aaret/ —
   aldri under uker/ eller innstillinger/ (innstillinger skrives med set() og ville slettet oss).
   localStorage-nøkkel: ft-aaret (app-prefiks, jf. app-standarden). */
(function(){
'use strict';
var KAL={perioder:[],hoytider:[],aktiviteter:[],sesonghelger:[]};
var AARET={terskel:180,helg:{},sesong:{},tilbake:{},innboks:{}};
var VEDLKAT={Vedlikehold:1,Hytta:1,Sesong:1};
var TYPER=[null,'hytte','airbnb','prosjekt','fri'];
var IKON={fri:'⚪',hytte:'🏔️',airbnb:'🔑',ferie:'🔒',langhelg:'🔒',prosjekt:'🧰',vedl:'🔧'};
var NAVN={fri:'fri',hytte:'hytta',airbnb:'Airbnb',ferie:'ferie/høytid',langhelg:'langhelg',prosjekt:'prosjekt',vedl:'vedlikehold'};
var valgtUke=null, abonnert=false;

function lsGet(){try{var x=JSON.parse(localStorage.getItem('ft-aaret')||'null');if(x&&typeof x==='object')return x}catch(e){}return null}
function lsSet(){try{localStorage.setItem('ft-aaret',JSON.stringify(AARET))}catch(e){}}
function lordag(d){var x=new Date(d);x.setDate(x.getDate()-((x.getDay()+1)%7));return x}
function nteLordag(y,m,n){var d=new Date(y,m,1);d.setDate(1+((6-d.getDay()+7)%7)+7*(n-1));return d}
function timer(min){var t=Math.round(min/30)/2;return (String(t).replace('.',',')+' t')}

/* ---------- sesonghelgene: regel → dato, med overstyring per år ---------- */
function regelDato(id,y){
  if(id==='host-1'){var d=lordag(new Date(y,9,1));return d}
  if(id==='host-2')return nteLordag(y,9,3);
  if(id==='vaar-1')return nteLordag(y,3,3);
  if(id==='vaar-2'){var a=new Date(y,4,1),l=lordag(a),n=addDays(l,7);return (a-l)<=(n-a)?l:n}
  return null;
}
function sesongListe(){
  var ut=[], y0=NAA.getFullYear();
  (KAL.sesonghelger||[]).forEach(function(s){
    for(var y=y0;y<=y0+1;y++){var r=regelDato(s.id,y);if(!r)continue;
      var nk=s.id+'-'+y, ov=AARET.sesong&&AARET.sesong[nk];
      var d=ov&&ov.dato?new Date(ov.dato+'T00:00:00'):r;
      if(d<addDays(NAA,-120)||d>addDays(NAA,370))continue;
      ut.push({id:s.id,key:nk,navn:s.navn,regel:s.regel,dato:d,regelDato:r,overstyrt:!!(ov&&ov.dato)});
    }
  });
  ut.sort(function(a,b){return a.dato-b.dato});return ut;
}

/* ---------- uka: innsats, helgetype ---------- */
function periodeFor(d){var s=ymd(d);for(var i=0;i<KAL.perioder.length;i++){var p=KAL.perioder[i];if(s>=p.fra&&s<=p.til)return p}return null}
function hoytidFor(d){var s=ymd(d);for(var i=0;i<KAL.hoytider.length;i++){if(KAL.hoytider[i].dato===s)return KAL.hoytider[i]}return null}
function ukeInfo(man,sesong){
  var key=ukeKey(man), slots=planUke(man), min=0, oppg={}, sl=[];
  slots.forEach(function(s){if(!VEDLKAT[s.o.kat])return;if(!oppg[s.o.id]){oppg[s.o.id]={o:s.o,dag:s.dag,ant:0};sl.push(oppg[s.o.id]);min+=(s.o.min||0)}oppg[s.o.id].ant++}); /* klokketid, ikke × personer: laget jobber parallelt */
  var lo=addDays(man,5), so=addDays(man,6), auto=null, hvorfor='';
  var p=periodeFor(lo)||periodeFor(so); if(p){auto='ferie';hvorfor=p.navn}
  else {var h=hoytidFor(lo)||hoytidFor(so);if(h){auto='ferie';hvorfor=h.navn}
    else {var lh=hoytidFor(addDays(man,3))||hoytidFor(addDays(man,4))||hoytidFor(addDays(man,7));if(lh){auto='langhelg';hvorfor=lh.navn}}}
  var ses=sesong.filter(function(s){return ymd(s.dato)>=ymd(lo)&&ymd(s.dato)<=ymd(so)})[0];
  var manuell=AARET.helg&&AARET.helg[key]||null;
  var type=manuell||(ses?'vedl':(auto||'fri'));
  return {man:man,key:key,nr:isoWeek(man).w,min:min,oppg:sl,type:type,auto:auto,manuell:manuell,hvorfor:hvorfor,ses:ses,lo:lo};
}
function alleUker(){var man=mandag(NAA), ses=sesongListe(), ut=[];for(var w=0;w<52;w++){ut.push(ukeInfo(addDays(man,7*w),ses))}return ut}
function etterslep(){var m=0;forfalte().forEach(function(s){if(erRutine(s.o))return;if(s.o.int==='uke')return;m+=(s.o.min||0)});return m}

/* ---------- skriving ---------- */
function skriv(sti,val){
  var deler=sti.split('/'), o=AARET; for(var i=0;i<deler.length-1;i++){if(!o[deler[i]]||typeof o[deler[i]]!=='object')o[deler[i]]={};o=o[deler[i]]}
  if(val===null||val===undefined)delete o[deler[deler.length-1]]; else o[deler[deler.length-1]]=val;
  lsSet(); tegnAaret();
  if(window.db){db.child('aaret/'+sti).set(val===undefined?null:val).catch(function(){status('Kunne ikke lagre Året delt — prøv igjen.')})}
}
function flyttDato(o,dager){
  var ny=ymd(addDays(new Date(o.dato+'T00:00:00'),dager)); o.dato=ny; valgtUke=null; tegn();
  toast('→ '+datoNorsk(new Date(ny+'T00:00:00')));
  if(window.db){db.child('oppgaver/'+o.id).update({id:o.id,dato:ny,by:valgt||'familie',ts:new Date().toISOString()}).catch(function(){status('Kunne ikke lagre flyttingen delt.')})}
}

/* ---------- flytteforslag ---------- */
function forslag(uker){
  var ut=[], byKey={}; uker.forEach(function(u){byKey[u.key]=u});
  uker.forEach(function(u,i){ if(u.min<=AARET.terskel||u.type==='vedl') return; /* sesonghelga SKAL være tung */
    u.oppg.forEach(function(x){var o=x.o; if(o.int!=='dato'||o.fast) return; var sl=(o.slakk===undefined?1:o.slakk)|0; if(sl<1) return;
      var best=null;
      for(var k=-sl;k<=sl;k++){ if(!k) continue; var v=uker[i+k]; if(!v) continue; if(v.type==='ferie'||v.type==='langhelg'||v.type==='airbnb'||v.type==='hytte') continue;
        var score=v.min-(v.type==='vedl'?120:0); /* samle på sesonghelga */
        if(!best||score<best.score) best={u:v,score:score,k:k}; }
      if(best&&best.u.min+(o.min||0)<u.min){ ut.push({o:o,fra:u,til:best.u,k:best.k}); }
    });
  });
  return ut.slice(0,6);
}

/* ---------- tegning ---------- */
function tegnAaret(){
  var sec=document.getElementById('aaret'); if(!sec) return;
  var voksen=!valgt||valgt==='thor'||valgt==='anniken'; sec.hidden=!voksen; if(!voksen) return;
  var uker=alleUker(), ses=sesongListe(), tot={fri:0,hytte:0,airbnb:0,ferie:0,langhelg:0,prosjekt:0,vedl:0}, over=0, sumMin=0;
  uker.forEach(function(u){tot[u.type]=(tot[u.type]||0)+1;if(u.min>AARET.terskel)over++;sumMin+=u.min});
  var sperret=tot.ferie+tot.langhelg, ett=etterslep();

  /* helgeregnskapet */
  var h='<div class="aa-tiles">'+
    tile(52-sperret-tot.hytte-tot.airbnb-tot.prosjekt-tot.vedl,'⚪ frie helger','av 52 neste år')+
    tile(tot.vedl,'🔧 vedlikehold','sesonghelger')+
    tile(tot.prosjekt,'🧰 prosjekt','satt av')+
    tile(tot.hytte+tot.airbnb,'🏔️🔑 hytte/Airbnb','satt av')+
    tile(sperret,'🔒 ferie/høytid','fra skoleruta')+
    tile(timer(ett),'⏳ etterslep nå','legger seg på helgene')+
  '</div>'+
  '<p class="small">Det som ikke rekkes i uka havner i helga — og helger som allerede er sperret av ferie, hytte og prosjekter kan ikke ta det. '+
  (over?over+' av 52 uker ligger over terskelen på '+timer(AARET.terskel)+' innsats. ':'Ingen uke ligger over terskelen på '+timer(AARET.terskel)+'. ')+
  'Vedlikehold og drift av hus og hytte trenger '+timer(sumMin)+' det neste året ≈ '+timer(sumMin/52)+' per uke.</p>';
  document.getElementById('aa-regnskap').innerHTML=h;

  /* ukestripa */
  var maks=Math.max(AARET.terskel*1.2,1); uker.forEach(function(u){if(u.min>maks)maks=u.min});
  var s='<div class="aa-stripe">';
  uker.forEach(function(u,i){var hh=Math.round(u.min/maks*64); var cls='aa-bar'+(u.min>AARET.terskel?' over':'')+(valgtUke===u.key?' valgt':'')+(u.key===ukeKey(mandag(NAA))?' naa':'');
    s+='<div class="aa-col" data-uke="'+u.key+'" title="Uke '+u.nr+' · '+timer(u.min)+' · '+NAVN[u.type]+(u.hvorfor?' ('+esc(u.hvorfor)+')':'')+'">'+
       '<div class="aa-barwrap"><div class="'+cls+'" style="height:'+hh+'px"></div></div>'+
       '<div class="aa-helg t-'+u.type+'">'+IKON[u.type]+'</div>'+
       '<div class="aa-lab">'+((i%4===0)?'u'+u.nr:'')+'</div></div>'});
  s+='</div><div class="aa-legend">'+['fri','vedl','prosjekt','hytte','airbnb','ferie'].map(function(t){return '<span>'+IKON[t]+' '+NAVN[t]+'</span>'}).join('')+'<span class="aa-tersk">terskel <input type="number" id="aa-terskel" min="30" step="30" value="'+AARET.terskel+'" aria-label="Terskel minutter per uke"> min/uke</span></div>';
  document.getElementById('aa-stripe').innerHTML=s;
  Array.prototype.forEach.call(document.querySelectorAll('#aa-stripe .aa-col'),function(el){el.onclick=function(){valgtUke=(valgtUke===el.dataset.uke)?null:el.dataset.uke;tegnAaret()}});
  var ti=document.getElementById('aa-terskel'); if(ti){ti.onchange=function(){var v=Math.max(30,+ti.value||180);skriv('terskel',v)}}

  /* valgt uke */
  var vu=uker.filter(function(u){return u.key===valgtUke})[0], d=document.getElementById('aa-uke');
  if(!vu){d.innerHTML='<p class="small">Trykk på en uke i stripa for å se hva som ligger der — og merke helga som hytte, Airbnb, prosjekt eller fri.</p>'}
  else{
    var t='<h3 style="margin-top:4px">Uke '+vu.nr+' <span class="small">'+datoNorsk(vu.man)+'–'+datoNorsk(addDays(vu.man,6))+' · '+timer(vu.min)+' innsats</span></h3>';
    t+='<div class="aa-helgvalg">Helga '+datoNorsk(vu.lo)+': <b>'+IKON[vu.type]+' '+NAVN[vu.type]+'</b>'+(vu.hvorfor?' <span class="small">('+esc(vu.hvorfor)+')</span>':'')+(vu.ses?' <span class="small">('+esc(vu.ses.navn)+')</span>':'')+
      ' <span class="aa-btns">'+TYPER.map(function(x){var lab=x?IKON[x]+' '+NAVN[x]:'↺ automatisk';var on=(vu.manuell||null)===x;return '<button class="edit'+(on?' on':'')+'" data-t="'+(x||'')+'">'+lab+'</button>'}).join('')+'</span></div>';
    if(vu.oppg.length){t+='<table class="tbl aa-tbl">';vu.oppg.forEach(function(x){var o=x.o;var kan=o.int==='dato'&&!o.fast;
      t+='<tr><td>'+o.ikon+' '+esc(o.navn)+' <span class="small">'+DAGK[x.dag]+(x.ant>1?' · '+x.ant+' pers':'')+'</span></td><td class="c num">'+(o.min||0)+' min</td><td class="c">'+(kan?'<button class="edit" data-fl="-7" data-id="'+o.id+'">◀ uke</button> <button class="edit" data-fl="7" data-id="'+o.id+'">uke ▶</button>':'<span class="small">'+(o.int==='dato'?'fast':'jevnes automatisk')+'</span>')+'</td></tr>'});t+='</table>'}
    else t+='<p class="small">Ingen vedlikeholds- eller sesongjobber denne uka.</p>';
    d.innerHTML=t;
    Array.prototype.forEach.call(d.querySelectorAll('button[data-t]'),function(b){b.onclick=function(){skriv('helg/'+vu.key,b.dataset.t||null)}});
    Array.prototype.forEach.call(d.querySelectorAll('button[data-fl]'),function(b){b.onclick=function(){var o=OPPG.filter(function(x){return x.id===b.dataset.id})[0];if(o)flyttDato(o,+b.dataset.fl)}});
  }

  /* sesonghelgene */
  var sh='';
  ses.forEach(function(x){var key=ukeKey(mandag(x.dato)), u=uker.filter(function(q){return q.key===key})[0], passert=x.dato<NAA;
    var tb=AARET.tilbake&&AARET.tilbake[x.key];
    sh+='<div class="aa-ses'+(passert?' passert':'')+'"><div><b>'+esc(x.navn)+'</b><br><span class="small">'+DAGK[5]+' '+datoNorsk(x.dato)+' · uke '+isoWeek(x.dato).w+(x.overstyrt?' · flyttet (regel: '+datoNorsk(x.regelDato)+')':' · '+esc(x.regel))+(u?' · '+timer(u.min)+' planlagt':'')+'</span>'+
      (u&&u.oppg.length?'<br><span class="small">'+u.oppg.map(function(q){return q.o.ikon+' '+esc(q.o.navn)}).join(' · ')+'</span>':'')+'</div>';
    if(!passert){sh+='<div class="aa-btns"><button class="edit" data-ses="'+x.key+'" data-d="-7">◀ helga før</button><button class="edit" data-ses="'+x.key+'" data-d="7">helga etter ▶</button>'+(x.overstyrt?'<button class="edit" data-ses="'+x.key+'" data-d="0">↺ regel</button>':'')+'</div>'}
    else if(tb){sh+='<div class="small">Dere sa: <b>'+esc(tb.vekt)+'</b> · energi '+tb.energi+'/5</div>'}
    else {sh+='<div class="aa-btns">Hvordan var det? '+['for tungt','passe','for lett'].map(function(v){return '<button class="edit" data-tb="'+x.key+'" data-v="'+v+'">'+v+'</button>'}).join('')+' <select data-en="'+x.key+'" aria-label="Energi etterpå"><option value="">energi</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>'}
    sh+='</div>'});
  var se=document.getElementById('aa-ses'); se.innerHTML=sh||'<p class="small">Ingen sesonghelger i kalenderfila.</p>';
  Array.prototype.forEach.call(se.querySelectorAll('button[data-ses]'),function(b){b.onclick=function(){var x=ses.filter(function(q){return q.key===b.dataset.ses})[0];if(!x)return;var d=+b.dataset.d;
    if(!d){skriv('sesong/'+x.key,null);return} skriv('sesong/'+x.key,{dato:ymd(addDays(x.dato,d)),navn:x.navn,by:valgt||'familie',ts:new Date().toISOString()})}});
  Array.prototype.forEach.call(se.querySelectorAll('button[data-tb]'),function(b){b.onclick=function(){var sel=se.querySelector('select[data-en="'+b.dataset.tb+'"]');var en=sel&&sel.value?+sel.value:3;skriv('tilbake/'+b.dataset.tb,{vekt:b.dataset.v,energi:en,by:valgt||'familie',ts:new Date().toISOString()});toast('Takk — det tar Bjørn med til neste år')}});

  /* forslag */
  var fs=forslag(uker), fe=document.getElementById('aa-forslag');
  if(!fs.length)fe.innerHTML='<p class="small">Ingen uker over terskelen med noe som kan flyttes — planen holder.</p>';
  else{fe.innerHTML='<table class="tbl aa-tbl">'+fs.map(function(f){return '<tr><td>'+f.o.ikon+' '+esc(f.o.navn)+'<br><span class="small">uke '+f.fra.nr+' ('+timer(f.fra.min)+') → uke '+f.til.nr+' ('+timer(f.til.min)+(f.til.type==='vedl'?', sesonghelg':'')+')</span></td><td class="c"><button class="edit" data-fid="'+f.o.id+'" data-k="'+f.k+'">Flytt</button></td></tr>'}).join('')+'</table>';
    Array.prototype.forEach.call(fe.querySelectorAll('button[data-fid]'),function(b){b.onclick=function(){var o=OPPG.filter(function(x){return x.id===b.dataset.fid})[0];if(o)flyttDato(o,7*(+b.dataset.k))}})}

  /* innboksen */
  var ib=AARET.innboks||{}, keys=Object.keys(ib).sort(), ie=document.getElementById('aa-innboks-liste');
  ie.innerHTML=keys.length?'<table class="tbl aa-tbl">'+keys.map(function(k){return '<tr><td>'+esc(ib[k].tekst)+' <span class="small">'+esc(ib[k].by||'')+'</span></td><td class="c"><button class="edit" data-ib="'+k+'">✕</button></td></tr>'}).join('')+'</table>':'<p class="small">Innboksen er tom.</p>';
  Array.prototype.forEach.call(ie.querySelectorAll('button[data-ib]'),function(b){b.onclick=function(){skriv('innboks/'+b.dataset.ib,null)}});
}
function tile(v,lab,sub){return '<div class="aa-tile"><b>'+v+'</b><span>'+lab+'</span><small>'+sub+'</small></div>'}

/* ---------- oppstart ---------- */
function init(){
  var l=lsGet(); if(l){AARET=Object.assign(AARET,l)}
  fetch('data/kalender.json?v='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j)KAL=Object.assign(KAL,j);tegnAaret()}).catch(function(){tegnAaret()});
  var f=document.getElementById('aa-innboks-form'); if(f){f.onsubmit=function(ev){ev.preventDefault();var t=document.getElementById('aa-innboks-tekst');var v=t.value.trim();if(!v)return;
    skriv('innboks/i'+Date.now(),{tekst:v,by:valgt||'familie',ts:new Date().toISOString()});t.value='';toast('📥 Lagt i innboksen — Bjørn sorterer')}}
  /* abonner når delt lagring er oppe (db settes av index.html) */
  var iv=setInterval(function(){if(abonnert)return clearInterval(iv);if(window.db&&window.dbOk){abonnert=true;clearInterval(iv);
    db.child('aaret').on('value',function(snap){var v=snap.val()||{};AARET={terskel:v.terskel||AARET.terskel||180,helg:v.helg||{},sesong:v.sesong||{},tilbake:v.tilbake||{},innboks:v.innboks||{}};lsSet();tegnAaret()})}},800);
  /* tegn når hovedappen tegner */
  var orig=window.tegn; if(typeof orig==='function'&&!orig.__aa){window.tegn=function(){orig();tegnAaret()};window.tegn.__aa=true}
  tegnAaret();
}
window.tegnAaret=tegnAaret;
/* for Ukesjekken/Bjørn: øyeblikksbilde av året (52 uker) og sesonghelgene */
window.aaretData=function(){return {uker:alleUker().map(function(u){return {key:u.key,nr:u.nr,man:ymd(u.man),min:u.min,type:u.type,hvorfor:u.hvorfor,oppg:u.oppg.map(function(x){return x.o.ikon+' '+x.o.navn})}}),sesong:sesongListe().map(function(s){return {id:s.id,key:s.key,navn:s.navn,dato:ymd(s.dato),overstyrt:s.overstyrt}}),terskel:AARET.terskel,etterslep:etterslep()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
