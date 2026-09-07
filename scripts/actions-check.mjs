import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__qz?.ready);
const results=await page.evaluate(async()=>{
  const {breakBoard,animateBoards}=await import('/src/barricades.js');const {canOccupy}=await import('/src/rules.js');
  const g=window.__qz,results=[];const check=(name,ok)=>{if(!ok)throw Error(name);results.push(name);};
  const reset=()=>{g.setTouch('on');g.start();g.pause(false);g.state.round=1;g.waveWait=1000;g.toSpawn=0;};
  reset();const e=g.world.entries.find(e=>e.id==='yard-1');g.camera.position.set(e.x,1.7,12.4);g.yaw=Math.PI;g.camera.rotation.set(0,Math.PI,0);
  for(let i=0;i<4;i++)breakBoard(e,i);e.boards=0;animateBoards(e,1.2);
  check('broken boards remain visible on ground',e.boardStates.every(b=>b.mode==='fallen'&&b.group.visible&&b.group.position.y<.2));
  g.playing=true;g.controls.active=true;g.interact();check('tapping interact does not repair',e.boards===0);
  g.controls.keys.add('KeyE');g.updateRepair(.45);check('held repair animates before awarding a board',e.boards===0&&g.repair&&e.boardStates[0].group.position.y>.12&&e.boardStates[0].group.position.y<e.boardStates[0].anchor.y);
  g.controls.keys.delete('KeyE');g.updateRepair(.01);check('release cancels incomplete repair without reward',!g.repair&&e.boards===0&&g.state.points===500);
  const sequence=[];g.controls.keys.add('KeyE');for(let board=0;board<4;board++){g.updateRepair(.95);sequence.push(e.boards);}
  check('one continuous hold restores boards 1 2 3 4',sequence.join(',')==='1,2,3,4');check('repair rewards only finished boards',g.state.points===540);
  g.updateRepair(2);check('fully repaired window stops spending work',!g.repair&&e.boards===4);
  g.pause(false);reset();const entry=g.world.entries.find(e=>e.id==='yard-1');g.camera.position.set(-6,1.7,12.4);g.spawnZombie();const z=g.zombies[0];z.entry=entry;z.mesh.position.set(entry.x,0,entry.z+.66);
  g.moveZombies(.01);check('zombie starts an explicit tear action',z.action?.kind==='tear');z.action.rate=1;
  g.moveZombies(.4);check('board remains attached during anticipation',entry.boards===4&&Math.abs(entry.boardStates[3].group.position.z-entry.boardStates[3].anchor.z)>.001);
  g.moveZombies(.49);check('board breaks exactly at contact',entry.boards===3&&entry.boardStates[3].mode==='falling');
  animateBoards(entry,.3);check('wood visibly falls and separates',entry.boardStates[3].group.position.y<entry.boardStates[3].anchor.y&&entry.boardStates[3].halves[0].position.x<-.05);
  for(let i=0;i<600&&z.entering;i++){g.moveZombies(.05);animateBoards(entry,.05);}
  check('all four boards broken before climb completes',entry.boards===0&&!z.entering&&canOccupy(z.mesh.position.x,z.mesh.position.z,.3,g.world.obstacles,g.state));
  reset();g.camera.position.set(0,1.7,7);g.spawnZombie();const attacker=g.zombies[0];attacker.entering=false;attacker.mesh.position.set(0,0,5.8);attacker.health=10000;g.moveZombies(.01);
  check('melee begins with wind-up and no instant damage',attacker.action?.kind==='attack'&&g.state.health===100);attacker.action.rate=1;
  const arm=attacker.mesh.getObjectByName(attacker.hand>0?'upper_armL':'upper_armR'),armBefore=arm.quaternion.clone();g.moveZombies(.3);check('attack visibly articulates the arm',arm.quaternion.angleTo(armBefore)>.3);check('health unchanged before swipe contact',g.state.health===100);g.moveZombies(.17);check('swipe contact deals damage',g.state.health===76);
  g.moveZombies(.2);check('one swing cannot deal damage twice',g.state.health===76);
  for(let i=0;i<30;i++)g.moveZombies(.05);attacker.action={kind:'attack',time:0,rate:1};g.state.health=100;g.moveZombies(.3);g.camera.position.x=3;g.moveZombies(.2);check('stepping out of reach dodges the swing',g.state.health===100);
  g.camera.position.set(0,1.7,7);attacker.mesh.position.set(0,0,5.8);attacker.action={kind:'attack',time:0,rate:1};attacker.stun=1;g.moveZombies(.5);check('stun interrupts an attack before damage',!attacker.action&&g.state.health===100);
  reset();g.camera.position.set(0,1.7,5);for(let i=0;i<12;i++){g.spawnZombie();const z=g.zombies.at(-1);z.entering=false;z.mesh.position.set((i%3-1)*.5,0,11+Math.floor(i/3)*.65);}
  const initial=g.zombies.map(z=>z.mesh.position.clone());for(let i=0;i<80;i++)g.moveZombies(.05);
  const positions=g.zombies.map(z=>({x:z.mesh.position.x,z:z.mesh.position.z}));
  check('horde fans out on both sides instead of one queue',positions.some(p=>p.x<-1)&&positions.some(p=>p.x>1));
  check('horde remains inside traversable space',positions.every(p=>canOccupy(p.x,p.z,.3,g.world.obstacles,g.state)));
  check('all enemies make forward progress',positions.every((p,i)=>Math.hypot(p.x,p.z-5)<Math.hypot(initial[i].x,initial[i].z-5)));
  g.returnToMenu();return {results,positions};
});console.log(results.results.map(x=>'PASS '+x).join('\n'));
// Capture actual rig actions at contact and during climbing for visual inspection.
await page.evaluate(()=>{const g=window.__qz;g.start();g.pause(false);g.setQuality('high');g.state.round=1;g.spawnZombie();const z=g.zombies[0],entry=g.world.entries.find(e=>e.id==='yard-1');z.entry=entry;z.mesh.position.set(entry.x,0,entry.z+.66);g.camera.position.set(-4,1.65,12.2);g.camera.lookAt(-6,1.3,15);g.gun.visible=false;g.bannerTime=g.toastTime=0;document.querySelector('#wave-banner').style.opacity=0;document.querySelector('#toast').style.opacity=0;g.moveZombies(.01);z.action.rate=1;});
for(const [name,dt] of [['reach',.4],['pull',.42],['break',.14]]){await page.evaluate(dt=>{const g=window.__qz;g.moveZombies(dt);g.world.animate(dt,g.time,g.camera.position,dt);},dt);await page.screenshot({path:`art/action-${name}.png`});}
await page.evaluate(async()=>{const g=window.__qz,z=g.zombies[0],e=z.entry;const {breakBoard,animateBoards}=await import('/src/barricades.js');for(let i=0;i<4;i++)breakBoard(e,i);animateBoards(e,1.2);z.action=null;e.work=null;e.boards=0;e.climber=z;z.action={kind:'climb',time:0,startX:e.x};g.moveZombies(.6);});await page.screenshot({path:'art/action-climb.png'});
await page.evaluate(()=>{const g=window.__qz,z=g.zombies[0];z.entering=false;z.action={kind:'attack',time:0,rate:1};z.mesh.position.set(-6,0,11);g.camera.position.set(-4.5,1.7,12.4);g.camera.lookAt(-6,1.2,11);z.mesh.rotation.y=.7;g.moveZombies(.45);});await page.screenshot({path:'art/action-attack.png'});
// Real keyboard: tap must not instantly repair; holding must repeat automatically.
await page.evaluate(async()=>{const {breakBoard,animateBoards}=await import('/src/barricades.js');const g=window.__qz;g.returnToMenu();g.start();g.waveWait=1000;g.toSpawn=0;const e=g.world.entries.find(e=>e.id==='yard-1');for(let i=0;i<4;i++)breakBoard(e,i);e.boards=0;animateBoards(e,1.2);g.camera.position.set(e.x,1.7,12.4);g.yaw=Math.PI;g.pitch=0;g.camera.rotation.set(0,Math.PI,0);});
await page.keyboard.press('e');assert.equal(await page.evaluate(()=>window.__qz.world.entries.find(e=>e.id==='yard-1').boards),0);
await page.keyboard.down('e');await page.waitForTimeout(2200);await page.keyboard.up('e');const count=await page.evaluate(()=>window.__qz.world.entries.find(e=>e.id==='yard-1').boards);assert.ok(count>=1&&count<=2);console.log('PASS real keyboard hold repeats repair; tap does not');
// Real mobile hold release cancels instead of being treated as a purchase click.
await page.setViewportSize({width:844,height:390});const cdp=await page.context().newCDPSession(page);const b=await page.locator('#touch-interact').boundingBox();
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await page.waitForTimeout(1100);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.__qz.controls.use),false);assert.equal(await page.evaluate(()=>window.__qz.repair),null);assert.ok(await page.evaluate(()=>window.__qz.world.entries.find(e=>e.id==='yard-1').boards)>count);console.log('PASS mobile hold repairs and release stops');
assert.deepEqual(errors,[]);await writeFile('art/actions-check.json',JSON.stringify({...results,errors},null,2));console.log('PASS no browser runtime errors');
}finally{await browser.close();}
