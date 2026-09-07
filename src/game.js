import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createWorld } from './world.js';
import { Controls } from './controls.js';
import { AudioEngine } from './audio.js';
import { MAP_BOUNDS,ZONES,EXTRACTION,gateIsOpen,reachableZones,zoneAt } from './map.js';
import {buildViewModel,HIP_POSE,AIM_POSE} from './viewmodel.js';
import {updateMapHud} from './map-ui.js';
import { WEAPONS, STATIONS, newRun, waveSpec, purchase, regenerate, finishReload, canOccupy, repairBarricade, extractionReward, canExtract } from './rules.js';
import {ACTIONS,prepareAnimator,actionPose,walkPose,climbOffset} from './zombie-animation.js';
import {shakeBoard,breakBoard,beginBoardRepair,poseBoardRepair,finishBoardRepair,cancelBoardRepair} from './barricades.js';
import {pursuitTarget,crowdVelocity} from './horde.js';
import {traceShot,wallDistance} from './combat.js';
const $=id=>document.getElementById(id);
const clamp=THREE.MathUtils.clamp;
export class Game {
  constructor(callbacks){
    this.cb=callbacks;this.canvas=$('scene');this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.04,110);this.camera.rotation.order='YXZ';this.camera.position.set(7,3.3,12);this.camera.lookAt(-1,1.8,-5);
    this.audio=new AudioEngine();this.state=newRun();this.zombies=[];this.zombiePool=[];this.effects=[];this.playing=false;this.started=false;this.over=false;this.ready=false;this.yaw=0;this.pitch=0;this.time=0;this.last=0;this.nextShot=0;this.reloadTime=0;this.sinceHit=100;this.waveWait=4;this.toSpawn=0;this.spawnTimer=0;this.bannerTime=0;this.toastTime=0;this.hitTime=0;this.recoil=0;this.hudTimer=0;this.navTimer=0;this.fpsTime=0;this.frames=0;this.flashEnabled=true;this.touchMode='auto';
    this.controls=new Controls(this.canvas,{look:(x,y)=>{this.yaw-=x;this.pitch=clamp(this.pitch-y,-1.40,1.40);},reload:()=>this.reload(),interact:()=>this.interact(),pause:()=>this.pause(),flashlight:()=>{this.flashEnabled=!this.flashEnabled;},notice:t=>this.notice(t)});
    let saved={};try{saved=JSON.parse(localStorage.getItem('qz-settings')||'{}');this.best=+localStorage.getItem('qz-best')||0;}catch{this.best=0;}
    this.quality=saved.quality||(this.controls.touch?'medium':'high');this.controls.sensitivity=saved.sensitivity||1;this.audio.setVolume(saved.volume??.35);this.touchMode=saved.touchMode||'auto';
    this.updateRecord();$('best').textContent=`PERSONAL BEST / ${this.best?`ROUND ${this.best}`:'—'}`;
    window.addEventListener('resize',()=>{this.controls.clear();this.cancelRepair();this.resize();});this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.pause(false);this.notice('Graphics context lost. Reload the page to recover.');});
  }
  async init(){
    this.world=await createWorld(this.renderer,p=>{$('load-status').textContent=`LOADING FIELD KIT / ${Math.round(p*100)}%`;});this.scene=this.world.scene;this.scene.add(this.camera);
    this.gun=new THREE.Group();this.camera.add(this.gun);this.gun.visible=false;this.equipModel();
    this.flash=new THREE.SpotLight('#e5efd9',9,27,Math.PI/6,.65,1.25);this.flash.position.set(.16,-.1,0);this.flash.target.position.set(0,0,-12);this.camera.add(this.flash,this.flash.target);
    this.muzzle=new THREE.PointLight('#ffc071',0,8);this.muzzle.position.set(.2,-.15,-.7);this.camera.add(this.muzzle);
    this.flashMesh=new THREE.Mesh(new THREE.ConeGeometry(.065,.25,6),new THREE.MeshBasicMaterial({color:'#ffe9a9',transparent:true,opacity:.9}));this.flashMesh.rotation.x=-Math.PI/2;this.flashMesh.position.set(.22,-.20,-.80);this.flashMesh.visible=false;this.camera.add(this.flashMesh);
    this.ray=new THREE.Raycaster();this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.ao=new GTAOPass(this.scene,this.camera,innerWidth/2,innerHeight/2);this.ao.updateGtaoMaterial({radius:.45,distanceExponent:1.5,thickness:1,scale:1});this.composer.addPass(this.ao);this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.36,.55,1.05);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());this.setQuality(this.quality);this.setTouch(this.touchMode);this.renderer.info.autoReset=false;this.ready=true;
    this.previewZombies=[];for(const [x,z] of [[1,-1],[-3,-9],[6,-11]]){const m=this.makeZombie();m.position.set(x,0,z);m.rotation.y=.2;this.scene.add(m);this.previewZombies.push(m);}
    requestAnimationFrame(t=>this.frame(t));
  }
  setTouch(mode){this.controls.clear();this.touchMode=mode;this.controls.touch=mode==='on'||(mode==='auto'&&matchMedia('(pointer:coarse)').matches);document.body.classList.toggle('touch-active',this.controls.touch&&this.started);$('touch-controls').classList.toggle('hidden',!this.controls.touch||!this.playing);this.saveSettings();}
  saveSettings(){try{localStorage.setItem('qz-settings',JSON.stringify({quality:this.quality,sensitivity:this.controls.sensitivity,volume:this.audio.volume,touchMode:this.touchMode}));}catch{}}
  setQuality(q){this.quality=['low','medium','high','ultra'].includes(q)?q:'high';if(!this.composer)return;this.ao.enabled=this.quality==='ultra';this.bloom.enabled=this.quality!=='low';this.renderer.shadowMap.enabled=this.quality!=='low';this.world.spot.castShadow=this.quality==='ultra';this.world.reflectors.forEach(p=>p.visible=this.quality==='ultra');this.world.rain.visible=false;this.world.moon.shadow.mapSize.setScalar(this.quality==='ultra'?2048:1024);if(this.world.moon.shadow.map){this.world.moon.shadow.map.dispose();this.world.moon.shadow.map=null;}$('quality-tag').textContent=this.quality.toUpperCase();this.resize();this.saveSettings();}
  resize(){const pixel=Math.min(devicePixelRatio,{low:1,medium:1,high:1.25,ultra:1.5}[this.quality]||1);this.renderer.setPixelRatio(pixel);this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();if(this.composer){this.composer.setPixelRatio(pixel);this.composer.setSize(innerWidth,innerHeight);this.ao.setSize(Math.floor(innerWidth*pixel*.5),Math.floor(innerHeight*pixel*.5));}}
  equipModel(){if(this.glove){this.glove.geometry.dispose();this.glove.material.dispose();}this.gun.clear();const weapon=WEAPONS[this.state.weapon],model=buildViewModel(this.world.assets[weapon.model]);this.gun.add(model);this.weaponModel=model;this.gun.position.copy(HIP_POSE);this.gun.rotation.set(0,0,0);
    // Gloved wrist beneath the receiver.
    const glove=new THREE.Mesh(new THREE.CapsuleGeometry(.034,.11,4,8),new THREE.MeshStandardMaterial({color:'#2c3730',roughness:.88}));glove.rotation.x=-.3;glove.position.set(.028,-.17,-.035);this.gun.add(glove);this.glove=glove;this.reloadTime=0;
  }
  start(){this.audio.stopMenuMusic();this.previewZombies?.forEach(m=>this.scene.remove(m));this.zombies.forEach(z=>this.releaseZombie(z));this.zombies=[];this.effects.forEach(e=>{this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();});this.effects=[];this.state=newRun();this.extraction=null;this.awaitingDecision=false;this.repair=null;this.world.resetDoor();this.bannerTime=0;this.hitTime=0;$('wave-banner').style.opacity=0;this.yaw=0;this.pitch=0;this.camera.position.set(0,1.7,10);this.camera.rotation.set(0,0,0);this.camera.fov=72;this.camera.updateProjectionMatrix();this.waveWait=3;this.toSpawn=0;this.spawnTimer=0;this.reloadTime=0;this.nextShot=0;this.sinceHit=100;this.recoil=0;this.navTimer=0;this.over=false;this.started=true;this.muzzle.intensity=0;this.flashMesh.visible=false;this.hudTimer=0;this.equipModel();$('menu').classList.add('hidden');$('hud').classList.remove('hidden');document.body.classList.add('playing');this.gun.visible=true;this.resume();this.notice('Repair the windows. Evacuation is offered every 5 rounds.');}
  resume(){if(!this.ready||this.over||this.awaitingDecision)return;this.playing=true;this.controls.active=true;this.controls.clear();this.audio.start();this.controls.lock();this.setTouch(this.touchMode);}
  pause(show=true){if(!this.playing)return;this.playing=false;this.controls.active=false;this.controls.clear();this.cancelRepair();$('touch-controls').classList.add('hidden');if(document.pointerLockElement)document.exitPointerLock();if(show)this.cb.onPause();}
  notice(text){document.body.classList.add('has-notice');$('toast').textContent=text;$('toast').style.opacity=1;this.toastTime=3;}
  reload(){if(!this.playing||this.reloadTime||!this.state.reserve||this.state.ammo===WEAPONS[this.state.weapon].clip)return;this.reloadTime=WEAPONS[this.state.weapon].reload*(this.state.perks.includes('speed')?.5:1);this.audio.reload();}
  interact(){
    if(!this.playing)return;
    const target=this.nearestStation();if(!target){this.notice('Move closer to a window, station or evacuation door');return;}
    if(target.type==='barricade'){
      this.notice(target.entry.boards===4?'Barricade fully repaired':'Hold E / USE to rebuild each board');return;
    }
    if(target.type==='extraction'){if(this.extraction){this.extraction.boarding=true;this.notice('Boarding · stay by the door for 5 seconds');}else this.notice('Evacuation available after every 5 cleared rounds');return;}
    const result=purchase(this.state,target.id);this.notice(result.message);if(!result.ok)return;this.audio.buy();
    if(target.type==='door'){this.world.openDoor(target.id);this.navTimer=0;}
    if(target.type==='weapon'||target.type==='box'){this.equipModel();if(target.type==='box')this.banner(this.state.weapon==='arc'?'BOX EXCLUSIVE / CHAIN LIGHTNING':'CACHE ACQUIRED',WEAPONS[this.state.weapon].name.split(' / ')[0]);}
    if(target.type==='ammo')this.reloadTime=0;
    if(target.id==='pulse'){for(const z of [...this.zombies]){z.stun=5;this.damageZombie(z,100,false);}this.audio.tone(900,1,'sawtooth',.25,50);this.pulseEffect();}
  }
  cancelRepair(){
    this.audio.stopRepair();
    if(!this.repair)return;const {entry,index}=this.repair;cancelBoardRepair(entry,index);if(entry.work?.owner==='player')entry.work=null;this.repair=null;
  }
  updateRepair(dt){
    const target=this.controls.interactHeld?this.nearestStation():null;
    const entry=target?.type==='barricade'?target.entry:null;
    const facing=entry?new THREE.Vector3(entry.x-this.camera.position.x,0,entry.z-this.camera.position.z).normalize().dot(new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw))):0;
    if(!entry||facing<.25||entry.boards===4||entry.climber||this.controls.fire||this.reloadTime){this.cancelRepair();return;}
    if(this.repair&&this.repair.entry!==entry)this.cancelRepair();
    if(!this.repair){
      if(entry.work)return;
      this.repair={entry,index:entry.boards,time:0};entry.work={owner:'player'};beginBoardRepair(entry,entry.boards);this.audio.startRepair();
    }
    const r=this.repair,previous=r.time;r.time=Math.min(.95,r.time+dt);poseBoardRepair(entry,r.index,r.time/.95);
    if(previous<.72&&r.time>=.72)this.audio.wood();
    if(r.time>=.95){this.audio.stopRepair();finishBoardRepair(entry,r.index);const result=repairBarricade(this.state,entry);entry.work=null;this.repair=null;this.audio.wood();if(result.reward)this.audio.play('cash',.9);this.notice(result.message);}
  }
  nearestStation(){
    let found=null,dist=2.55;const p=this.camera.position;
    const candidates=[...STATIONS,...this.world.entries.map(entry=>({id:entry.id,type:'barricade',name:entry.name,entry,x:entry.x,z:entry.z+entry.inward*.7,price:0,note:`${entry.boards}/4 boards · HOLD E / USE to repair${this.state.repairPoints<120?' · +10 PTS':''}`})),{...EXTRACTION,id:'evac',type:'extraction',price:0,note:this.extraction?'Board here · hold position for 5s':'Evacuation after every 5 rounds'}];
    for(const station of candidates){
      if(station.type==='door'&&gateIsOpen(this.state,station.id))continue;
      const d=Math.hypot(p.x-station.x,p.z-station.z);if(d>=dist)continue;
      const dir=new THREE.Vector3(station.x-p.x,0,station.z-p.z).normalize();
      if(wallDistance(p,dir,this.world.obstacles,this.state,d)<d-.75)continue;
      dist=d;found=station;
    }return found;
  }
  updateRecord(){let bank=0;try{bank=Number(localStorage.getItem('qz-salvage'))||0;}catch{}$('salvage-record').textContent=`${bank>=1500?'VETERAN':bank>=500?'PATHFINDER':bank>0?'SURVIVOR':'SALVAGE BANK'} / ${bank} SALVAGE`;}
  returnToMenu(){
    this.audio.stopLossMusic();this.pause(false);this.cancelRepair();this.controls.clear();this.started=false;this.over=false;this.awaitingDecision=false;this.extraction=null;
    this.zombies.forEach(z=>this.releaseZombie(z));this.zombies=[];
    this.effects.forEach(e=>{this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();});this.effects=[];
    this.world.resetDoor();this.gun.visible=false;this.muzzle.intensity=0;this.flashMesh.visible=false;
    this.state=newRun();this.camera.position.set(7,3.3,12);this.camera.fov=72;this.camera.updateProjectionMatrix();
    this.previewZombies?.forEach(m=>this.scene.add(m));
    $('menu').classList.remove('hidden');$('hud').classList.add('hidden');$('modal').classList.add('hidden');$('touch-controls').classList.add('hidden');document.body.classList.remove('playing','touch-active');
    this.updateRecord();$('best').textContent=`PERSONAL BEST / ${this.best?`ROUND ${this.best}`:'—'}`;this.audio.startMenuMusic();
  }
  offerExtraction(){this.awaitingDecision=true;this.pause(false);this.cb.onExtraction(this.state,extractionReward(this.state));}
  chooseExtraction(evacuate){
    if(!this.awaitingDecision)return;this.awaitingDecision=false;
    if(evacuate){this.extraction={remaining:45,boarding:false,progress:0};this.spawnTimer=.3;this.banner('45 SECONDS / REACH ARRIVAL', 'EVACUATE');}
    else{this.waveWait=8;this.banner('STAY AND FIGHT','NEXT EVAC IN 5 ROUNDS');}
    this.resume();
  }
  updateExtraction(dt){
    const e=this.extraction;e.remaining-=dt;
    const distance=Math.hypot(this.camera.position.x-EXTRACTION.x,this.camera.position.z-EXTRACTION.z);
    if(e.boarding&&distance<2.5)e.progress+=dt;else {e.progress=0;e.boarding=false;}
    if(e.progress>=5){this.state.salvage=extractionReward(this.state);let bank=0;try{bank=Number(localStorage.getItem('qz-salvage'))||0;localStorage.setItem('qz-salvage',String(bank+this.state.salvage));}catch{}this.state.salvageBank=bank+this.state.salvage;this.die(true);return;}
    if(e.remaining<=0){this.extraction=null;this.waveWait=8;this.banner('EVACUATION MISSED','SURVIVE TO THE NEXT WINDOW');return;}
    this.spawnTimer-=dt;if(this.spawnTimer<=0&&this.zombies.length<18){this.spawnZombie();this.spawnTimer=.75;}
  }
  banner(a,b){$('wave-banner').children[0].textContent=a;$('wave-banner').children[1].textContent=b;$('wave-banner').style.opacity=1;this.bannerTime=3.2;}
  newWave(){this.state.round++;this.state.repairPoints=0;const spec=waveSpec(this.state.round);this.toSpawn=spec.count;this.spawnTimer=.2;this.waveWait=0;this.banner(spec.brute?'BREACH WARNING / BRUTE INBOUND':'CONTAINMENT BREACH',`ROUND ${String(this.state.round).padStart(2,'0')}`);if(this.state.round>1)this.audio.wave();}
  makeZombie(){const mesh=cloneSkeleton(this.world.assets.infected);prepareAnimator(mesh);mesh.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});if(this.world.animations.infected.length){const mixer=new THREE.AnimationMixer(mesh);mixer.clipAction(this.world.animations.infected[0]).play();mixer.update(0);mesh.userData.mixer=mixer;}return mesh;}
  releaseZombie(z){if(z.entry?.work?.owner===z){shakeBoard(z.entry,z.action?.index??0,0);z.entry.work=null;}if(z.entry?.climber===z)z.entry.climber=null;this.scene.remove(z.mesh);if(this.zombiePool.length<24)this.zombiePool.push(z.mesh);}
  spawnZombie(){
    const open=reachableZones(this.state),p=this.camera.position;
    const entries=this.world.entries.filter(e=>open.includes(e.zone));
    const occupied=e=>this.zombies.filter(z=>z.entry===e&&z.entering).length;
    const available=entries.filter(e=>occupied(e)<3);if(!available.length)return false;
    const nearby=available.filter(e=>Math.hypot(e.x-p.x,e.z-p.z)<32);const pool=nearby.length?nearby:available;
    const entry=pool[Math.floor(Math.random()*pool.length)],spec=waveSpec(this.state.round);
    const brute=spec.brute&&!this.extraction&&this.toSpawn===spec.count,runner=!brute&&Math.random()<spec.runnerChance;
    const mesh=this.zombiePool.pop()||this.makeZombie();mesh.scale.setScalar(1);mesh.rotation.set(0,0,0);mesh.position.set(entry.x+(Math.random()-.5)*.9,0,entry.z-entry.inward*(2+occupied(entry)*.7));
    const speed=brute?spec.speed*.65:runner?Math.min(3.8,spec.speed*1.65):spec.speed*(.92+Math.random()*.16);
    const z={mesh,health:spec.health*(brute?3.2:runner?.72:1),speed,attack:0,stun:0,phase:Math.random()*6.28,entry,entering:true,vault:0,brute,runner,animationTime:0,action:null,hand:Math.random()<.5?-1:1,flank:(Math.random()<.5?-1:1)*(.35+Math.random()*1.1),passSide:Math.random()<.5?-1:1,routeTimer:0,decisionTimer:2+Math.random()*3,velocity:{x:0,z:0}};
    if(brute){mesh.scale.setScalar(1.22);this.notice('BRUTE AT THE WINDOWS · focus fire or use the purge');}
    mesh.userData.mixer?.update(Math.random());this.zombies.push(z);this.scene.add(mesh);return true;
  }
  // Breadth-first flow field routes the horde around crates and through the opened gate.
  buildNav(){const size=.65,x0=MAP_BOUNDS.minX,z0=MAP_BOUNDS.minZ,w=Math.ceil((MAP_BOUNDS.maxX-x0)/size)+1,h=Math.ceil((MAP_BOUNDS.maxZ-z0)/size)+1,key=this.state.openDoors.join('|');if(!this.navBlocked||this.navKey!==key){this.navBlocked=new Uint8Array(w*h);this.navKey=key;for(let j=0;j<h;j++)for(let i=0;i<w;i++)this.navBlocked[j*w+i]=!canOccupy(x0+i*size,z0+j*size,.32,this.world.obstacles,this.state);}const blocked=this.navBlocked,distance=new Int16Array(w*h).fill(-1);const tx=clamp(Math.round((this.camera.position.x-x0)/size),0,w-1),tz=clamp(Math.round((this.camera.position.z-z0)/size),0,h-1);const queue=[tz*w+tx];distance[queue[0]]=0;for(let k=0;k<queue.length;k++){const n=queue[k],x=n%w,z=Math.floor(n/w);for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,idx=nz*w+nx;if(nx>=0&&nz>=0&&nx<w&&nz<h&&!blocked[idx]&&distance[idx]<0){distance[idx]=distance[n]+1;queue.push(idx);}}}this.nav={size,w,h,x0,z0,distance};}
  updateZombieAction(z,dt){
    const a=z.action,m=z.mesh;a.time+=dt*(a.rate||1);actionPose(z,a.kind,a.time);
    if(a.kind==='tear'){
      if(!a.hit)shakeBoard(z.entry,a.index,Math.min(1,a.time/ACTIONS.tear.contact));
      if(!a.hit&&a.time>=ACTIONS.tear.contact){
        a.hit=true;if(z.entry.work?.owner===z&&z.entry.boards===a.index+1){z.entry.boards--;breakBoard(z.entry,a.index);if(m.position.distanceTo(this.camera.position)<18)this.audio.wood(true);}
      }
    }else if(a.kind==='climb'){
      const e=z.entry,offset=climbOffset(a.time);m.position.set(THREE.MathUtils.lerp(a.startX,e.x,Math.min(1,a.time*3)),offset.height,e.z+e.inward*offset.forward);
    }else if(a.kind==='attack'){
      if(!a.sound&&a.time>=.28){a.sound=true;this.audio.swipe();}
      if(!a.hit&&a.time>=ACTIONS.attack.contact){
        a.hit=true;const p=this.camera.position,dx=p.x-m.position.x,dz=p.z-m.position.z,dist=Math.hypot(dx,dz),dir=new THREE.Vector3(dx,0,dz).normalize();
        const facing=dir.x*Math.sin(m.rotation.y)+dir.z*Math.cos(m.rotation.y);
        if(dist<1.65&&facing>.4&&wallDistance(m.position.clone().setY(1.2),dir,this.world.obstacles,this.state,dist)>=dist){
          this.state.health=Math.max(0,this.state.health-(z.brute?42:z.runner?18:24));this.sinceHit=0;this.audio.hurt();if(this.state.health<=0)this.die();
        }
      }
    }
    if(a.time>=ACTIONS[a.kind].duration){
      if(a.kind==='tear'&&z.entry.work?.owner===z)z.entry.work=null;
      if(a.kind==='climb'){z.entering=false;z.entry.climber=null;m.position.y=0;z.routeTimer=0;}
      if(a.kind==='attack'){z.attack=.22+Math.random()*.45;z.hand*=-1;}
      z.action=null;
    }
  }
  moveZombies(dt){
    this.navTimer-=dt;if(this.navTimer<=0){this.navTimer=.55;this.buildNav();}
    const p=this.camera.position;
    for(const z of this.zombies){
      z.attack=Math.max(0,z.attack-dt);z.stun=Math.max(0,z.stun-dt);const m=z.mesh;
      if(z.stun){
        // Interrupt a wind-up or board pull; crossing the sill finishes before stun.
        if(z.action?.kind==='climb'){this.updateZombieAction(z,dt);continue;}
        if(z.action){if(z.entry.work?.owner===z){shakeBoard(z.entry,z.action.index??0,0);z.entry.work=null;}z.action=null;}continue;
      }
      if(z.action){this.updateZombieAction(z,dt);if(this.over)break;continue;}
      if(z.entering){
        const e=z.entry;m.rotation.y=e.inward>0?0:Math.PI;
        const others=this.zombies.filter(o=>o!==z&&o.entry===e&&o.entering);
        const ahead=others.some(o=>(o.mesh.position.z-m.position.z)*e.inward>0&&Math.abs(o.mesh.position.z-m.position.z)<.9);
        if(Math.abs(m.position.z-e.z)>.68){
          const step=ahead?0:Math.min(z.speed*dt,Math.max(0,Math.abs(m.position.z-e.z)-.66));m.position.z+=e.inward*step;walkPose(z,dt,step);
        }else if(e.boards>0){
          if(!e.work&&!e.climber){e.work={owner:z};z.action={kind:'tear',time:0,index:e.boards-1,rate:z.brute?1.4:.92+Math.random()*.16};}
          else walkPose(z,dt,0);
        }else if(!e.climber&&!e.work){
          e.climber=z;z.action={kind:'climb',time:0,startX:m.position.x};
        }else walkPose(z,dt,0);
        continue;
      }
      const dist=Math.hypot(p.x-m.position.x,p.z-m.position.z);
      if(dist<1.45&&z.attack<=0){
        const dir=new THREE.Vector3(p.x-m.position.x,0,p.z-m.position.z).normalize();
        if(wallDistance(m.position.clone().setY(1.2),dir,this.world.obstacles,this.state,dist)>=dist){m.rotation.y=Math.atan2(dir.x,dir.z);z.velocity={x:0,z:0};z.action={kind:'attack',time:0,rate:z.runner?1.1:z.brute?.9:1};continue;}
      }
      z.routeTimer-=dt;z.decisionTimer-=dt;
      if(z.decisionTimer<=0){z.decisionTimer=2.5+Math.random()*3;z.flank=z.passSide*(.35+Math.random()*1.05);}
      if(z.routeTimer<=0){z.routeTimer=.22+Math.random()*.20;z.target=pursuitTarget(z,p,this.nav,this.world.obstacles,this.state);}
      const target=z.target||p,desired=crowdVelocity(z,target,this.zombies),blend=1-Math.exp(-dt*8);
      z.velocity.x=THREE.MathUtils.lerp(z.velocity.x,desired.x,blend);z.velocity.z=THREE.MathUtils.lerp(z.velocity.z,desired.z,blend);
      const beforeX=m.position.x,beforeZ=m.position.z;
      const x=m.position.x+z.velocity.x*dt,zz=m.position.z+z.velocity.z*dt;
      if(Math.hypot(x-p.x,m.position.z-p.z)>.78&&canOccupy(x,m.position.z,.3,this.world.obstacles,this.state))m.position.x=x;
      if(Math.hypot(m.position.x-p.x,zz-p.z)>.78&&canOccupy(m.position.x,zz,.3,this.world.obstacles,this.state))m.position.z=zz;
      const travelled=Math.hypot(m.position.x-beforeX,m.position.z-beforeZ);
      const heading=dist<2?Math.atan2(p.x-m.position.x,p.z-m.position.z):Math.atan2(z.velocity.x,z.velocity.z);
      m.rotation.y+=Math.atan2(Math.sin(heading-m.rotation.y),Math.cos(heading-m.rotation.y))*Math.min(1,dt*7);m.rotation.z=0;m.position.y=0;
      walkPose(z,dt,travelled);
    }
  }
  shoot(){if(this.nextShot>0||this.reloadTime)return;if(this.state.ammo<=0){this.reload();if(!this.state.reserve){this.nextShot=.6;this.notice('Out of ammo · refill at the wall station');}return;}const w=WEAPONS[this.state.weapon];this.state.ammo--;this.nextShot=w.rate;this.recoil=this.controls.ads?.018:.035;this.muzzle.intensity=this.state.weapon==='arc'?13:30;this.flashMesh.visible=true;this.flashMesh.rotation.y=Math.random()*6;this.audio.shot(this.state.weapon);
    this.camera.updateMatrixWorld(true);const origin=this.camera.getWorldPosition(new THREE.Vector3());const impacts=new Map();let hitSound=false;
    for(let i=0;i<w.pellets;i++){
      const spread=this.controls.ads?(w.pellets>1?w.spread*.55:0):w.spread;
      const dir=new THREE.Vector3((Math.random()-.5)*spread,(Math.random()-.5)*spread,-1).applyQuaternion(this.camera.quaternion).normalize();
      const hit=traceShot(origin,dir,this.zombies,this.world.obstacles,this.state);
      const end=origin.clone().addScaledVector(dir,hit?.distance??35);
      if(hit){
        if(hit.zombie){const previous=impacts.get(hit.zombie)||{damage:0,head:false};previous.damage+=w.damage*(hit.head?2.7:1);previous.head||=hit.head;impacts.set(hit.zombie,previous);hitSound=true;}
        if(i<3)this.spark(end,hit.zombie?'#b07d49':'#efc37b');
      }
      if(w.chain){
        this.beam(origin,end);let last=end;const chained=new Set(hit?.zombie?[hit.zombie]:[]);
        if(hit?.zombie)for(let hop=1;hop<w.chain;hop++){
          const next=this.zombies.filter(z=>!chained.has(z)&&z.health>0).map(z=>({z,point:z.mesh.position.clone().add(new THREE.Vector3(0,1.1,0))})).filter(({point})=>point.distanceTo(last)<5).sort((a,b)=>a.point.distanceToSquared(last)-b.point.distanceToSquared(last)).find(({point})=>wallDistance(last,point.clone().sub(last).normalize(),this.world.obstacles,this.state,point.distanceTo(last))>=point.distanceTo(last)-.01);
          if(!next)break;chained.add(next.z);impacts.set(next.z,{damage:w.damage*Math.pow(.8,hop),head:false});this.beam(last,next.point);last=next.point;
        }
      }
    }
    // Aggregate pellets: at most one damage/audio event per enemy per trigger pull.
    for(const [z,hit] of impacts)this.damageZombie(z,hit.damage,hit.head,false);if(hitSound)this.audio.hit();
  }
  beam(start,end){if(this.effects.length>=40)return;const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints([start,end]),new THREE.LineBasicMaterial({color:'#a4e8ff',transparent:true,depthWrite:false}));this.scene.add(mesh);this.effects.push({mesh,ttl:.14,max:.14});}
  damageZombie(z,damage,head,sound=true){if(z.health<=0)return;z.health-=damage;this.state.points+=10;this.hitTime=.14;if(sound)this.audio.hit();if(z.health<=0){this.state.kills++;this.state.points+=100+(head?50:0);if(head)this.state.headshots++;this.releaseZombie(z);this.zombies.splice(this.zombies.indexOf(z),1);this.notice(head?'HEADSHOT +160':'ELIMINATION +110');}}
  spark(point,color){if(this.effects.length>=40)return;const geo=new THREE.BufferGeometry();const a=new Float32Array(18);for(let i=0;i<18;i++)a[i]=(Math.random()-.5)*.3;geo.setAttribute('position',new THREE.BufferAttribute(a,3));const mesh=new THREE.Points(geo,new THREE.PointsMaterial({color,size:.045,transparent:true,depthWrite:false}));mesh.position.copy(point);this.scene.add(mesh);this.effects.push({mesh,ttl:.25,max:.25});}
  pulseEffect(){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),new THREE.MeshBasicMaterial({color:'#8fddff',wireframe:true,transparent:true,opacity:.3,depthWrite:false}));mesh.position.set(7.5,1,3.5);this.scene.add(mesh);this.effects.push({mesh,ttl:.8,max:.8,pulse:true});}
  die(evacuated=false){if(this.over)return;this.state.evacuated=evacuated;this.over=true;this.pause(false);if(!evacuated)this.audio.startLossMusic();this.best=Math.max(this.best,this.state.round);try{localStorage.setItem('qz-best',this.best);}catch{}this.cb.onGameOver(this.state);}
  update(dt){this.state.elapsed+=dt;this.sinceHit+=dt;this.nextShot=Math.max(0,this.nextShot-dt);this.state.cooldown=Math.max(0,this.state.cooldown-dt);regenerate(this.state,dt,this.sinceHit);this.controls.update(dt);
    const move=this.controls.movement,length=Math.max(1,Math.hypot(move.x,move.y));const sprint=this.controls.keys.has('ShiftLeft')||this.controls.keys.has('ShiftRight')||(this.controls.touch&&Math.hypot(move.x,move.y)>.85);const speed=this.controls.ads?2.25:sprint?6:4;const vx=(move.x*Math.cos(this.yaw)+move.y*Math.sin(this.yaw))/length*speed*dt,vz=(-move.x*Math.sin(this.yaw)+move.y*Math.cos(this.yaw))/length*speed*dt;const p=this.camera.position;
    if(canOccupy(p.x+vx,p.z,.35,this.world.obstacles,this.state))p.x+=vx;if(canOccupy(p.x,p.z+vz,.35,this.world.obstacles,this.state))p.z+=vz;p.y=1.7+(Math.abs(move.x)+Math.abs(move.y)>.1&&!this.controls.ads?Math.sin(this.time*speed*2.5)*.025:0);
    this.camera.rotation.set(this.pitch+this.recoil*.3,this.yaw,0);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,this.controls.ads?48:72,1-Math.exp(-dt*12));this.camera.updateProjectionMatrix();
    if(this.reloadTime>0){this.reloadTime-=dt;if(this.reloadTime<=0){this.reloadTime=0;finishReload(this.state);this.audio.reload();}}
    this.updateRepair(dt);if(this.controls.fire)this.shoot();
    if(this.extraction)this.updateExtraction(dt);else if(this.waveWait>0){this.waveWait-=dt;if(this.waveWait<=0)this.newWave();}else{this.spawnTimer-=dt;if(this.toSpawn>0&&this.spawnTimer<=0&&this.zombies.length<24){if(this.spawnZombie())this.toSpawn--;this.spawnTimer=waveSpec(this.state.round).spawnDelay;}if(this.toSpawn===0&&this.zombies.length===0){this.state.points+=200;this.state.completedRounds=this.state.round;this.waveWait=8;if(canExtract(this.state)){this.offerExtraction();return;}this.banner('SECTOR SECURED / +200','REPAIR / REARM / REPOSITION');}}
    if(!this.playing)return;this.moveZombies(dt);
    this.updateViewModel(dt,move);this.recoil=Math.max(0,this.recoil-dt*.5);this.muzzle.intensity=Math.max(0,this.muzzle.intensity-dt*500);this.flashMesh.visible=this.muzzle.intensity>4;this.flash.intensity=this.flashEnabled?9:0;
  }
  updateViewModel(dt,move={x:0,y:0}){const target=(this.controls.ads?AIM_POSE:HIP_POSE).clone();if(!this.controls.ads)target.x+=Math.abs(move.x)+Math.abs(move.y)>.1?Math.sin(this.time*9)*.005:0;if(this.reloadTime||this.repair)target.y-=.20;target.z+=this.recoil*.5;this.gun.position.lerp(target,1-Math.exp(-dt*18));this.gun.rotation.set(this.recoil*.6,0,this.reloadTime?-.35:0);this.camera.updateMatrixWorld(true);const muzzle=this.weaponModel.getObjectByName('muzzle');if(muzzle&&this.muzzle){const at=this.camera.worldToLocal(muzzle.getWorldPosition(new THREE.Vector3()));this.muzzle.position.copy(at);this.flashMesh.position.copy(at);}}
  hud(dt){this.hudTimer-=dt;if(this.hudTimer>0)return;this.hudTimer=.08;const s=this.state;$('round').textContent=String(s.round||1).padStart(2,'0');$('remaining').textContent=this.extraction?`EVAC ${Math.ceil(this.extraction.remaining)}s · ${this.extraction.boarding?'BOARDING '+Math.ceil(5-this.extraction.progress)+'s':'REACH ARRIVAL DOOR'}`:this.awaitingDecision?'EVACUATE OR CONTINUE':this.waveWait>0?`NEXT WAVE IN ${Math.ceil(this.waveWait)}s`:`${this.zombies.length+this.toSpawn} INFECTED REMAINING`;$('points').textContent=s.points.toLocaleString();$('health').textContent=Math.ceil(s.health);$('health-fill').style.width=`${s.health/s.maxHealth*100}%`;$('regen-label').textContent=this.sinceHit>5&&s.health<s.maxHealth?'RECOVERING':'VITALS';$('ammo').textContent=String(s.ammo).padStart(2,'0');$('reserve').textContent=s.reserve;$('weapon-name').textContent=WEAPONS[s.weapon].name;$('reload-hint').textContent=this.reloadTime>0?'RELOADING…':s.ammo===0?'RELOAD REQUIRED':this.controls.touch?'TAP ↻ TO RELOAD':'R  /  RELOAD';$('perks').innerHTML=s.perks.map(p=>`<span>${{vital:'♥ VITAL',speed:'ϟ QUICK',regen:'+ WIND'}[p]}</span>`).join('');$('objective-text').textContent=s.door?'Containment open. Find the mystery cache.':'Hold the line. Open containment.';
    const zone=zoneAt(this.camera.position.x,this.camera.position.z);$('objective-text').textContent=this.extraction?`EVAC → ARRIVAL · ${Math.ceil(Math.hypot(this.camera.position.x-EXTRACTION.x,this.camera.position.z-EXTRACTION.z))}m · ${extractionReward(s)} SALVAGE`:zone.description;document.querySelector('.objective .micro').textContent=`${zone.number} / ${zone.name}`;updateMapHud(this.state,this.camera.position.x,this.camera.position.z);
    const station=this.playing?this.nearestStation():null;$('interaction').classList.toggle('hidden',!station);if(station){$('interaction-title').textContent=station.name;$('interaction-detail').textContent=`${station.price?station.price.toLocaleString()+' PTS · ':''}${station.note}`;$('interaction').querySelector('kbd').textContent=station.type==='barricade'?(this.controls.touch?'HOLD USE':'HOLD E'):(this.controls.touch?'USE':'E');}$('repair-progress').classList.toggle('hidden',!station||station.type!=='barricade');$('repair-progress').value=this.repair?this.repair.time/.95:0;$('repair-progress').setAttribute('aria-label',this.repair?`Restoring board ${this.repair.index+1} of 4`:'Hold to repair');$('crosshair').style.opacity=this.controls.ads?0:1;
  }
  frame(ms){requestAnimationFrame(t=>this.frame(t));const elapsed=(ms-(this.last||ms))/1000;const dt=Math.min(.05,elapsed);this.last=ms;this.time+=dt;if(this.playing)this.update(dt);else if(!this.started){this.camera.position.x=7+Math.sin(this.time*.09)*.8;this.camera.lookAt(-1,1.9,-5);this.previewZombies?.forEach((z,i)=>{z.rotation.z=Math.sin(this.time+i)*.015;});}
    this.world.animate(dt,this.time,this.camera.position,this.playing?dt:0);this.effects=this.effects.filter(e=>{e.ttl-=dt;if(e.ttl<=0){this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();return false;}e.mesh.material.opacity=e.ttl/e.max;if(e.pulse)e.mesh.scale.setScalar(1+(1-e.ttl/e.max)*24);return true;});
    if(this.bannerTime>0){this.bannerTime-=dt;if(this.bannerTime<=0)$('wave-banner').style.opacity=0;}if(this.toastTime>0){this.toastTime-=dt;if(this.toastTime<=0){$('toast').style.opacity=0;document.body.classList.remove('has-notice');}}this.hitTime=Math.max(0,this.hitTime-dt);$('hitmarker').style.opacity=this.hitTime>0?1:0;$('damage').style.opacity=this.started?Math.max(0,(1-this.state.health/this.state.maxHealth)*.50+(this.sinceHit<.4?.4:0)):0;
    if(this.started)this.hud(dt);this.frames++;this.fpsTime+=elapsed;if(this.fpsTime>1){$('fps').textContent=`${Math.round(this.frames/this.fpsTime)} FPS`;this.frames=0;this.fpsTime=0;}this.renderer.info.reset();this.composer.render(dt);
  }
}
