import * as THREE from 'three';
export const HIP_POSE=new THREE.Vector3(.18,-.18,-.31);
export const AIM_POSE=new THREE.Vector3(0,0,-.28);
export function buildViewModel(asset){
  const model=asset.clone(true);
  model.traverse(o=>{if(o.name.startsWith('FP_HIDDEN_'))o.visible=false;if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.material.envMapIntensity=.35;}});
  const rear=model.getObjectByName('sight_rear'),front=model.getObjectByName('sight_front');
  if(!rear||!front)throw new Error('Weapon is missing authored sight alignment markers');
  return model;
}
