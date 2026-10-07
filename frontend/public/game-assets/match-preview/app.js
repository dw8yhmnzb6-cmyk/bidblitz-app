(function () {
  'use strict';
  const E = window.BidBlitzMatch, S = window.BidBlitzMatchProgressSync, KEY = 'bidblitz.match.preview.v1', PROGRESS_API = '/api/games/progress/match';
  const INTEGRITY_SESSION_API = '/api/games/integrity/match/sessions', INTEGRITY_VERIFY_API = '/api/games/integrity/match/verify';
  const $ = id => document.getElementById(id);
  const names = ['Blauer Diamant','Grüner Kreis','Goldener Stern','Roter Rubin','Violettes Sechseck','Oranger Tropfen'];
  const colors = ['#65c7fa','#82ddad','#f7d887','#fc859b','#c1a0fa','#ffb376'];
  const shapes = ['<path d="M20 3 36 20 20 37 4 20Z"/><path d="m20 3-7 17 7 17 7-17Z" opacity=".3" fill="white"/>','<circle cx="20" cy="20" r="16"/><circle cx="16" cy="15" r="7" opacity=".2" fill="white"/>','<path d="m20 2 5.6 11.7 13 1.9-9.4 9.1 2.2 12.9L20 31.5 8.6 37.6l2.2-12.9-9.4-9.1 13-1.9Z"/>','<rect x="6" y="6" width="28" height="28" rx="8"/><path d="M11 13h18" fill="none" stroke="white" opacity=".3" stroke-width="3"/>','<path d="M12 4h16l9 16-9 16H12L3 20Z"/><path d="M12 4 20 20 3 20" fill="white" opacity=".25"/>','<path d="M20 2C16 10 6 18 6 25a14 14 0 0 0 28 0C34 18 24 10 20 2Z"/><path d="M13 22q-4 8 4 10" fill="none" stroke="white" stroke-width="3" opacity=".25"/>'];
  const seed = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] || 42; };
  $('board').style.touchAction = 'none';
  let raw = null, storageOK = true;
  try { raw = localStorage.getItem(KEY); } catch { storageOK = false; }
  let profile = E.decode(raw) || E.initial(seed()), selected = null, busy = false, stale = false, pointer = null;
  let verification = null, starting = false;
  const restored = raw && E.decode(raw);
  profile = E.refreshEnergy(profile);
  let accountSync = 'pending', syncActive = false, syncQueued = false;
  function updateStorageNote(){
    const note=$('storage-note');
    if(!storageOK){note.textContent='Speichern ist hier nicht verfügbar. Fortschritt bleibt nur bis zum Schließen erhalten.';return;}
    if(accountSync==='account'){note.textContent='Level, Sterne und Bestwerte werden im BidBlitz-Konto synchronisiert. Laufendes Spielfeld, Leben und Testmünzen bleiben auf diesem Gerät.';return;}
    if(accountSync==='error'){note.textContent='Lokaler Fortschritt gespeichert. Kontosynchronisierung ist vorübergehend nicht verfügbar.';return;}
    if(accountSync==='pending'){note.textContent='Lokaler Fortschritt gespeichert. Kontosynchronisierung wird geprüft.';return;}
    note.textContent='Fortschritt wird auf diesem Gerät gespeichert.';
  }
  async function syncAccountProgress(){
    if(!S||stale)return;
    if(syncActive){syncQueued=true;return;}
    syncActive=true;syncQueued=false;
    try{
      const current=await fetch(PROGRESS_API,{credentials:'include'});
      if(current.status===401||current.status===403){accountSync='guest';updateStorageNote();return;}
      if(!current.ok)throw new Error('progress-load');
      const remote=await current.json();
      const merged=S.merge(profile,remote);
      if(merged.changed){profile=merged.profile;persist();render();}
      const savedResponse=await fetch(PROGRESS_API,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(S.summary(profile))});
      if(!savedResponse.ok)throw new Error('progress-save');
      const saved=await savedResponse.json();
      const confirmed=S.merge(profile,saved);
      if(confirmed.changed){profile=confirmed.profile;persist();render();}
      accountSync='account';updateStorageNote();
    }catch{
      accountSync='error';updateStorageNote();
    }finally{
      syncActive=false;
      if(syncQueued){syncQueued=false;queueMicrotask(syncAccountProgress);}
    }
  }
  async function requestIntegritySession(level){
    verification=null;
    let runSeed=seed();
    try{
      const response=await fetch(INTEGRITY_SESSION_API,{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({level})
      });
      if(response.ok){
        const session=await response.json();
        if(session&&typeof session.session_id==='string'&&Number.isInteger(session.seed)){
          runSeed=session.seed;
          verification={sessionId:session.session_id,actions:[]};
        }
      }
    }catch{}
    return runSeed;
  }

  async function verifyMatchRun(){
    if(!verification)return;
    const pending=verification;
    verification=null;
    try{
      const response=await fetch(INTEGRITY_VERIFY_API,{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({session_id:pending.sessionId,actions:pending.actions})
      });
      if(!response.ok)throw new Error('integrity');
      const body=await response.json();
      notice(body&&body.verified
        ? 'Level geschafft! Ergebnis serverseitig reproduziert.'
        : 'Level geschafft. Server-Prüfung nicht bestätigt.');
    }catch{
      notice('Level geschafft. Server-Prüfung nicht verfügbar.');
    }
  }

  const buttons = [];
  for(let i=0;i<64;i++){const b=document.createElement('button');b.type='button';b.className='tile';b.dataset.cell=i;b.addEventListener('click',()=>choose(i));b.addEventListener('pointerdown',ev=>{pointer={index:i,x:ev.clientX,y:ev.clientY};});b.addEventListener('keydown',ev=>{const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[ev.key];if(delta&&E.adjacent(i,i+delta)){ev.preventDefault();buttons[i+delta].focus();}});$('board').append(b);buttons.push(b);}
  let suppressClick = false;
  $('board').addEventListener('pointerup',ev=>{if(!pointer)return;const p=pointer;pointer=null;const dx=ev.clientX-p.x,dy=ev.clientY-p.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;const dest=p.index+(Math.abs(dx)>Math.abs(dy)?Math.sign(dx):Math.sign(dy)*8);suppressClick=true;setTimeout(()=>suppressClick=false,0);if(E.adjacent(p.index,dest))play(p.index,dest);});
  $('board').addEventListener('pointercancel',()=>pointer=null);
  function notice(t){$('status').textContent=t;}
  function persist(){if(stale)return false;try{localStorage.setItem(KEY,JSON.stringify(profile));storageOK=true;}catch{storageOK=false;}updateStorageNote();return storageOK;}
  function draw(board=profile.active.board,clear=[]){const active=profile.active;buttons.forEach((b,i)=>{const v=board[i],t=E.color(v),k=E.kind(v);const mark=['','↔','↕','✹','✦'][k];b.innerHTML='<svg viewBox="0 0 40 40" aria-hidden="true" fill="'+(colors[t]||'#fff')+'">'+(shapes[t]||shapes[2])+'</svg>'+(k?'<span class="special-mark" aria-hidden="true">'+mark+'</span>':'');b.className='tile'+(selected===i?' selected':'')+(active.ice.includes(i)?' ice':'')+(clear.includes(i)?' clearing':'');b.setAttribute('aria-label','Zeile '+(Math.floor(i/8)+1)+', Spalte '+(i%8+1)+': '+(names[t]||'Farbstern')+(k?', '+['','Zeilenblitz','Spaltenblitz','Flächenblitz','Farbstern'][k]:'')+(active.ice.includes(i)?', Eis':''));b.setAttribute('aria-pressed',String(selected===i));b.disabled=busy||stale||active.status!=='playing';});}
  function render(){const s=profile.active,c=E.levels[s.level-1];$('coins').textContent=profile.coins;$('world').textContent=c.world;$('world-progress').textContent='Level '+s.level+' von 30';document.querySelector('.world-number').textContent=String(Math.ceil(s.level/10)).padStart(2,'0');$('level-name').textContent='Level '+String(s.level).padStart(2,'0');$('theme-name').textContent=c.world;$('moves').textContent=s.moves;$('score').textContent=s.score.toLocaleString('de-DE');$('target').textContent=c.target.toLocaleString('de-DE');$('best').textContent=profile.best[s.level-1]||'—';$('progress').style.width=Math.min(100,100*s.score/c.target)+'%';$('reward').textContent=profile.best[s.level-1]?'Bereits erhalten':'+'+(50+s.level*5)+' ◈';$('extra-goals').hidden=!c.blue&&!c.ice;$('extra-goals').textContent=(c.blue?'Blaue Diamanten: '+Math.min(s.blue,c.blue)+' / '+c.blue:'')+(c.ice?' · Eisfelder: '+s.ice.length+' übrig':'');$('level-list').replaceChildren();E.levels.forEach(l=>{const b=document.createElement('button');b.textContent=l.number;b.className=(l.number===s.level?'active ':'')+(profile.best[l.number-1]?'done':'');b.disabled=l.number>profile.unlocked||busy||stale;b.setAttribute('aria-label','Level '+l.number+(l.number>profile.unlocked?' gesperrt':''));if(l.number===s.level)b.setAttribute('aria-current','step');b.addEventListener('click',()=>{if(l.number===s.level)return;confirmStart(l.number);});$('level-list').append(b);});$('hint').disabled=busy||stale||s.status!=='playing';$('shuffle').disabled=busy||stale||s.status!=='playing'||profile.coins<50;$('extra').disabled=busy||stale||s.status==='won'||profile.coins<100;$('restart').disabled=busy||stale;draw();document.dispatchEvent(new CustomEvent('bidblitz:progress'));}
  function modal(title,build){$('modal-title').textContent=title;$('modal-content').replaceChildren();build($('modal-content'));if(!$('modal').open)$('modal').showModal();}
  function text(parent,t,cls=''){const p=document.createElement('p');p.className=cls;p.textContent=t;parent.append(p);return p;}
  function action(parent,label,fn,secondary=false){const b=document.createElement('button');b.className=secondary?'secondary':'primary';b.textContent=label;b.addEventListener('click',fn);parent.append(b);return b;}
  function lifeText(){const ms=E.lifeWait(profile);const seconds=Math.ceil(ms/1000);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
  function lifeInfo(){profile=E.refreshEnergy(profile);modal('Deine Leben',p=>{text(p,profile.energy.count+' von 5 Leben verfügbar.');text(p,'Ein verlorener oder nach dem ersten Zug abgebrochener Versuch kostet ein Leben. Ein Leben lädt sich alle 30 Minuten auf — maximal fünf.');if(profile.energy.count<5)text(p,'Nächstes Leben in '+lifeText()+'.');text(p,'In dieser Vorschau wird die Gerätezeit verwendet. Leben werden nicht verkauft.');action(p,'Verstanden',()=>$('modal').close());});}
  async function start(level){if(busy||stale||starting||level>profile.unlocked)return;starting=true;try{const runSeed=await requestIntegritySession(level);const result=E.begin(profile,level,runSeed);profile=result.profile;selected=null;persist();render();if(!result.ok){verification=null;lifeInfo();notice(result.reason);return;}$('modal').close();notice(verification?'Level gestartet. Dieser Versuch kann serverseitig nachgespielt werden.':level===1?'Tippe zwei benachbarte Symbole an und bilde eine Dreierreihe.':'Erreiche alle Ziele, bevor deine Züge aufgebraucht sind.');}finally{starting=false;}}
  function confirmStart(level){if(busy||stale||level>profile.unlocked)return;const spec=E.levels[level-1];const abandoning=profile.active.turns>0&&profile.active.status==='playing';modal('Level '+level+' · '+spec.world,p=>{text(p,'Deine Ziele in '+spec.moves+' Zügen:');const goals=document.createElement('ul');goals.className='level-goals';for(const goal of [spec.target+' Punkte',spec.blue?spec.blue+' blaue Diamanten sammeln':null,spec.ice?spec.ice+' Eisfelder entfernen':null].filter(Boolean)){const li=document.createElement('li');li.textContent=goal;goals.append(li);}p.append(goals);if(abandoning)text(p,'Der laufende Versuch wird abgebrochen. Das kostet ein Leben. Bei deinem letzten Leben musst du anschließend auf die Auffüllung warten.');else text(p,'Ein verlorener Versuch kostet ein Leben. Ungültige Tauschaktionen kosten keinen Zug.');action(p,abandoning?'Versuch beenden und neu starten':'Level starten',()=>start(level));action(p,abandoning?'Weiterspielen':'Zurück',()=>$('modal').close(),true);});}
  function enterGame(){if(busy||stale)return;if(profile.active.status!=='playing')showResult();else if(profile.active.turns===0)confirmStart(profile.active.level);}
  function choose(i){if(busy||stale||suppressClick||profile.active.status!=='playing')return;if(selected===null){selected=i;draw();return;}if(selected===i){selected=null;draw();return;}if(!E.adjacent(selected,i)){selected=i;draw();return;}const a=selected;selected=null;play(a,i);}
  const wait = ms => new Promise(r=>setTimeout(r,ms));
  async function play(a,b){if(busy||stale)return;selected=null;const result=E.swap(profile.active,a,b);if(!result.ok){draw();notice('Dieser Tausch bildet keine Dreierreihe. Du verlierst keinen Zug.');return;}if(verification)verification.actions.push({a,b});busy=true;profile=E.complete(profile,result.state);persist();render();if(profile.active.status==='won'){syncAccountProgress();if(verification)verifyMatchRun();}else if(profile.active.status==='lost'){verification=null;}const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;for(const frame of result.frames){draw(frame.board,frame.clear);if(frame.combo>1){$('combo').textContent=frame.combo+'× Kettenreaktion';$('combo').classList.add('visible');}if(!reduced)await wait(180);}busy=false;$('combo').classList.remove('visible');render();if(stale)return;if(profile.active.status==='playing')notice(result.reshuffled?'Keine weiteren Züge möglich: Feld kostenlos erneuert.':result.combo>1?result.combo+' Kettenreaktionen! Dein Fortschritt ist gespeichert.':'Guter Zug. Weiter so!');if(profile.active.status!=='playing')showResult();}
  function showResult(){const s=profile.active;if(s.status==='won')modal(s.level===30?'Alle 30 Level geschafft!':'Level geschafft!',p=>{const stars=document.createElement('div');stars.className='result-stars';stars.textContent='★'.repeat(profile.stars[s.level-1]);p.append(stars);text(p,s.score.toLocaleString('de-DE')+' Punkte · '+s.moves+' Züge übrig.');text(p,'Der Fortschritt ist gespeichert. Spielmünzen haben keinen Geldwert.');action(p,s.level<30?'Weiter zu Level '+(s.level+1):'Level 30 erneut spielen',()=>confirmStart(Math.min(30,s.level+1)));action(p,'Spielfeld ansehen',()=>$('modal').close(),true);});else modal('Die Züge sind aufgebraucht.',p=>{text(p,'Ein Leben wurde für diesen Versuch abgezogen. Starte mit einem verfügbaren Leben erneut oder setze diesen Versuch mit 5 zusätzlichen Zügen fort.');action(p,'Erneut versuchen',()=>confirmStart(s.level));const b=action(p,'5 Züge · 100 Spielmünzen',()=>buy('moves'),true);b.disabled=profile.coins<100;});}
  function buy(product){if(busy||stale)return;const id=crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+seed();const r=E.purchase(profile,product,id);if(!r.ok){notice(r.reason);return;}verification=null;profile=r.profile;persist();$('modal').close();render();notice((product==='moves'?'5 Züge hinzugefügt. 100 Spielmünzen abgezogen.':'Spielfeld erneuert. 50 Spielmünzen abgezogen.')+' Dieser Versuch ist nicht server-verifiziert.');}
  function askBuy(product){const price=product==='moves'?100:50;modal(product==='moves'?'5 zusätzliche Züge':'Spielfeld neu mischen',p=>{text(p,(product==='moves'?'Dein aktuelles Level erhält 5 weitere Züge.':'Die Symbole werden erneuert. Spezialtypen bleiben erhalten, ihre Position und Farbe können wechseln. Punkte, Züge und Eisfelder bleiben erhalten.')+' Kosten: '+price+' Spielmünzen.');text(p,'Keine Zahlung mit echtem Geld.');action(p,'Für '+price+' Spielmünzen bestätigen',()=>buy(product));action(p,'Abbrechen',()=>$('modal').close(),true);});}
  $('hint').addEventListener('click',()=>{if(busy||stale)return;selected=null;draw();const pair=E.hint(profile.active.board);if(pair){pair.forEach(i=>buttons[i].classList.add('hinted'));notice('Tausche die beiden goldenen Felder für ein Match oder eine Spezialkombination.');}});
  $('shuffle').addEventListener('click',()=>askBuy('shuffle'));$('extra').addEventListener('click',()=>askBuy('moves'));
  $('restart').addEventListener('click',()=>confirmStart(profile.active.level));
  $('modal-close').addEventListener('click',()=>$('modal').close());
  $('help-open').addEventListener('click',()=>modal('Dein nächster guter Zug.',p=>{text(p,'Tippe zwei benachbarte Symbole an oder wische ein Symbol in eine Richtung. Drei gleiche Symbole bilden ein Match.');text(p,'Vier in einer Linie erzeugen einen Linienblitz. T- und L-Matches erzeugen einen Flächenblitz. Fünf in einer Linie erzeugen einen Farbstern. Diese Steine bleiben liegen, bis du sie aktivierst. Kombiniere zwei Spezialsteine für größere Effekte; tausche einen Farbstern mit der gewünschten Farbe.');text(p,'Ab Level 11 sammelst du blaue Diamanten. Ab Level 21 löst du zusätzlich Eisfelder. Bei einer ungültigen Bewegung verlierst du keinen Zug.');text(p,'Tastatur: Tab wählt ein Feld, Pfeiltasten bewegen den Fokus, Enter wählt ein Symbol.');action(p,'Los geht’s',()=>$('modal').close());}));
  function wallet(){modal('Deine Spielmünzen',p=>{const b=document.createElement('div');b.className='balance';b.textContent=profile.coins+' ◈';p.append(b);text(p,'Lokale Testmünzen ohne Geldwert. Keine echte Aufladung, keine Auszahlung und keine Verbindung zur BidBlitz-Wallet.');action(p,'250 Testmünzen hinzufügen',()=>{if(stale)return;profile.coins+=250;profile.revision++;profile.receipts.unshift({label:'Testmünzen hinzugefügt',amount:250});profile.receipts=profile.receipts.slice(0,12);persist();render();wallet();});text(p,'Letzte Vorgänge');for(const r of profile.receipts){const row=document.createElement('div');row.className='receipt';const a=document.createElement('span'),v=document.createElement('span');a.textContent=r.label;v.textContent=(r.amount>0?'+':'')+r.amount+' ◈';row.append(a,v);p.append(row);}if(!profile.receipts.length)text(p,'150 Startmünzen sind bereits enthalten.');});}
  $('wallet-open').addEventListener('click',wallet);
  window.addEventListener('storage',ev=>{if(ev.key===KEY){stale=true;render();$('modal').close();modal('Fortschritt in anderem Tab geändert',p=>{text(p,'Lade diesen Tab neu, um mit dem neuesten Spielstand weiterzuspielen.');action(p,'Aktuellen Stand laden',()=>location.reload());});}});
  window.BidBlitzPreview={snapshot:()=>JSON.parse(JSON.stringify(profile)),wallet,enterGame,lifeInfo,openLevel:confirmStart,startLevel:start,move:play,shop:askBuy,syncProgress:syncAccountProgress,isBusy:()=>busy||stale};
  persist();render();syncAccountProgress();if(raw&&!restored)notice('Der gespeicherte Stand war nicht lesbar. Ein neuer Spielstand wurde erstellt.');else if(restored)notice('Willkommen zurück. Dein letzter Spielstand wurde geladen.');
  function updateLives(){if(stale)return;const previous=profile.energy.count;profile=E.refreshEnergy(profile);$('life-count').textContent=profile.energy.count+'/5';$('life-timer').textContent=profile.energy.count===5?'Voll':lifeText();if(previous!==profile.energy.count){profile.revision++;persist();render();}}
  $('lives-open').addEventListener('click',lifeInfo);updateLives();setInterval(updateLives,1000);
}());
