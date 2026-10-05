(function () {
  'use strict';
  const E = window.BidBlitzRunner;
  const KEY = 'bidblitz.blitz-runner.preview.v1';
  const $ = id => document.getElementById(id);
  const seed = () => { const values=new Uint32Array(1);crypto.getRandomValues(values);return values[0]||42; };
  let raw=null,storageOK=true;
  try{raw=localStorage.getItem(KEY);}catch{storageOK=false;}
  let profile=E.decode(raw)||E.initial(seed());

  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(profile));storageOK=true;}catch{storageOK=false;}
    $('save-note').textContent=storageOK?'Fortschritt wird lokal gespeichert.':'Lokales Speichern ist hier nicht verfügbar.';
  }

  function startLevel(level){
    const result=E.begin(profile,level,seed());
    if(!result.ok)return;
    profile=result.profile;persist();render();
    $('status').textContent='Strecke gestartet. Wähle für jeden Abschnitt deine Spur.';
  }

  function previewSegments(){
    const box=$('segments');box.replaceChildren();
    const game=profile.active;
    for(let offset=0;offset<6;offset++){
      const index=game.position+offset;if(index>=game.course.length)break;
      const segment=game.course[index];
      const top=38+offset*55,scale=0.55+offset*0.09;
      for(const [type,lane] of [['obstacle',segment.obstacle],['shard',segment.shard]]){
        if(lane<0)continue;
        const node=document.createElement('div');
        node.className='segment '+type;
        node.style.left=(lane*33.333)+'%';node.style.top=top+'px';node.style.transform='scale('+scale+')';
        box.append(node);
      }
    }
  }

  function renderLevels(){
    $('level-list').replaceChildren();
    E.levels.forEach(spec=>{
      const b=document.createElement('button');b.type='button';b.textContent=spec.number;b.disabled=spec.number>profile.unlocked;
      if(spec.number===profile.active.level)b.classList.add('active');
      if(profile.best[spec.number-1])b.classList.add('done');
      b.addEventListener('click',()=>startLevel(spec.number));$('level-list').append(b);
    });
  }

  function renderResult(){
    const game=profile.active,won=game.status==='won';
    $('result').hidden=game.status==='playing';if(game.status==='playing')return;
    const stars=E.starsFor(game);
    $('result-stars').textContent=won?'★'.repeat(stars):'✕';
    $('result-title').textContent=won?'Strecke geschafft!':'Kollision';
    $('result-text').textContent=won
      ? game.score.toLocaleString('de-DE')+' Punkte · '+game.shards+' Lichtpunkte'
      : 'Du bist auf ein Hindernis getroffen. Wähle die Spur vor dem nächsten Abschnitt neu.';
    const next=Math.min(E.LEVEL_COUNT,game.level+1);
    $('next').hidden=!won||game.level>=E.LEVEL_COUNT;$('next').textContent='Weiter zu Level '+next;$('next').onclick=()=>startLevel(next);
    $('restart').onclick=()=>startLevel(game.level);
  }

  function render(){
    const game=profile.active,spec=E.levels[game.level-1];
    $('level').textContent=game.level;$('zone').textContent=spec.zone;
    $('distance').textContent=game.position+' / '+game.course.length;
    $('shards').textContent=game.shards;$('best').textContent=profile.best[game.level-1]?profile.best[game.level-1].toLocaleString('de-DE'):'—';
    $('runner').className='runner lane-'+game.lane;
    previewSegments();renderLevels();renderResult();
    const disabled=game.status!=='playing';$('left').disabled=disabled;$('straight').disabled=disabled;$('right').disabled=disabled;
  }

  function move(direction){
    const result=E.advance(profile.active,direction);
    if(!result.ok)return;
    profile=E.complete(profile,result.state);persist();render();
    if(result.collision)$('status').textContent='Kollision! Starte das Level neu und wechsle früher die Spur.';
    else if(result.state.status==='won')$('status').textContent='Ziel erreicht!';
    else $('status').textContent=result.collected?'Lichtpunkt gesammelt!':'Sauberer Abschnitt.';
  }

  $('left').addEventListener('click',()=>move(-1));$('straight').addEventListener('click',()=>move(0));$('right').addEventListener('click',()=>move(1));
  window.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}else if(event.key==='ArrowRight'){event.preventDefault();move(1);}else if(event.key==='ArrowUp'||event.key===' '){event.preventDefault();move(0);}});
  window.BidBlitzRunnerPreview={snapshot:()=>JSON.parse(JSON.stringify(profile)),startLevel,move};
  persist();render();
  if(raw&&!E.decode(raw))$('status').textContent='Der gespeicherte Stand war ungültig. Ein neuer Lauf wurde gestartet.';
}());