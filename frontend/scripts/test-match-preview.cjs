const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/game-assets/match-preview/engine.js');
const B = require('../public/game-assets/bubble-islands/engine.js');

test('Every level starts without matches and with an available move across 240 fixtures', () => {
  for (let level=1;level<=30;level++) for(let seed=1;seed<=8;seed++) {
    const g=E.createGame(level,seed);assert.equal(E.groups(g.board).length,0);assert.ok(E.hint(g.board));assert.equal(g.ice.length,E.levels[level-1].ice);
  }
});
test('Invalid, non-neighbour and row-wrapping swaps leave all state untouched',()=>{
  const g=E.createGame(1,7),before=JSON.stringify(g);
  for(const pair of [[7,8],[-1,0],[0,63],[1.5,2],[0,0]])assert.equal(E.swap(g,...pair).ok,false);
  assert.equal(JSON.stringify(g),before);
});
test('Valid actions consume one move and settle; saves round-trip over every level',()=>{
  for(let level=1;level<=30;level++){
    let p=E.initial(level*34);p.unlocked=level;p.active=E.createGame(level,level*34);
    for(let turn=0;turn<12&&p.active.status==='playing';turn++){
      const old=JSON.stringify(p.active),moves=p.active.moves;
      const r=E.swap(p.active,...E.hint(p.active.board));assert.ok(r.ok);assert.equal(r.state.moves,moves-1);assert.ok(r.state.score>p.active.score);assert.equal(JSON.stringify(p.active),old);
      assert.equal(E.groups(r.state.board).length,0);assert.ok(E.hint(r.state.board));p=E.complete(p,r.state);assert.ok(E.decode(JSON.stringify(p)));
    }
  }
});
function fixture(){const g=E.createGame(1,10);g.board=Array.from({length:64},(_,i)=>(Math.floor(i/8)*2+i%8)%6);return g;}
test('Four and five matches create a persistent line or color special without clearing its cell',()=>{
  for(const len of [4,5]){
    const g=fixture();for(let c=0;c<len;c++)g.board[8+c]=0;
    g.board[8+len]=2;g.board[8+len-1]=1;g.board[16+len-1]=0;
    const r=E.swap(g,16+len-1,8+len-1);assert.ok(r.ok);
    const special=r.frames[0].created.find(x=>x.at===8+len-1);assert.ok(special);
    assert.equal(E.kind(special.value),len===4?1:4);assert.ok(!r.frames[0].clear.includes(special.at));
    assert.ok(r.frames[1]?.board.includes(special.value)||r.state.board.includes(special.value));
  }
});
test('T shape creates an area special',()=>{
 const g=fixture();for(const i of [10,17,19,26,34])g.board[i]=0;g.board[18]=1;g.board[42]=3;
 assert.equal(E.groups(g.board).length,0);
 const r=E.swap(g,10,18);assert.ok(r.ok);assert.ok(r.frames[0].created.some(x=>E.kind(x.value)===3));
});
test('Color special selects exactly the swapped color in first clear',()=>{
 const g=fixture();g.board[0]=24;g.board[1]=2;
 const r=E.swap(g,0,1);assert.ok(r.ok);assert.equal(r.state.moves,g.moves-1);
 const swapped=g.board.slice();[swapped[0],swapped[1]]=[swapped[1],swapped[0]];
 assert.deepEqual([...r.frames[0].clear].sort((a,b)=>a-b),swapped.map((v,i)=>v===2||i===1?i:-1).filter(i=>i>=0));
});
test('Two color specials clear every cell once and remove all ice',()=>{
 const g=fixture();g.board[0]=24;g.board[1]=24;g.ice=[0,7,63];
 const r=E.swap(g,0,1);assert.equal(r.frames[0].clear.length,64);assert.deepEqual(r.state.ice,[]);
});
test('Line specials chain into area specials and stay within the board',()=>{
 const g=fixture();g.board[0]=6;g.board[1]=12;g.board[7]=18;
 const r=E.swap(g,0,1);assert.ok(r.ok);
 for(const i of [0,1,2,3,4,5,6,7,14,15,57])assert.ok(r.frames[0].clear.includes(i));
 assert.equal(new Set(r.frames[0].clear).size,r.frames[0].clear.length);
 assert.ok(r.frames.every(f=>f.clear.every(i=>i>=0&&i<64)));
});
test('Saved special stones survive decoding and shuffling preserves their types',()=>{
 const p=E.initial(4);p.active.board[0]+=6;p.active.board[1]+=12;p.active.board[2]=24;
 const restored=E.decode(JSON.stringify(p));assert.ok(restored);assert.deepEqual(restored.active.board,p.active.board);
 const r=E.purchase(p,'shuffle','preserve-specials');assert.ok(r.ok);
 assert.deepEqual(r.profile.active.board.filter(v=>E.kind(v)).map(E.kind).sort(),[1,2,4]);
});
test('Same starting seed and same action produce same result',()=>{
 const g=E.createGame(12,7654321),pair=E.hint(g.board);assert.deepEqual(E.swap(g,...pair),E.swap(g,...pair));
});
test('Completing and replaying a level rewards only the first completion',()=>{
 let p=E.initial(1);let g={...p.active,status:'won',score:1000};p=E.complete(p,g);assert.equal(p.coins,205);assert.equal(p.unlocked,2);assert.equal(E.complete(p,g).coins,205);
});
test('Buying moves debits 100 once; duplicate purchase does not debit again',()=>{
 const p=E.initial(1),r=E.purchase(p,'moves','request-one');assert.ok(r.ok);assert.equal(r.profile.coins,50);assert.equal(r.profile.active.moves,p.active.moves+5);assert.equal(p.coins,150);
 const again=E.purchase(r.profile,'moves','request-one');assert.ok(again.duplicate);assert.deepEqual(again.profile,r.profile);assert.equal(E.purchase(r.profile,'moves','request-two').ok,false);
});
test('Shuffle preserves score, remaining moves and ice while deducting only its price',()=>{
 const p=E.initial(1);p.unlocked=21;p.active=E.createGame(21,77);p.active.score=500;
 const r=E.purchase(p,'shuffle','shuffle-one');assert.ok(r.ok);assert.equal(r.profile.coins,100);assert.equal(r.profile.active.score,500);assert.equal(r.profile.active.moves,p.active.moves);assert.deepEqual(r.profile.active.ice,p.active.ice);assert.ok(E.hint(r.profile.active.board));
});
test('Malformed save data is rejected instead of crashing or accepting a negative balance',()=>{
 assert.equal(E.decode('{'),null);assert.equal(E.decode('null'),null);
 for(const mutate of [p=>p.coins=-1,p=>p.active.board[0]=99,p=>p.active.ice=[-1],p=>p.active.level=31,p=>p.active.status='won',p=>p.receipts=[{label:'x',amount:'1'}]]){let p=E.initial(1);mutate(p);assert.equal(E.decode(JSON.stringify(p)),null);}
});
test('Won and lost rounds cannot spend additional moves through swapping',()=>{
 for(const status of ['won','lost']){let g=E.createGame(1,1);g.status=status;assert.equal(E.swap(g,...E.hint(g.board)).ok,false);}
});

test('A failed attempt costs one life even when its result is processed twice',()=>{
 const p=E.initial(15,1000),g={...p.active,moves:0,status:'lost'};
 const once=E.complete(p,g,2000),twice=E.complete(once,g,2000);
 assert.equal(once.energy.count,4);assert.equal(once.energy.anchor,2000);
 assert.equal(twice.energy.count,4);assert.equal(p.energy.count,5);
 assert.ok(E.decode(JSON.stringify(once)));
});
test('Lives refill at exact 30 minute boundaries and cap at five',()=>{
 let p=E.initial(1,1000);p.energy={count:2,anchor:1000};
 assert.equal(E.refreshEnergy(p,1000+E.LIFE_INTERVAL-1).energy.count,2);
 let r=E.refreshEnergy(p,1000+E.LIFE_INTERVAL);assert.equal(r.energy.count,3);
 assert.equal(E.lifeWait(r,1000+E.LIFE_INTERVAL),E.LIFE_INTERVAL);
 r=E.refreshEnergy(p,1000+20*E.LIFE_INTERVAL);assert.equal(r.energy.count,5);assert.equal(E.lifeWait(r,1000+20*E.LIFE_INTERVAL),0);
});
test('A backward clock neither creates lives nor moves the recovery anchor backwards',()=>{
 const p=E.initial(1,10000);p.energy.count=2;
 const r=E.refreshEnergy(p,5000);assert.deepEqual(r.energy,p.energy);assert.equal(E.lifeWait(r,5000),E.LIFE_INTERVAL+5000);
});
test('Old saved profiles gain lives without losing coins, progress or current attempt',()=>{
 const p=E.initial(42,1000);delete p.energy;delete p.active.roundId;delete p.active.lifeCharged;
 p.coins=987;p.best[0]=900;p.unlocked=2;
 const decoded=E.decode(JSON.stringify(p));assert.ok(decoded);
 const r=E.refreshEnergy(decoded,10000);assert.equal(r.energy.count,5);assert.equal(r.coins,987);assert.equal(r.unlocked,2);assert.deepEqual(r.active.board,p.active.board);assert.ok(r.active.roundId);
});
test('Abandoning an active attempt uses its last life once and blocks a new attempt until refill',()=>{
 const p=E.initial(1,1000);p.energy.count=1;p.active.turns=1;
 const r=E.begin(p,1,2,1000);assert.equal(r.ok,false);assert.equal(r.profile.energy.count,0);assert.equal(r.profile.active.status,'lost');assert.ok(E.decode(JSON.stringify(r.profile)));
 const again=E.begin(r.profile,1,3,1000);assert.equal(again.ok,false);assert.equal(again.profile.energy.count,0);
 const recovered=E.begin(again.profile,1,4,1000+E.LIFE_INTERVAL);assert.ok(recovered.ok);assert.equal(recovered.profile.energy.count,1);assert.equal(recovered.profile.active.status,'playing');
});
test('An untouched attempt costs no life to restart and locked levels do not abandon it',()=>{
 const p=E.initial(2,1000);let r=E.begin(p,1,3,1000);assert.ok(r.ok);assert.equal(r.profile.energy.count,5);
 r.profile.active.turns=1;const before=JSON.stringify(r.profile);const locked=E.begin(r.profile,2,4,1000);assert.equal(locked.ok,false);assert.equal(JSON.stringify(locked.profile),before);
});
test('Continuing a failed attempt with extra moves does not charge its life again',()=>{
 const p=E.initial(3,1000);const failed=E.complete(p,{...p.active,status:'lost',moves:0},1000);
 const continued=E.purchase(failed,'moves','continue-life-test');assert.ok(continued.ok);
 const lostAgain=E.complete(continued.profile,{...continued.profile.active,moves:0,status:'lost'},1000);
 assert.equal(lostAgain.energy.count,4);assert.equal(lostAgain.coins,50);
});
test('Corrupted lives and recovery timestamps are rejected',()=>{
 for(const mutate of [p=>p.energy.count=-1,p=>p.energy.count=6,p=>p.energy.anchor=-1,p=>p.energy.anchor='tomorrow',p=>p.active.lifeCharged='yes']){
 const p=E.initial(1,1000);mutate(p);assert.equal(E.decode(JSON.stringify(p)),null);
 }
});

test('Bubble Islands starts all 20 levels with at least one valid group',()=>{
  for(let level=1;level<=B.LEVEL_COUNT;level++) for(let seed=1;seed<=6;seed++){
    const game=B.createGame(level,seed);
    assert.equal(game.board.length,B.SIZE);
    assert.ok(B.hasMove(game.board));
    assert.ok(B.groups(game.board).some(group=>group.length>=2));
    assert.equal(game.moves,B.levels[level-1].moves);
  }
});

test('Bubble Islands is deterministic for the same level and seed',()=>{
  assert.deepEqual(B.createGame(7,123456),B.createGame(7,123456));
});

test('Bubble Islands pop scores group squared, spends one move and preserves input',()=>{
  const game=B.createGame(1,77);
  const cells=B.groups(game.board)[0];
  assert.ok(cells.length>=2);
  const before=JSON.stringify(game);
  const result=B.pop(game,cells[0]);
  assert.ok(result.ok);
  assert.equal(result.removed.length,cells.length);
  assert.equal(result.gained,cells.length*cells.length*10);
  assert.equal(result.state.moves,game.moves-1);
  assert.equal(result.state.score,result.gained);
  assert.equal(JSON.stringify(game),before);
  assert.ok(result.state.board.every(value=>Number.isInteger(value)&&value>=-1&&value<B.COLORS));
});

test('Bubble Islands single bubbles cannot be popped and consume no move',()=>{
  const board=[
    0,1,2,3,4,0,1,
    1,2,3,4,0,1,2,
    2,3,4,0,1,2,3,
    3,4,0,1,2,3,4,
    4,0,1,2,3,4,0,
    0,1,2,3,4,0,1,
    1,2,3,4,0,1,2,
  ];
  assert.equal(B.groups(board).length,0);
  const game=B.createGame(1,9);
  game.board=board;
  const before=JSON.stringify(game);
  const result=B.pop(game,0);
  assert.equal(result.ok,false);
  assert.equal(JSON.stringify(game),before);
});

test('Bubble Islands completion unlocks next level and records stars once',()=>{
  let profile=B.initial(5);
  const game={...profile.active,score:B.levels[0].target*2,status:'won'};
  profile=B.complete(profile,game);
  assert.equal(profile.unlocked,2);
  assert.equal(profile.stars[0],3);
  assert.equal(profile.best[0],game.score);
  const weaker={...game,score:B.levels[0].target,status:'won'};
  const replay=B.complete(profile,weaker);
  assert.equal(replay.best[0],game.score);
  assert.equal(replay.stars[0],3);
});

test('Bubble Islands locked levels cannot start and valid save round-trips',()=>{
  const profile=B.initial(42);
  const locked=B.begin(profile,2,99);
  assert.equal(locked.ok,false);
  assert.deepEqual(locked.profile,profile);
  assert.ok(B.decode(JSON.stringify(profile)));
});

test('Bubble Islands rejects corrupted local saves',()=>{
  for(const mutate of [
    profile=>profile.unlocked=0,
    profile=>profile.best[0]=-1,
    profile=>profile.stars[0]=4,
    profile=>profile.active.board[0]=99,
    profile=>profile.active.moves=-1,
    profile=>profile.active.status='paid',
  ]){
    const profile=B.initial(3);
    mutate(profile);
    assert.equal(B.decode(JSON.stringify(profile)),null);
  }
});

