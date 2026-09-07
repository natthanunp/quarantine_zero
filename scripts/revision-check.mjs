import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__qz?.ready);
const result=await page.evaluate(async()=>{
  const {canOccupy,equip,waveSpec}=await import('/src/rules.js');const {GATES,reachableZones}=await import('/src/map.js');
  const g=window.__qz,checks=[];const check=(name,value)=>{if(!value)throw Error(name);checks.push(name);};
  g.setTouch('on');g.start();g.pause(false);g.setQuality('high');g.state.points=50000;
  for(const gate of GATES){
    g.camera.position.set(gate.x+(gate.axis==='z'?(['pump-door','lab-link'].includes(gate.id)?1.8:-1.8):0),1.7,gate.z+(gate.axis==='x'?1.8:0));g.playing=true;
    check('gate reachable '+gate.id,g.nearestStation()?.id===gate.id);g.interact();g.playing=false;check('gate opens '+gate.id,canOccupy(gate.x,gate.z,.35,g.world.obstacles,g.state));
  }
  g.buildNav();check('all six zones connected',reachableZones(g.state).length===6);
  for(const entry of g.world.entries){
    g.camera.position.set(entry.x,1.7,entry.z+entry.inward*1.8);g.playing=true;
    check('window repair accessible '+entry.id,g.nearestStation()?.id===entry.id);
    entry.boards=2;g.controls.active=true;g.controls.use=true;g.yaw=entry.inward<0?Math.PI:0;g.interact();g.updateRepair(.95);g.controls.use=false;check('repair restores board '+entry.id,entry.boards===3);
    check('entry lands on walkable floor '+entry.id,canOccupy(entry.x,entry.z+entry.inward*1.25,.3,g.world.obstacles,g.state));
    g.spawnZombie();const arrival=g.zombies.at(-1);arrival.entry=entry;arrival.mesh.position.set(entry.x+.45,0,entry.z-entry.inward*.6);entry.boards=0;
    for(let i=0;i<42;i++)g.moveZombies(.05);
    check('offset arrival clears sill and furniture '+entry.id,!arrival.entering&&canOccupy(arrival.mesh.position.x,arrival.mesh.position.z,.3,g.world.obstacles,g.state));
    g.zombies.forEach(z=>g.releaseZombie(z));g.zombies=[];
    g.playing=false;
  }
  g.returnToMenu();g.start();g.pause(false);g.state.round=1;g.spawnZombie();const z=g.zombies[0],entry=z.entry;
  check('spawn starts outside at a named window',z.entering&&(z.mesh.position.z-z.entry.z)*z.entry.inward<0);
  g.camera.position.set(0,1.7,6);let elapsed=0;
  while(z.entering&&elapsed<25){g.moveZombies(.05);elapsed+=.05;}
  check('enemy breaks boards and climbs into map',!z.entering&&entry.boards===0&&canOccupy(z.mesh.position.x,z.mesh.position.z,.3,g.world.obstacles,g.state));
  const before=z.mesh.position.clone();for(let i=0;i<80;i++)g.moveZombies(.05);check('entered enemy pursues player',z.mesh.position.distanceTo(before)>1);
  const bones=z.mesh.getObjectByProperty('isSkinnedMesh',true).skeleton.bones,pose=bones.map(b=>b.quaternion.toArray());z.mesh.userData.mixer.update(.3);check('walk deforms limbs',bones.some((b,i)=>b.quaternion.toArray().some((v,j)=>Math.abs(v-pose[i][j])>.01)));
  // The render meshes must never be raycast by combat.
  g.returnToMenu();g.start();g.pause(false);g.state.round=10;g.camera.position.set(0,1.7,10);g.camera.rotation.set(0,0,0);
  for(let i=0;i<24;i++){g.spawnZombie();const z=g.zombies.at(-1);z.entering=false;z.mesh.position.set((i%3-1)*.15,0,5-Math.floor(i/3)*.7);z.health=100000;z.mesh.traverse(o=>{if(o.isMesh)o.raycast=()=>{throw Error('combat touched a render mesh');};});}
  equip(g.state,'shotgun');g.equipModel();g.scene.updateMatrixWorld(true);const shotMs=[];
  for(let i=0;i<30;i++){g.nextShot=0;g.state.ammo=8;const t=performance.now();g.shoot();shotMs.push(performance.now()-t);}
  check('crowded shotgun damage applies',g.zombies.some(z=>z.health<100000));check('impact effects remain bounded',g.effects.length<=40);
  check('crowded shotgun p95 below 16ms',shotMs.sort((a,b)=>a-b)[28]<16);
  equip(g.state,'arc');g.equipModel();g.nextShot=0;const hp=g.zombies.map(z=>z.health);g.shoot();check('ARC chains through four enemies',g.zombies.filter((z,i)=>z.health<hp[i]).length===4);
  g.returnToMenu();g.start();g.pause(false);g.state.round=5;g.waveWait=0;g.toSpawn=0;g.playing=true;g.update(.016);
  check('round five opens a mandatory decision',g.awaitingDecision&&!g.playing&&!!document.querySelector('#choose-evac'));
  document.querySelector('#choose-continue').click();check('continue preserves run and schedules round six',g.playing&&g.waveWait===8&&!g.extraction);g.waveWait=.001;g.update(.02);check('continue starts round six',g.state.round===6);
  g.pause(false);g.returnToMenu();g.start();g.pause(false);g.state.round=5;g.state.kills=40;g.state.completedRounds=5;g.offerExtraction();
  document.querySelector('#choose-evac').click();g.pause(false);check('evacuation starts timed objective',g.extraction.remaining===45);
  g.camera.position.set(0,1.7,12.5);g.playing=true;g.interact();check('door interaction starts boarding',g.extraction.boarding);
  g.camera.position.x=8;g.updateExtraction(.1);check('leaving door resets boarding',!g.extraction.boarding&&g.extraction.progress===0);
  g.camera.position.set(0,1.7,12.5);g.interact();for(let i=0;i<101&&!g.over;i++)g.updateExtraction(.05);
  check('evacuation completes and banks salvage',g.over&&g.state.evacuated&&g.state.salvage===180&&Number(localStorage.getItem('qz-salvage'))===180);
  document.querySelector('#results-menu').click();check('result menu returns home',!g.started&&!g.playing&&!document.querySelector('#menu').classList.contains('hidden'));
  g.start();g.pause(false);g.state.completedRounds=5;g.state.round=5;g.offerExtraction();document.querySelector('#choose-evac').click();g.extraction.remaining=.01;g.updateExtraction(.02);check('missed evacuation resumes survival',!g.extraction&&g.waveWait===8&&!g.over);
  g.pause(false);g.setQuality('high');g.camera.position.set(0,1.7,7);g.camera.rotation.set(-.12,Math.PI,0);g.hudTimer=0;g.hud(.1);
  return {checks,shotMs,renderer:g.renderer.getContext().getParameter(g.renderer.getContext().RENDERER)};
});
console.log(result.checks.map(s=>'PASS '+s).join('\n'));console.log('Shot ms:',result.shotMs);
await page.screenshot({path:'art/revision-windows.png'});
// Genuine touch taps must leave aim enabled after release, and pause must reset it.
await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{const g=window.__qz;g.resume();g.waveWait=1000;g.toSpawn=0;g.zombies.forEach(z=>g.releaseZombie(z));g.zombies=[];});
const cdp=await page.context().newCDPSession(page);
async function tap(selector){const b=await page.locator(selector).boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
await tap('#touch-ads');assert.equal(await page.evaluate(()=>window.__qz.controls.ads),true);assert.equal(await page.locator('#touch-ads').getAttribute('aria-pressed'),'true');
await tap('#touch-fire');assert.equal(await page.evaluate(()=>window.__qz.controls.ads),true);await page.screenshot({path:'art/revision-mobile.png'});
await tap('#touch-ads');assert.equal(await page.evaluate(()=>window.__qz.controls.ads),false);
await tap('#touch-ads');await page.locator('#menu-button').click();assert.equal(await page.evaluate(()=>window.__qz.controls.ads),false);
await page.locator('#quit-run').click();assert.equal(await page.evaluate(()=>window.__qz.started),false);
console.log('PASS real touch aim toggles, survives fire release, resets on pause; pause menu exits run');
await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>{const g=window.__qz;g.start();g.pause(false);g.state.round=5;g.state.completedRounds=5;g.state.kills=60;g.offerExtraction();});await page.screenshot({path:'art/revision-evacuation.png'});
assert.deepEqual(errors,[]);await writeFile('art/revision-check.json',JSON.stringify({...result,errors},null,2));console.log('PASS no browser runtime errors');
}finally{await browser.close();}
