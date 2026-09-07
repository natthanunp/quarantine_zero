// Shared map topology drives rendering, gate purchases, navigation and spawning.
export const MAP_BOUNDS={minX:-41.5,maxX:41.5,minZ:-24.5,maxZ:14.5};
export const ZONES=[
  {id:'yard',name:'ARRIVAL YARD',number:'01',x:0,z:5,color:'#c4d8ab',spawns:[[-11,12],[11,12],[-11,-2],[11,-2]],description:'Wall carbine · Quick Hands · emergency purge'},
  {id:'containment',name:'CONTAINMENT',number:'02',x:0,z:-15,color:'#c09ae8',spawns:[[-11,-22],[11,-22],[0,-22]],description:'Mystery cache · shortcuts to the outer wings'},
  {id:'pump',name:'PUMP HALL',number:'03',x:-28,z:5,color:'#77cfd2',spawns:[[-39,12],[-39,-2],[-18,12]],description:'Breacher shotgun · pumping machinery'},
  {id:'foundry',name:'THE FOUNDRY',number:'04',x:28,z:5,color:'#f2ad66',spawns:[[39,12],[39,-2],[18,12]],description:'Vector SMG · auxiliary generators'},
  {id:'lab',name:'MEDICAL LAB',number:'05',x:-28,z:-15,color:'#e28d81',spawns:[[-39,-22],[-18,-22],[-39,-9]],description:'Vital Surge · treatment bays'},
  {id:'relay',name:'RELAY STATION',number:'06',x:28,z:-15,color:'#8ee0b0',spawns:[[39,-22],[18,-22],[39,-9]],description:'Second Wind · communications array'},
];
export const GATES=[
  {id:'door',name:'CONTAINMENT GATE',x:0,z:-5,axis:'x',price:1000,connects:['yard','containment']},
  {id:'pump-door',name:'PUMP HALL ACCESS',x:-14,z:5,axis:'z',price:1250,connects:['yard','pump']},
  {id:'foundry-door',name:'FOUNDRY ACCESS',x:14,z:5,axis:'z',price:1250,connects:['yard','foundry']},
  {id:'lab-door',name:'MEDICAL LAB ACCESS',x:-28,z:-5,axis:'x',price:1500,connects:['pump','lab']},
  {id:'relay-door',name:'RELAY ACCESS',x:28,z:-5,axis:'x',price:1500,connects:['foundry','relay']},
  {id:'lab-link',name:'LAB SERVICE SHORTCUT',x:-14,z:-15,axis:'z',price:750,connects:['containment','lab']},
  {id:'relay-link',name:'RELAY SERVICE SHORTCUT',x:14,z:-15,axis:'z',price:750,connects:['containment','relay']},
];
export function gateIsOpen(state,id){if(typeof state==='boolean')return state;return !!state?.openDoors?.includes(id)||(id==='door'&&!!state?.door);}
export function reachableZones(state){const open=new Set(['yard']);let changed=true;while(changed){changed=false;for(const g of GATES){if(!gateIsOpen(state,g.id))continue;const [a,b]=g.connects;if(open.has(a)&&!open.has(b)){open.add(b);changed=true;}if(open.has(b)&&!open.has(a)){open.add(a);changed=true;}}}return [...open];}
export function zoneAt(x,z){return ZONES.find(a=>Math.abs(x-a.x)<=14&&Math.abs(z-a.z)<=10)||ZONES[0];}

// Exterior apertures, each with a visible approach lane and repairable boards.
export const ENTRIES=ZONES.flatMap(zone=>[-1,1].map((side,i)=>({
  id:`${zone.id}-${i+1}`,zone:zone.id,name:`${zone.name} / WINDOW ${i+1}`,
  x:zone.x+side*(zone.id==='lab'?12:zone.id==='relay'?10:6),z:zone.id==='yard'&&i===1?-5:zone.z>0?15:-25,inward:zone.id==='yard'&&i===1?1:zone.z>0?-1:1,
})));
export const EXTRACTION={x:0,z:13.5,name:'ARRIVAL / EVACUATION DOOR'};
