import {createBoards,resetBoards,animateBoards} from './barricades.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { STATIONS } from './rules.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GATES,ZONES,ENTRIES,EXTRACTION } from './map.js';

export async function createWorld(renderer,progress){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#111e25');scene.fog=new THREE.FogExp2('#15262c',.020);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.20;room.dispose();pmrem.dispose();
  const files={pistol:'weapon-pistol',carbine:'weapon-carbine',shotgun:'weapon-shotgun',smg:'weapon-smg',arc:'weapon-arc',infected:'infected-runtime',barrel:'barrel','supply-crate':'supply-crate',vital:'perk-vital',speed:'perk-speed',regen:'perk-regen',pump:'map-pump',generator:'map-generator',medbay:'map-medbay',gate:'map-gate-frame',relay:'map-relay'};
  const loader=new GLTFLoader(),assets={},animations={};let done=0;
  await Promise.all(Object.entries(files).map(async([name,file])=>{const g=await loader.loadAsync(`/assets/${file}.glb`);assets[name]=g.scene;animations[name]=g.animations;progress(++done/Object.keys(files).length);}));
  const maps=await Promise.all(['Diffuse','nor_gl','Rough','AO'].map(n=>new THREE.TextureLoader().loadAsync(`/assets/concrete_floor_worn_001_${n}.jpg`)));
  maps.forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(7,5);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());});maps[0].colorSpace=THREE.SRGBColorSpace;
  const concrete=new THREE.MeshStandardMaterial({color:'#718082',map:maps[0],normalMap:maps[1],normalScale:new THREE.Vector2(.6,.6),roughnessMap:maps[2],roughness:.62,metalness:.12,aoMap:maps[3]});
  const wallMaps=maps.map(t=>{const c=t.clone();c.repeat.set(3,1.2);return c;});
  const wall=new THREE.MeshStandardMaterial({color:'#75827e',map:wallMaps[0],normalMap:wallMaps[1],roughness:.88,aoMap:wallMaps[3]});
  const steel=new THREE.MeshStandardMaterial({color:'#333e3d',metalness:.85,roughness:.37}),dark=new THREE.MeshStandardMaterial({color:'#1d292b',metalness:.55,roughness:.58}),orange=new THREE.MeshStandardMaterial({color:'#806443',metalness:.65,roughness:.58});
  const paint=new THREE.MeshStandardMaterial({color:'#a69e64',roughness:.77});
  const obstacles=[],solids=[],gateObjects=new Map(),doorObjects=[],lights=[],reflectors=[],markers=[],landmarks=[];
  const cube=new THREE.BoxGeometry(1,1,1),staticMeshes=[];
  function box(x,y,z,w,h,d,mat=wall,collide=false,door=null){const m=new THREE.Mesh(cube,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;scene.add(m);if(collide){obstacles.push({x,z,w,d,door,bottom:y-h/2,top:y+h/2});solids.push(m);m.userData.solid=true;}if(door){if(!gateObjects.has(door))gateObjects.set(door,[]);gateObjects.get(door).push(m);if(door==='door')doorObjects.push(m);}if(!door)staticMeshes.push(m);return m;}
  function model(name,x,z,s=1,rotation=0,collision=null){const g=assets[name].clone(true);g.position.set(x,0,z);g.scale.setScalar(s);g.rotation.y=rotation;g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;staticMeshes.push(o);}});scene.add(g);if(collision){const [w,d]=collision;const bounds=new THREE.Box3().setFromObject(g);obstacles.push({x,z,w,d,bottom:bounds.min.y,top:bounds.max.y});solids.push(g);}landmarks.push(g);return g;}
  function sign(text,sub,color,w=3.1,h=.86){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#121b1b';ctx.fillRect(0,0,1024,256);ctx.strokeStyle=color;ctx.lineWidth=6;ctx.strokeRect(9,9,1006,238);ctx.fillStyle=color;ctx.font='bold 54px sans-serif';ctx.fillText(text,32,103);ctx.font='28px monospace';ctx.fillStyle='#c4cfc8';ctx.fillText(sub,32,186);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:'#ffffff',emissiveIntensity:.45,roughness:.7}));}
  function lamp(x,y,z,color,power=90){const l=new THREE.PointLight(color,power,14,2);l.position.set(x,y,z);box(x,y,z,1.1,.08,.14,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:4}));lights.push(l);return l;}
  for(const zone of ZONES){
    const floor=concrete.clone();if(zone.id==='lab')floor.color.set('#909b91');else if(zone.id==='foundry')floor.color.set('#78756c');
    box(zone.x,-.15,zone.z,28,.3,20,floor);
    // A sealed roof with deep cross beams and inset service panels.
    box(zone.x,5.3,zone.z,28,.3,20,dark);
    for(let offset=-8;offset<=8;offset+=4){box(zone.x,5.04,zone.z+offset,27,.32,.22,steel);}
    for(const side of [-1,1])box(zone.x+side*5,5.08,zone.z,.65,.12,19,steel);
    const placard=sign(`${zone.number} / ${zone.name}`,zone.description.toUpperCase(),zone.color,6,1.35);placard.position.set(zone.x,3.4,zone.z-9.64);scene.add(placard);
    for(const x of [-10,10])for(const z of [-7,7]){box(zone.x+x,2.55,zone.z+z,.45,5.1,.45,steel,true);box(zone.x+x,.35,zone.z+z,.6,.7,.6,orange);}
    for(const z of [-7,7])box(zone.x,5.05,zone.z+z,21,.25,.3,steel);
    for(let z=-8;z<=8;z+=2.4)for(const x of [-3.3,3.3])box(zone.x+x,.01,zone.z+z,.08,.012,1.1,paint);
    lamp(zone.x-9.6,4.1,zone.z-6.8,zone.color,115);lamp(zone.x+9.6,4.1,zone.z+6.8,zone.id==='foundry'?'#ff884a':'#abc7c1',110);
  }
  box(-42,2.5,-5,.65,5,40,wall,true);box(42,2.5,-5,.65,5,40,wall,true);
  // Cut real windows into both exterior walls; the sill prevents player escape.
  for(const edge of [15,-25]){
    const apertures=ENTRIES.filter(e=>e.z===edge).sort((a,b)=>a.x-b.x);let cursor=-42;
    for(const e of apertures){const left=e.x-1.3;if(left>cursor)box((cursor+left)/2,2.5,edge,left-cursor,5,.65,wall,true);box(e.x,.28,edge,2.6,.56,.65,wall,true);box(e.x,4.05,edge,2.6,1.9,.65,wall,true);cursor=e.x+1.3;}
    box((cursor+42)/2,2.5,edge,42-cursor,5,.65,wall,true);
  }
  const entries=ENTRIES.map(e=>{
    const entry={...e,boards:4};const boards=createBoards(scene,entry);
    for(const side of [-1,1])box(e.x+side*1.4,1.85,e.z,.15,2.9,.85,steel);
    box(e.x,-.1,e.z-e.inward*2,3,.2,5,concrete);
    // Dark service tunnel gives attackers a visible approach instead of popping inside.
    box(e.x,3.1,e.z-e.inward*2,3,.2,4,dark);
    for(const side of [-1,1])box(e.x+side*1.55,1.5,e.z-e.inward*2,.15,3,4,dark);
    const label=sign('BREACH / '+e.id.toUpperCase(),'HOLD E / REBUILD BOARDS','#d8ba80',2.5,.38);label.position.set(e.x,3.38,e.z+e.inward*.38);label.rotation.y=e.inward<0?Math.PI:0;scene.add(label);
    return {...entry,boardMeshes:boards};
  });
  const evacuation=new THREE.Group();evacuation.position.set(EXTRACTION.x,0,14.55);
  const exitPanel=new THREE.Mesh(new THREE.BoxGeometry(3.3,3.3,.12),steel);exitPanel.position.y=1.65;evacuation.add(exitPanel);
  const exitSign=sign('EVAC / BLACKWATER','EVERY 5 ROUNDS / RETURN HERE','#8ee0b0',3.4,.6);exitSign.position.set(0,3.8,-.12);exitSign.rotation.y=Math.PI;evacuation.add(exitSign);
  for(const x of [-1.55,1.55]){const strip=new THREE.Mesh(new THREE.BoxGeometry(.08,3.3,.16),new THREE.MeshBasicMaterial({color:'#8ee0b0'}));strip.position.set(x,1.65,-.12);evacuation.add(strip);}scene.add(evacuation);
  for(const gate of GATES){
    const horizontal=gate.axis==='x',half=horizontal?14:10,gap=2.2,chunk=half-gap;
    for(const side of [-1,1]){
      const offset=side*(half+gap)/2;
      const start=gate.x+offset-chunk/2,end=start+chunk;
      const windows=horizontal?ENTRIES.filter(e=>e.z===gate.z&&e.x>start&&e.x<end):[];
      if(!windows.length){box(gate.x+(horizontal?offset:0),2.2,gate.z+(horizontal?0:offset),horizontal?chunk:.55,4.4,horizontal?.55:chunk,wall,true);continue;}
      let cursor=start;for(const e of windows){const left=e.x-1.3;box((cursor+left)/2,2.2,gate.z,left-cursor,4.4,.55,wall,true);box(e.x,.28,gate.z,2.6,.56,.55,wall,true);box(e.x,3.75,gate.z,2.6,1.3,.55,wall,true);cursor=e.x+1.3;}
      box((cursor+end)/2,2.2,gate.z,end-cursor,4.4,.55,wall,true);
    }
    model('gate',gate.x,gate.z,1,horizontal?0:Math.PI/2);
    box(gate.x,1.48,gate.z,horizontal?4.39:.34,2.96,horizontal?.34:4.39,dark,true,gate.id);
    for(let i=-2;i<=2;i++){const offset=i*.79;const m=box(gate.x+(horizontal?offset:0),1.46,gate.z+(horizontal?-.20:offset),horizontal?.17:.08,2.95,horizontal?.08:.17,orange,false,gate.id);if(horizontal)m.rotation.z=-.20;else m.rotation.x=.20;}
    for(const side of [-1,1]){const panel=sign(gate.name,`${gate.price.toLocaleString()} PTS / E TO OPEN`,'#dfb67e',3.8,.68);panel.position.set(gate.x+(horizontal?0:side*.33),2.1,gate.z+(horizontal?side*.33:0));panel.rotation.y=horizontal?(side===1?0:Math.PI):(side===1?Math.PI/2:-Math.PI/2);scene.add(panel);gateObjects.get(gate.id).push(panel);}
  }
  for(const [x,z,s]of[[-8,5,1.4],[-8,6.25,1.1],[9,9,1.2],[10.1,9.5,1]])model('supply-crate',x,z,s,.13,[s,s]);
  for(const [x,z]of[[-11,10],[-11.8,10.8],[11,1],[11.8,1.7]])model('barrel',x,z,1,0,[.75,.75]);
  model('generator',7.5,3.5,.72,0,[2.3,1.25]);
  for(let z=-3;z<14;z+=.48)box(11.5,.012,z,.6,.015,.09,steel);
  // Pump hall: motor skids and service pipes, with clear circulation lanes.
  for(const [x,z]of[[-34,2],[-24,8]])model('pump',x,z,1.55,0,[4.0,2.6]);
  for(const z of [1,2.1]){const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,24,16),orange);pipe.rotation.z=Math.PI/2;pipe.position.set(-28,3.7,z);scene.add(pipe);}
  for(const x of [-37,-20])box(x,1.2,-1.5,2.5,2.4,1.7,dark,true);
  // Foundry: generators, furnace glow and steel stock.
  model('generator',24,1,1.25,Math.PI/2,[2.2,3.8]);model('generator',35,1,1.25,Math.PI/2,[2.2,3.8]);
  box(28,1.6,11.5,5,3.2,2.4,steel,true);box(28,1.5,10.28,3.7,1.8,.04,new THREE.MeshStandardMaterial({color:'#cf642c',emissive:'#f67c25',emissiveIntensity:1.8}));lamp(28,2,9.8,'#ff7835',110);
  for(let i=0;i<5;i++)box(38,.25+i*.20,-1.8,3.2,.17,.5,steel,true);
  // Medical lab: treatment bays, lockers and a perk alcove.
  for(const [x,z]of[[-34,-12],[-23,-18]])model('medbay',x,z,1.25,0,[2.2,3.0]);
  for(const x of [-36,-22]){box(x,1.2,-23.6,4.0,2.4,1.0,dark,true);for(let i=0;i<4;i++)box(x-1.5+i,1.25,-23.07,.82,2.1,.05,steel);}
  box(-28,1,-16.2,3,.10,.6,new THREE.MeshStandardMaterial({color:'#858e86',metalness:.4,roughness:.55}));for(const x of [-29.2,-26.8])box(x,.5,-16.2,.1,1,.5,steel,true);
  // Relay station: original mast, backup generator and control consoles.
  model('relay',28,-15,1.25,0,[2.3,2.3]);model('generator',20,-20,1,0,[3,1.8]);
  for(const x of [23,27,31]){box(x,.65,-23.4,2.4,1.3,1.2,dark,true);box(x,1.6,-23.55,1.5,.7,.14,new THREE.MeshStandardMaterial({color:'#427877',emissive:'#75c8af',emissiveIntensity:.45}));}
  // Containment: supply cache and barred holding pens.
  for(const x of [-8,-4,0,4]){box(x,1.6,-23.5,2.9,3.2,1.7,dark,true);for(let j=0;j<6;j++)box(x-1.1+j*.43,1.5,-22.6,.035,2.8,.045,steel);}
  for(const [x,z]of[[-10,-18],[7,-20]])model('supply-crate',x,z,1.2,.1,[1.2,1.2]);
  for(let i=0;i<12;i++)box(Math.sin(i*4.8)*50,7+i%5,-38-Math.abs(Math.cos(i*3))*15,4+i%4,14+i%5*3,5,dark);
  const hemi=new THREE.HemisphereLight('#9bbac9','#384038',1.35);scene.add(hemi);
  const moon=new THREE.DirectionalLight('#b4d3e7',2.5);moon.position.set(-16,25,-12);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:75});moon.shadow.bias=-.0003;moon.shadow.normalBias=.035;scene.add(moon,moon.target);
  const spot=new THREE.SpotLight('#ffd4a1',430,35,Math.PI/5,.65,1.8);spot.position.set(10,7,12);spot.target.position.set(0,0,0);spot.castShadow=true;spot.shadow.mapSize.set(1024,1024);spot.shadow.bias=-.0003;scene.add(spot,spot.target);
  const alarm=lamp(0,3.45,-4.45,'#ff6940',50);
  for(const [x,z,w,h]of[[1,5,7,8],[-28,7,6,6],[29,-17,5,5]]){
    const p=new Reflector(new THREE.PlaneGeometry(w,h),{textureWidth:512,textureHeight:512,color:0x657a80,clipBias:.003});p.rotation.x=-Math.PI/2;p.position.set(x,.018,z);p.material.transparent=true;p.material.depthWrite=false;p.material.uniforms.rippleTime={value:0};
    p.material.vertexShader=p.material.vertexShader.replace('varying vec4 vUv;','varying vec4 vUv; varying vec2 puddleUv;').replace('vUv = textureMatrix','puddleUv = uv; vUv = textureMatrix');
    p.material.fragmentShader=p.material.fragmentShader.replace('varying vec4 vUv;','varying vec4 vUv; varying vec2 puddleUv; uniform float rippleTime;').replace('vec4 base = texture2DProj( tDiffuse, vUv );',`vec2 q=puddleUv*2.0-1.0;float edge=length(q)+sin(q.x*13.0+q.y*8.0)*.065+cos(q.y*19.0-q.x*6.0)*.04;float alpha=(1.0-smoothstep(.67,.94,edge))*.57;if(alpha<.005)discard;vec2 uv2=vUv.xy/vUv.w;uv2+=vec2(sin(puddleUv.y*110.0+rippleTime*2.0),cos(puddleUv.x*90.0-rippleTime))*.0008;vec4 base=texture2D(tDiffuse,uv2)*.4;base+=texture2D(tDiffuse,uv2+vec2(.002,0))*.15;base+=texture2D(tDiffuse,uv2-vec2(.002,0))*.15;base+=texture2D(tDiffuse,uv2+vec2(0,.002))*.15;base+=texture2D(tDiffuse,uv2-vec2(0,.002))*.15;`).replace('vec4( blendOverlay( base.rgb, color ), 1.0 )','vec4( blendOverlay( base.rgb, color ), alpha )');scene.add(p);reflectors.push(p);
  }
  for(const s of STATIONS){if(s.type==='door')continue;const g=new THREE.Group();g.position.set(s.x,0,s.z);g.rotation.y=s.rotation??(s.x===-12.7?Math.PI/2:s.x===12.7?-Math.PI/2:0);
    const panel=sign(s.name,`${s.price.toLocaleString()} PTS / ${s.type.toUpperCase()}`,s.color,2.1,.58);panel.position.y=s.type==='perk'?2.14:2.05;g.add(panel);
    if(s.type==='perk')g.add(assets[s.id].clone(true));
    if(s.type==='box'){const body=new THREE.Mesh(new THREE.BoxGeometry(2,.8,.85),orange);body.position.y=.4;g.add(body);for(const x of [-.7,.7]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.08,.82,.88),steel);strap.position.set(x,.4,0);g.add(strap);}const strip=new THREE.Mesh(new THREE.BoxGeometry(1.8,.035,.9),new THREE.MeshBasicMaterial({color:s.color}));strip.position.y=.82;g.add(strip);}
    if(s.type==='weapon'){const gun=assets[s.id].clone(true);gun.rotation.y=Math.PI/2;gun.position.set(-.25,1.32,0);gun.scale.setScalar(1.5);g.add(gun);}
    scene.add(g);markers.push(g);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});if(s.type==='perk'||s.type==='box'){obstacles.push({x:s.x,z:s.z,w:s.type==='box'?2.1:1.2,d:1.0});solids.push(g);}
  }
  const rainPos=new Float32Array(1250*6);for(let i=0;i<1250;i++){let x=Math.random()*38-19,y=Math.random()*13,z=Math.random()*40-20;rainPos.set([x,y,z,x+.025,y+.18,z],i*6);}const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#bbd3d9',transparent:true,opacity:.22,depthWrite:false}));scene.add(rain);
  scene.updateMatrixWorld(true);
  const batches=new Map();
  for(const mesh of staticMeshes){
    if(Array.isArray(mesh.material))continue;
    const p=mesh.getWorldPosition(new THREE.Vector3());const key=mesh.material.uuid+':'+Math.floor((p.x+42)/28)+':'+Math.floor((p.z+25)/20);
    if(!batches.has(key))batches.set(key,{material:mesh.material,geometries:[]});
    const geo=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);for(const name of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(name))geo.deleteAttribute(name);
    if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
    batches.get(key).geometries.push(geo.index?geo.toNonIndexed():geo);if(geo.index)geo.dispose();mesh.visible=false;
  }
  for(const batch of batches.values()){const geo=mergeGeometries(batch.geometries);batch.geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geo,batch.material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}
  // Fixed light count avoids shader recompilation and caps per-fragment lighting work.
  const activeLights=Array.from({length:4},()=>{const l=new THREE.PointLight();scene.add(l);return l;});
  let lightTimer=0;
  return {scene,assets,animations,obstacles,solids,gateObjects,doorObjects,lights,reflectors,rain,moon,spot,markers,landmarks,entries,evacuation,activeLights,
    animate(dt,time,player,simulationDt=dt){
      lightTimer-=dt;if(player&&lightTimer<=0){lightTimer=.3;const nearest=[...lights].sort((a,b)=>a.position.distanceToSquared(player)-b.position.distanceToSquared(player));activeLights.forEach((l,i)=>{const source=nearest[i];l.position.copy(source.position);l.color.copy(source.color);l.intensity=source.intensity;l.distance=source.distance;l.decay=source.decay;});}
      for(const entry of entries)animateBoards(entry,simulationDt);
      rain.position.y=-((time*7)%12);if(rain.position.y<-6)rain.position.y+=12;if(player){rain.position.x=player.x;rain.position.z=player.z;moon.position.set(player.x-16,25,player.z-12);moon.target.position.set(player.x,0,player.z);}alarm.intensity=50*(.86+Math.sin(time*13)*.08);reflectors.forEach(p=>p.material.uniforms.rippleTime.value=time);},
    openDoor(id='door'){(gateObjects.get(id)||[]).forEach(o=>{scene.remove(o);const idx=solids.indexOf(o);if(idx>=0)solids.splice(idx,1);});},
    resetDoor(){for(const e of entries)resetBoards(e);for(const objects of gateObjects.values())for(const o of objects){scene.add(o);if(o.userData.solid&&!solids.includes(o))solids.push(o);}},
  };
}
