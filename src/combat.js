// Analytic hit volumes keep hits independent of render-mesh complexity and skinning.
import {gateIsOpen} from './map.js';
export function rayBox(origin, direction, min, max, limit=60) {
  let near=0,far=limit;
  for(const axis of ['x','y','z']){
    if(Math.abs(direction[axis])<1e-8){if(origin[axis]<min[axis]||origin[axis]>max[axis])return null;continue;}
    let a=(min[axis]-origin[axis])/direction[axis],b=(max[axis]-origin[axis])/direction[axis];
    if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
  }
  return near;
}
export function wallDistance(origin,direction,obstacles,state,limit=60){
  let closest=limit;
  for(const o of obstacles){
    if(o.door&&gateIsOpen(state,o.door===true?'door':o.door))continue;
    const d=rayBox(origin,direction,{x:o.x-o.w/2,y:o.bottom??0,z:o.z-o.d/2},{x:o.x+o.w/2,y:o.top??5,z:o.z+o.d/2},closest);
    if(d!==null)closest=d;
  }
  return closest;
}
export function traceShot(origin,direction,zombies,obstacles,state,limit=60){
  let distance=wallDistance(origin,direction,obstacles,state,limit),zombie=null,head=false;
  for(const z of zombies){
    if(z.health<=0)continue;
    const p=z.mesh.position,scale=z.mesh.scale?.y??1;
    // Separate head and torso volumes: a headshot cannot pass through a nearer body.
    for(const [radius,bottom,top,isHead] of [[.30,.18,1.53,false],[.19,1.53,1.94,true]]){
      const d=rayBox(origin,direction,{x:p.x-radius*scale,y:p.y+bottom*scale,z:p.z-radius*scale},{x:p.x+radius*scale,y:p.y+top*scale,z:p.z+radius*scale},distance);
      if(d!==null&&d<distance){distance=d;zombie=z;head=isHead;}
    }
  }
  return distance<limit?{distance,zombie,head}:null;
}
