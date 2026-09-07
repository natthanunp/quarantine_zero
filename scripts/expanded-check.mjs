import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.connectOverCDP(process.argv[2]);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('localhost:5173'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.reload();await page.waitForFunction(()=>window.__qz?.ready);
await page.setViewportSize({width:1280,height:800});
const mapChecks=await page.evaluate(async()=>{
  const {GATES,ZONES,reachableZones}=await import('/src/map.js');
  const {canOccupy}=await import('/src/rules.js');
  const game=window.__qz;game.setTouch('on');game.start();game.pause(false);game.setTouch('off');game.state.points=50000;
  const results=[];
  for(const gate of GATES){
    if(canOccupy(gate.x,gate.z,.35,game.world.obstacles,game.state))throw new Error('Closed gate traversable: '+gate.id);
    const fromRight=['pump-door','lab-link'].includes(gate.id);
    game.camera.position.set(gate.x+(gate.axis==='z'?(fromRight?1.8:-1.8):0),1.7,gate.z+(gate.axis==='x'?1.8:0));
    game.scene.updateMatrixWorld(true);game.playing=true;
    const points=game.state.points;const nearest=game.nearestStation();if(nearest?.id!==gate.id)throw new Error(`Gate inaccessible: ${gate.id}; got ${nearest?.id}`);
    game.interact();game.playing=false;
    if(game.state.points!==points-gate.price||!canOccupy(gate.x,gate.z,.35,game.world.obstacles,game.state))throw new Error('Gate did not open: '+gate.id);
    if(game.world.gateObjects.get(gate.id).some(m=>m.parent))throw new Error('Gate geometry remains: '+gate.id);
    results.push('PASS gate purchase and traversal: '+gate.name);
  }
  if(reachableZones(game.state).length!==6)throw new Error('Not all sectors reachable');
  game.camera.position.set(0,1.7,10);game.buildNav();const nav=game.nav;
  for(const zone of ZONES){const x=zone.x+3,z=zone.z;const i=Math.round((x-nav.x0)/nav.size),j=Math.round((z-nav.z0)/nav.size);if(nav.distance[j*nav.w+i]<0)throw new Error('No enemy path into '+zone.id);results.push('PASS enemy navigation reaches '+zone.name);}
  return results;
});console.log(mapChecks.join('\n'));
for(const weapon of ['pistol','carbine','shotgun','smg','arc']){
  const result=await page.evaluate(async weapon=>{
    const {equip}=await import('/src/rules.js');const game=window.__qz;game.pause(false);equip(game.state,weapon);game.equipModel();game.camera.position.set(0,1.7,10);game.camera.rotation.set(0,0,0);game.controls.ads=true;game.camera.fov=48;game.camera.updateProjectionMatrix();game.recoil=0;game.reloadTime=0;game.gun.visible=true;for(let i=0;i<70;i++)game.updateViewModel(.05);game.camera.updateMatrixWorld(true);game.bannerTime=game.toastTime=0;document.querySelector('#wave-banner').style.opacity=0;document.querySelector('#toast').style.opacity=0;
    const projected=['sight_rear','sight_front'].map(name=>game.weaponModel.getObjectByName(name).getWorldPosition(game.camera.position.clone()).project(game.camera));
    const visible=[];game.gun.traverseVisible(o=>{if(o.isMesh)visible.push(o);});const ray=game.ray;ray.set(game.camera.position,game.camera.position.clone().set(0,.012,-1).applyQuaternion(game.camera.quaternion).normalize());const aboveSight=ray.intersectObjects(visible,false);
    return {aligned:projected.every(p=>Math.abs(p.x)<.0001&&Math.abs(p.y)<.0001),clearAbove:aboveSight.length===0};
  },weapon);
  assert.ok(result.aligned,weapon+' sight alignment');assert.ok(result.clearAbove,weapon+' clear upper aim view');console.log('PASS aligned, unobstructed iron sights: '+weapon);
  await page.screenshot({path:`art/ads-${weapon}.png`});
}
for(const [id,x,z,yaw]of[['pump',-28,12,0],['foundry',28,7,Math.PI],['lab',-28,-8,0],['relay',28,-8,0]]){
  await page.evaluate(({x,z,yaw})=>{const g=window.__qz;g.controls.ads=false;g.camera.fov=72;g.camera.updateProjectionMatrix();g.camera.position.set(x,1.7,z);g.camera.rotation.set(0,yaw,0);g.gun.visible=false;g.hudTimer=0;g.hud(.1);},{x,z,yaw});
  await page.screenshot({path:`art/sector-${id}.png`});
}
const perks=await page.evaluate(async()=>{
  const {STATIONS}=await import('/src/rules.js');const g=window.__qz,results=[];
  for(const id of ['vital','speed','regen']){const station=STATIONS.find(s=>s.id===id),rotation=station.rotation??-Math.PI/2;g.camera.position.set(station.x+Math.sin(rotation)*1.8,1.7,station.z+Math.cos(rotation)*1.8);g.scene.updateMatrixWorld(true);g.playing=true;g.interact();g.playing=false;if(!g.state.perks.includes(id))throw new Error('Perk unavailable '+id);results.push('PASS new Blender perk machine purchase: '+id);}return results;
});console.log(perks.join('\n'));
await page.evaluate(()=>{const g=window.__qz;g.camera.position.set(12.7-2.8,1.5,11.5);g.camera.rotation.set(-.08,-Math.PI/2,0);g.gun.visible=false;});
await page.screenshot({path:'art/perk-machine-ingame.png'});
assert.deepEqual(errors,[]);console.log('PASS no browser runtime errors');
await browser.close();
