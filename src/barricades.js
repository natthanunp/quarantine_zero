import * as THREE from 'three';
const smooth=t=>t*t*(3-2*t);
const wood=new THREE.MeshStandardMaterial({color:'#75604a',roughness:.96});
wood.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 boardPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nboardPosition=position;');
  shader.fragmentShader='varying vec3 boardPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=sin(boardPosition.y*230.0+sin(boardPosition.x*4.0)*2.5);diffuseColor.rgb*=.87+.13*grain;');
};
function fragment(left){
  const shape=new THREE.Shape();
  const points=left?[[-1.325,-.115],[-.12,-.115],[.04,-.06],[-.07,-.01],[.10,.05],[-.04,.115],[-1.325,.115]]:[[-.12,-.115],[1.325,-.115],[1.325,.115],[-.04,.115],[.10,.05],[-.07,-.01],[.04,-.06]];
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  return new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false});
}
const pieces=[fragment(true),fragment(false)];
export function createBoards(scene,entry){
  entry.boardStates=Array.from({length:4},(_,i)=>{
    const group=new THREE.Group();group.position.set(entry.x,.82+i*.41,entry.z+entry.inward*.12);group.rotation.z=(i%2?1:-1)*.06;
    const halves=pieces.map(geometry=>{const mesh=new THREE.Mesh(geometry,wood);mesh.castShadow=true;group.add(mesh);return mesh;});scene.add(group);
    return {group,halves,anchor:group.position.clone(),angle:group.rotation.z,mode:'fixed',age:0};
  });
  entry.work=null;entry.climber=null;return entry.boardStates.map(b=>b.group);
}
export function resetBoards(entry){
  entry.boards=4;entry.work=null;entry.climber=null;
  for(const b of entry.boardStates){b.mode='fixed';b.age=0;b.group.visible=true;b.group.position.copy(b.anchor);b.group.rotation.set(0,0,b.angle);b.halves.forEach(p=>{p.position.set(0,0,0);p.rotation.set(0,0,0);});}
}
export function shakeBoard(entry,index,progress){
  const b=entry.boardStates[index];if(!b||b.mode!=='fixed')return;
  const amount=Math.sin(progress*Math.PI)*.07;
  b.group.position.z=b.anchor.z+entry.inward*Math.sin(progress*23)*amount;
  b.group.rotation.x=Math.sin(progress*17)*amount;
}
export function breakBoard(entry,index){
  const b=entry.boardStates[index];if(!b)return;
  b.mode='falling';b.age=0;b.group.position.copy(b.anchor);b.group.rotation.set(0,0,b.angle);
}
export function beginBoardRepair(entry,index){
  const b=entry.boardStates[index];b.mode='repair';
  b.startPosition=b.group.position.clone();b.startRotation=b.group.quaternion.clone();
  b.starts=b.halves.map(p=>({position:p.position.clone(),rotation:p.quaternion.clone()}));
}
export function poseBoardRepair(entry,index,t){
  const b=entry.boardStates[index],ease=smooth(THREE.MathUtils.clamp(t,0,1));
  b.group.position.lerpVectors(b.startPosition,b.anchor,ease);
  b.group.quaternion.copy(b.startRotation).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,b.angle)),ease);
  b.halves.forEach((p,i)=>{p.position.copy(b.starts[i].position).multiplyScalar(1-ease);p.quaternion.copy(b.starts[i].rotation).slerp(new THREE.Quaternion(),ease);});
}
export function finishBoardRepair(entry,index){const b=entry.boardStates[index];poseBoardRepair(entry,index,1);b.mode='fixed';b.dropOrigin=null;}
export function cancelBoardRepair(entry,index){const b=entry.boardStates[index];b.mode='falling';b.age=0;b.dropOrigin=b.group.position.clone();}
export function animateBoards(entry,dt){
  for(const [i,b] of entry.boardStates.entries()){
    if(b.mode!=='falling')continue;b.age+=dt;const t=b.age;
    const from=b.dropOrigin||b.anchor;
    b.group.position.set(from.x,Math.max(.12,from.y+.6*t-4.9*t*t),from.z+entry.inward*Math.min(.8,t*1.6));
    b.group.rotation.set(Math.min(Math.PI/2,t*2.8),0,b.angle);
    b.halves.forEach((p,j)=>{const side=j?1:-1;p.position.set(side*Math.min(.34,t*.65),0,0);p.rotation.set(0,side*Math.min(.25,t),side*Math.min(.18,t*.4));});
    if(b.group.position.y===.12&&t>.8){b.mode='fallen';b.dropOrigin=null;}
  }
}
