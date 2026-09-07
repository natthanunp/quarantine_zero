import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathClear,crowdVelocity,pursuitTarget} from '../src/horde.js';
import {newRun} from '../src/rules.js';
test('pursuit segment sweep respects walls, body clearance and gate state',()=>{
  const state=newRun(),o=[{x:0,z:0,w:3,d:.5,door:'door'}];
  assert.equal(pathClear(0,2,0,-2,o,state),false);
  state.door=true;assert.equal(pathClear(0,2,0,-2,o,state),true);
  assert.equal(pathClear(1.65,2,1.65,-2,[{...o[0],door:null}],state),false);
  assert.equal(pathClear(2,2,2,-2,[{...o[0],door:null}],state),true);
});
test('individual approach preferences produce opposite flanks while closing distance',()=>{
  const state=newRun(),z={mesh:{position:{x:0,z:10}},phase:0},player={x:0,z:0};
  const left=pursuitTarget({...z,flank:-1},player,null,[],state),right=pursuitTarget({...z,flank:1},player,null,[],state);
  assert.ok(left.x<-2&&right.x>2);assert.ok(left.z<10&&right.z<10);
});
test('crowd separation moves an overlapping neighbour aside without unbounded speed',()=>{
  const z={mesh:{position:{x:0,z:5}},phase:.6,speed:2,passSide:1},other={mesh:{position:{x:.2,z:4.8}}};
  const velocity=crowdVelocity(z,{x:0,z:0},[z,other]);assert.ok(velocity.x<0);assert.ok(Math.hypot(velocity.x,velocity.z)<=2.3+.00001);
});
