import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rayBox,traceShot,wallDistance} from '../src/combat.js';
import {newRun,repairBarricade,canExtract,extractionReward,WEAPONS,STATIONS,waveSpec} from '../src/rules.js';
import {ENTRIES,reachableZones} from '../src/map.js';
const origin={x:0,y:1.7,z:10},direction={x:0,y:0,z:-1};
const enemy=(x,z)=>({mesh:{position:{x,y:0,z}},health:100});
test('analytic hits select the nearest enemy head without touching the render mesh',()=>{
  const front=enemy(0,6),back=enemy(0,3);const hit=traceShot(origin,direction,[back,front],[],newRun());assert.equal(hit.zombie,front);assert.equal(hit.head,true);
  assert.equal(traceShot({...origin,y:1},direction,[front],[],newRun()).head,false);
  assert.equal(traceShot({...origin,x:2},direction,[front],[],newRun()),null);
});
test('closed gates stop hits, opening them permits shots, low sills allow headshots',()=>{
  const state=newRun(),z=enemy(0,3),gate={x:0,z:6,w:4,d:.5,door:'door'};
  assert.equal(traceShot(origin,direction,[z],[gate],state).zombie,null);
  state.door=true;assert.equal(traceShot(origin,direction,[z],[gate],state).zombie,z);
  assert.equal(traceShot(origin,direction,[z],[{...gate,door:null,top:.56}],state).zombie,z);
});
test('ray slabs handle parallel, boundary, backwards and inside rays',()=>{
  const min={x:-1,y:0,z:2},max={x:1,y:2,z:4};assert.equal(rayBox(origin,direction,min,max),6);
  assert.equal(rayBox({...origin,x:2},direction,min,max),null);
  assert.equal(rayBox(origin,{x:0,y:0,z:1},min,max),null);
  assert.equal(rayBox({x:0,y:1,z:3},direction,min,max),0);
  assert.equal(wallDistance(origin,direction,[],newRun(),7),7);
});
test('repairs restore boards without charging and cap farming at 120 points per round',()=>{
  const state=newRun(),entry={boards:4};assert.equal(repairBarricade(state,entry).ok,false);assert.equal(state.points,500);
  for(let i=0;i<30;i++){entry.boards=3;assert.equal(repairBarricade(state,entry).ok,true);assert.equal(entry.boards,4);}assert.equal(state.points,620);
});
test('evacuation requires five actually completed rounds and rewards longer survival',()=>{
  const s=newRun();s.round=5;assert.equal(canExtract(s),false);s.completedRounds=5;s.kills=20;assert.equal(canExtract(s),true);assert.equal(extractionReward(s),140);
  s.completedRounds=6;assert.equal(canExtract(s),false);s.completedRounds=10;assert.equal(canExtract(s),true);assert.equal(extractionReward(s),240);
});
test('experimental chain weapon is box exclusive and enemies have distinct escalating roles',()=>{
  assert.ok(WEAPONS.arc.exclusive&&WEAPONS.arc.chain===4);assert.ok(!STATIONS.some(s=>s.type==='weapon'&&s.id==='arc'));
  assert.equal(waveSpec(1).runnerChance,0);assert.ok(waveSpec(3).runnerChance>0);assert.equal(waveSpec(5).brute,true);
  assert.equal(ENTRIES.length,12);assert.equal(ENTRIES.filter(e=>reachableZones(newRun()).includes(e.zone)).length,2);
});
