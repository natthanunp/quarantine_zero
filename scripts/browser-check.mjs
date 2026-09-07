import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.connectOverCDP(process.argv[2]);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('localhost:5173'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.waitForFunction(()=>window.__qz?.ready);
const checks=await page.evaluate(()=>{
  const g=window.__qz,results=[];
  const check=(name,ok)=>{if(!ok)throw new Error(name);results.push(name);};
  g.pause(false);g.setTouch('on');g.start();g.waveWait=1000;g.playing=false;
  const first=g.makeZombie(),second=g.makeZombie();
  const a=first.getObjectByProperty('isSkinnedMesh',true),b=second.getObjectByProperty('isSkinnedMesh',true);
  check('original character has independent 17-bone skeletons',a?.skeleton.bones.length===17&&b?.skeleton!==a.skeleton&&b.skeleton.bones[0]!==a.skeleton.bones[0]);
  const pose=a.skeleton.bones.map(bone=>bone.quaternion.toArray());first.userData.mixer.update(.6);
  check('exported stagger animation deforms the character',a.skeleton.bones.some((bone,i)=>bone.quaternion.toArray().some((v,j)=>Math.abs(v-pose[i][j])>.001)));
  check('original procedural skin textures include normal maps',!!a.material.normalMap);
  // Exercise the actual game's raycast, enemy health, rewards and magazine.
  g.spawnZombie();const z=g.zombies[0];z.mesh.position.set(0,0,6);z.mesh.rotation.set(0,0,0);g.camera.position.set(0,1.72,10);g.camera.rotation.set(0,0,0);g.scene.updateMatrixWorld(true);g.shoot();
  check('raycast headshot awards a kill and spends ammo',g.state.kills===1&&g.state.headshots===1&&g.state.ammo===14&&g.state.points===660);
  // Gate geometry must block projectiles.
  g.spawnZombie();const blocked=g.zombies[0];blocked.mesh.position.set(0,0,-8);const hp=blocked.health;g.camera.position.set(0,1.72,-2);g.scene.updateMatrixWorld(true);g.nextShot=0;g.shoot();check('closed gate blocks bullets',blocked.health===hp);
  g.zombies.forEach(z=>g.scene.remove(z.mesh));g.zombies=[];g.state.points=5000;g.camera.position.set(0,1.7,-3.2);g.playing=true;g.interact();check('nearby gate purchase unlocks geometry and charges 1000',g.state.door&&g.state.points===4000&&g.world.doorObjects.every(m=>!m.parent));
  g.camera.position.set(-11,1.7,0);g.interact();check('wall buy equips a loaded carbine',g.state.weapon==='carbine'&&g.state.ammo===30&&g.state.points===2800);
  g.camera.position.set(8,1.7,-12.5);g.interact();check('mystery cache equips a random weapon',g.state.weapon!=='pistol'&&g.state.points===1850);
  g.camera.position.set(11,1.7,11.5);g.interact();check('perk purchase applies Quick Hands',g.state.perks.includes('speed')&&g.state.points===350);
  g.state.ammo=0;g.reload();check('Quick Hands shortens reload',g.reloadTime>0&&g.reloadTime<=1.3);for(let i=0;i<30;i++)g.update(.05);check('reload fills clip',g.state.ammo>0&&g.reloadTime===0);
  g.camera.position.set(0,1.7,10);g.toSpawn=0;g.waveWait=0;const round=g.state.round,points=g.state.points;g.update(.02);check('cleared wave awards bonus and breather',g.waveWait===8&&g.state.points===points+200);g.waveWait=.001;g.update(.02);check('next wave escalates',g.state.round===round+1&&g.toSpawn>0);
  g.waveWait=1000;g.toSpawn=0;g.state.health=20;g.sinceHit=6;g.update(.5);check('health regenerates during gameplay',g.state.health>20);g.pause(false);check('pause disables simulation and input',!g.playing&&!g.controls.active);
  return results;
});
console.log(checks.map(s=>'PASS '+s).join('\n'));
// Real keyboard events.
await page.evaluate(()=>{const g=window.__qz;g.setTouch('off');g.playing=true;g.controls.active=true;g.yaw=0;g.pitch=0;g.camera.position.set(0,1.7,10);});
await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');
assert.ok(await page.evaluate(()=>window.__qz.camera.position.z<9.8),'W moves forward');console.log('PASS real keyboard movement');
await page.keyboard.press('p');assert.equal(await page.evaluate(()=>window.__qz.playing),false);console.log('PASS keyboard pause');
// Two simultaneous touch pointers on separate virtual sticks.
await page.setViewportSize({width:844,height:390});
await page.evaluate(()=>{document.querySelector('#modal').classList.add('hidden');const g=window.__qz;g.setTouch('on');g.setQuality('medium');g.resume();g.camera.position.set(0,1.7,10);g.yaw=0;});
const left=await page.locator('#move-stick').boundingBox(),right=await page.locator('#look-stick').boundingBox();
const cdp=await page.context().newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:left.x+left.width/2,y:left.y+left.height*.25,id:1},{x:right.x+right.width*.8,y:right.y+right.height/2,id:2}]});
await page.waitForTimeout(350);
const touch=await page.evaluate(()=>({move:window.__qz.controls.move.y,look:window.__qz.controls.look.x,yaw:window.__qz.yaw}));
assert.ok(touch.move<-.3&&touch.look>.3&&touch.yaw<0);console.log('PASS simultaneous movement and look touch controls');
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
assert.equal(await page.evaluate(()=>window.__qz.controls.move.y),0);console.log('PASS touch release resets input');
const ammo=await page.evaluate(()=>window.__qz.state.ammo);
// Real touch button press (pointer capture requires a real active pointer).
const fire=await page.locator('#touch-fire').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fire.x+fire.width/2,y:fire.y+fire.height/2,id:3}]});await page.waitForTimeout(250);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
assert.ok(await page.evaluate(()=>window.__qz.state.ammo)<ammo);console.log('PASS touch firing');
await page.screenshot({path:'mobile-preview.png'});
await page.evaluate(()=>{const g=window.__qz;g.pause(false);g.setTouch('off');g.setQuality('ultra');});
await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(1000);await page.screenshot({path:'ultra-preview.png'});
assert.ok(await page.evaluate(()=>window.__qz.world.reflectors.every(p=>p.visible)&&window.__qz.ao.enabled&&window.__qz.bloom.enabled));console.log('PASS Ultra rendering with reflections, AO and bloom');
assert.deepEqual(errors,[]);console.log('PASS no page runtime errors');
await page.evaluate(()=>{window.__qz.setQuality('high');});
await browser.close();
