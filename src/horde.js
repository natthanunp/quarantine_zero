import {canOccupy} from './rules.js';
import {gateIsOpen} from './map.js';
import {rayBox} from './combat.js';
export function pathClear(x,z,tx,tz,obstacles,state,radius=.30){
  const length=Math.hypot(tx-x,tz-z);if(length<.001)return true;
  const origin={x,y:.5,z},direction={x:(tx-x)/length,y:0,z:(tz-z)/length};
  for(const o of obstacles){
    if(o.door&&gateIsOpen(state,o.door===true?'door':o.door))continue;
    if(rayBox(origin,direction,{x:o.x-o.w/2-radius,y:0,z:o.z-o.d/2-radius},{x:o.x+o.w/2+radius,y:5,z:o.z+o.d/2+radius},length)!==null)return false;
  }return true;
}
export function pursuitTarget(z,player,nav,obstacles,state){
  const p=z.mesh.position,dx=p.x-player.x,dz=p.z-player.z,dist=Math.hypot(dx,dz);
  // Hold an individual approach side for several seconds instead of randomizing
  // every frame. Flankers aim beside the player, then commit to a close attack.
  const bearing=Math.atan2(dx,dz),angle=bearing+z.flank;
  const radius=dist>3?Math.min(3.2,dist*.42):dist>1.6?1.05:0;
  const target={x:player.x+Math.sin(angle)*radius,z:player.z+Math.cos(angle)*radius};
  if(canOccupy(target.x,target.z,.34,obstacles,state)&&pathClear(p.x,p.z,target.x,target.z,obstacles,state))return target;
  if(!nav)return {x:player.x,z:player.z};
  const x=Math.max(0,Math.min(nav.w-1,Math.round((p.x-nav.x0)/nav.size))),j=Math.max(0,Math.min(nav.h-1,Math.round((p.z-nav.z0)/nav.size)));
  const current=nav.distance[j*nav.w+x];let best=Infinity,chosen=null;
  // Look ahead through the field; sweep the full segment to prevent corner cuts.
  for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
    if(!dx&&!dz)continue;const nx=x+dx,nz=j+dz;if(nx<0||nz<0||nx>=nav.w||nz>=nav.h)continue;
    const value=nav.distance[nz*nav.w+nx];if(value<0||(current>=0&&value>=current))continue;
    const tx=nav.x0+nx*nav.size,tz=nav.z0+nz*nav.size;
    const score=value+Math.hypot(tx-p.x,tz-p.z)*.35+Math.sin(nx*.7+nz*.9+z.phase)*.32;
    if(score<best&&pathClear(p.x,p.z,tx,tz,obstacles,state)){best=score;chosen={x:tx,z:tz};}
  }
  return chosen||{x:p.x,z:p.z};
}
export function crowdVelocity(z,target,zombies){
  const p=z.mesh.position,dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz);
  let vx=len>.05?dx/len*z.speed:0,vz=len>.05?dz/len*z.speed:0;
  for(const other of zombies){
    if(other===z||other.entering)continue;let ax=p.x-other.mesh.position.x,az=p.z-other.mesh.position.z,d=Math.hypot(ax,az);
    if(d<.01){ax=Math.sin(z.phase);az=Math.cos(z.phase);d=.01;}
    if(d<1.05){const force=(1.05-d)*3.4;vx+=ax/d*force;vz+=az/d*force;}
    // Pass a slower neighbour on a stable side instead of forming a single line.
    if(d<1.8&&len>.1&&(-ax*dx-az*dz)/(d*len)>.6){const force=(1.8-d)*.65*z.passSide;vx+=dz/len*force;vz-=dx/len*force;}
  }
  const speed=Math.hypot(vx,vz),cap=z.speed*1.15;if(speed>cap){vx*=cap/speed;vz*=cap/speed;}
  return {x:vx,z:vz};
}
