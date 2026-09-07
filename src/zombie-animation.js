import * as THREE from 'three';

// Timed skeletal actions use the same lightweight rig as locomotion. Each action
// has anticipation, contact and recovery; gameplay reads the same action clock.
export const ACTIONS={tear:{duration:1.55,contact:.88},climb:{duration:1.65},attack:{duration:1.05,contact:.46}};
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const ease=(t,a,b)=>smooth((t-a)/(b-a));
const euler=new THREE.Euler(),rotation=new THREE.Quaternion();
export function prepareAnimator(mesh){
  mesh.updateMatrixWorld(true);
  const skin=mesh.getObjectByProperty('isSkinnedMesh',true),skeleton=skin.skeleton;
  const bind=new Map(skeleton.bones.map((b,i)=>[b,skeleton.boneInverses[i].clone().invert()]));
  const bones=new Map();
  for(const bone of skeleton.bones){
    const parent=bind.get(bone.parent)||bone.parent.matrixWorld;
    const local=parent.clone().invert().multiply(bind.get(bone));
    const position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();local.decompose(position,quaternion,scale);
    bones.set(bone.name,{bone,position,quaternion});
  }
  mesh.userData.pose={bones,blend:0,previous:new Map()};
}
function joint(mesh,name,x=0,y=0,z=0){
  const item=mesh.userData.pose.bones.get(name.replaceAll('.',''));if(!item)return;
  item.bone.quaternion.copy(item.quaternion).multiply(rotation.setFromEuler(euler.set(x,y,z)));
}
export function actionPose(z,kind,time){
  const m=z.mesh,pose=m.userData.pose;
  for(const item of pose.bones.values()){item.bone.quaternion.copy(item.quaternion);item.bone.position.copy(item.position);}
  const side=z.hand??1,L=side>0?'L':'R',R=side>0?'R':'L';
  joint(m,'spine',.10);joint(m,'neck',-.05);joint(m,'head',.025,0,-.03);
  joint(m,'upper_arm.L',-.20,0,.07);joint(m,'upper_arm.R',-.20,0,-.07);
  joint(m,'forearm.L',-.22);joint(m,'forearm.R',-.22);
  if(kind==='tear'){
    const shoulder=[.5,.95,1.45,2.0][z.action?.index??2];
    const reach=ease(time,0,.35),pull=ease(time,.55,.91),recover=ease(time,1.08,1.55),weight=1-recover;
    joint(m,'spine',.10+(.22*reach-.25*pull)*weight,0,side*.08*pull*weight);
    for(const [label,sign] of [[L,side],[R,-side]]){
      joint(m,'upper_arm.'+label,-.20+(-shoulder*reach+.62*pull)*weight,0,sign*.12);
      joint(m,'forearm.'+label,-.22-(.15*reach+.95*pull)*weight);
      joint(m,'hand.'+label,.20*reach*weight);
    }
    joint(m,'head',-.12*reach*weight);
  }else if(kind==='climb'){
    const brace=ease(time,0,.3)*(1-ease(time,1.1,1.65));
    const lead=ease(time,.15,.48)*(1-ease(time,1.0,1.4));
    const trail=ease(time,.38,.7)*(1-ease(time,1.3,1.65));
    joint(m,'spine',.10+.48*brace);joint(m,'head',-.25*brace);
    joint(m,'upper_arm.'+L,-.2-1.18*brace,0,.17*side);
    joint(m,'upper_arm.'+R,-.2-.97*brace,0,-.17*side);
    joint(m,'forearm.'+L,-.22-.22*brace);joint(m,'forearm.'+R,-.22-.45*brace);
    joint(m,'thigh.'+L,-1.55*lead);joint(m,'shin.'+L,2.35*lead);joint(m,'foot.'+L,-.8*lead);
    joint(m,'thigh.'+R,-1.5*trail+.10*lead);joint(m,'shin.'+R,2.3*trail);joint(m,'foot.'+R,-.8*trail);
  }else if(kind==='attack'){
    const wind=ease(time,0,.28),strike=ease(time,.28,.49),recover=ease(time,.58,1.05),weight=1-recover;
    joint(m,'spine',.10+(.30*strike-.10*wind)*weight,side*(.22*wind-.4*strike)*weight,side*.08*strike*weight);
    joint(m,'upper_arm.'+L,(-.25-.65*wind-.85*strike)*weight,0,side*(.55*wind-.7*strike)*weight);
    joint(m,'forearm.'+L,-.22+(-1.15*wind+1.0*strike)*weight);
    joint(m,'hand.'+L,-.3*strike*weight);
    joint(m,'upper_arm.'+R,-.3-.55*strike*weight,0,side*.12);
    joint(m,'head',-.1*strike*weight,side*-.13*wind*weight);
  }
  pose.blend=1;for(const [name,item] of pose.bones){const previous=pose.previous.get(name);if(previous)previous.copy(item.bone.quaternion);else pose.previous.set(name,item.bone.quaternion.clone());}
}
export function walkPose(z,dt,distance){
  const m=z.mesh,pose=m.userData.pose;
  m.userData.mixer?.update(distance/.95);
  // Smoothly return from an action to the walking clip, even when still blocked.
  if(pose.blend>0){pose.blend=Math.max(0,pose.blend-dt*6);for(const [name,item] of pose.bones){const previous=pose.previous.get(name);if(previous)item.bone.quaternion.slerp(previous,pose.blend);}}
}
export function climbOffset(time){
  return {forward:-.66+1.96*ease(time,.52,1.4),height:.16*ease(time,.2,.6)*(1-ease(time,1.1,1.65))};
}
