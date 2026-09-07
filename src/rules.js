export const WEAPONS = {
  pistol: { name: 'M9 / SIDEARM', clip: 15, reserve: 105, damage: 38, rate: .23, reload: 1.55, pellets: 1, spread: .010, model: 'pistol' },
  carbine: { name: 'AR-41 / CARBINE', clip: 30, reserve: 210, damage: 48, rate: .095, reload: 2.1, pellets: 1, spread: .018, model: 'carbine' },
  shotgun: { name: 'BREACHER / SHOTGUN', clip: 8, reserve: 64, damage: 30, rate: .72, reload: 2.6, pellets: 8, spread: .065, model: 'shotgun' },
  smg: { name: 'VECTOR / SMG', clip: 40, reserve: 280, damage: 32, rate: .060, reload: 1.8, pellets: 1, spread: .025, model: 'smg' },
  arc: { name: 'ARC-9 / EXPERIMENTAL', clip: 20, reserve: 140, exclusive: true, chain: 4, damage: 160, rate: .25, reload: 2.4, pellets: 1, spread: .005, model: 'arc' },
};
export const STATIONS = [
  { id: 'carbine', name: 'AR-41 CARBINE', note: '30 rounds · automatic', price: 1200, x: -12.7, z: 0, type: 'weapon', color: '#b7e5da' },
  { id: 'ammo', name: 'AMMUNITION', note: 'Refill current weapon', price: 250, x: -12.7, z: 12.3, type: 'ammo', color: '#b7e5da' },
  ...GATES.map(g=>({...g,type:'door',note:'Open passage · new routes and spawns',color:'#f9bc67'})),
  { id: 'box', name: 'MYSTERY CACHE', note: 'Box exclusive: ARC-9 chain lightning · 25% chance', price: 950, x: 9.6, z: -12.5, type: 'box', color: '#bd91ff' },
  { id: 'vital', name: 'VITAL SURGE', note: '250 maximum health', price: 2000, x: -37, z: -20.5, rotation:0, type: 'perk', color: '#fa7765' },
  { id: 'speed', name: 'QUICK HANDS', note: 'Reload twice as fast', price: 1500, x: 12.7, z: 11.5, type: 'perk', color: '#f0bc64' },
  { id: 'regen', name: 'SECOND WIND', note: 'Regenerate sooner and faster', price: 1500, x: 36, z: -20.5, rotation:0, type: 'perk', color: '#90dca3' },
  { id: 'shotgun', name: 'BREACHER SHOTGUN', note: '8 shells · pump action', price: 1600, x:-40.7,z:8,rotation:Math.PI/2,type:'weapon',color:'#8fd4dc'},
  { id: 'smg', name: 'VECTOR SMG', note: '40 rounds · rapid fire', price: 1800, x:40.7,z:8,rotation:-Math.PI/2,type:'weapon',color:'#efc48c'},
  { id:'lab-ammo',name:'LAB AMMUNITION',note:'Refill current weapon',price:250,x:-40.7,z:-12,rotation:Math.PI/2,type:'ammo',color:'#b7e5da'},
  { id:'relay-ammo',name:'RELAY AMMUNITION',note:'Refill current weapon',price:250,x:40.7,z:-12,rotation:-Math.PI/2,type:'ammo',color:'#b7e5da'},
  { id: 'pulse', name: 'EMERGENCY PURGE', note: 'Stun and damage every infected · 25s cooldown', price: 400, x: 7.5, z: 3.5, type: 'pulse', color: '#8ccbe8' },
];
export function waveSpec(round) { return { count: 6 + round * 3, health: 65 + round * 22, speed: Math.min(2.75, .85 + round * .13), spawnDelay: Math.max(.5, 1.85 - round * .08), runnerChance: round>=3?Math.min(.4,.10+round*.015):0, brute: round%5===0 }; }
export function newRun() { return { round: 0, points: 500, health: 100, maxHealth: 100, kills: 0, headshots: 0, weapon: 'pistol', ammo: 15, reserve: 105, perks: [], door: false, openDoors:[], cooldown: 0, elapsed: 0, completedRounds:0, repairPoints:0, salvage:0 }; }
export function equip(state, weapon) { state.weapon = weapon; state.ammo = WEAPONS[weapon].clip; state.reserve = WEAPONS[weapon].reserve; }
export function purchase(state, id, random = Math.random) {
  const s = STATIONS.find(s => s.id === id);
  if (!s) return { ok: false, message: 'Unknown station' };
  if (s.type === 'perk' && state.perks.includes(id)) return { ok: false, message: 'Already equipped' };
  if (s.type === 'door' && gateIsOpen(state,id)) return { ok: false, message: 'Passage already open' };
  if (id === 'pulse' && state.cooldown > 0) return { ok: false, message: `Recharging · ${Math.ceil(state.cooldown)}s` };
  if (state.points < s.price) return { ok: false, message: `Need ${s.price - state.points} more points` };
  state.points -= s.price;
  if (s.type === 'weapon') equip(state, id);
  if (s.type === 'ammo') { state.ammo = WEAPONS[state.weapon].clip; state.reserve = WEAPONS[state.weapon].reserve; }
  if (s.type === 'door') { state.openDoors??=[];state.openDoors.push(id);if(id==='door')state.door=true; }
  if (id === 'box') equip(state, ['carbine', 'shotgun', 'smg', 'arc'][Math.min(3, Math.floor(random() * 4))]);
  if (s.type === 'perk') state.perks.push(id);
  if (id === 'vital') { state.maxHealth = 250; state.health = 250; }
  if (id === 'pulse') state.cooldown = 25;
  return { ok: true, message: s.type === 'box' ? WEAPONS[state.weapon].name : `${s.name} · acquired` };
}
export function regenerate(state, dt, sinceHit) {
  const fast = state.perks.includes('regen');
  if (state.health > 0 && sinceHit > (fast ? 2.5 : 5)) state.health = Math.min(state.maxHealth, state.health + dt * (fast ? 28 : 13));
}
export function finishReload(state) { const n = Math.min(WEAPONS[state.weapon].clip - state.ammo, state.reserve); state.ammo += n; state.reserve -= n; }
export function canOccupy(x, z, radius, obstacles, state) {
  if (x < MAP_BOUNDS.minX + radius || x > MAP_BOUNDS.maxX - radius || z > MAP_BOUNDS.maxZ - radius || z < MAP_BOUNDS.minZ + radius) return false;
  return !obstacles.some(o => !(o.door && gateIsOpen(state,o.door===true?'door':o.door)) && x + radius > o.x - o.w / 2 && x - radius < o.x + o.w / 2 && z + radius > o.z - o.d / 2 && z - radius < o.z + o.d / 2);
}
import {GATES,MAP_BOUNDS,gateIsOpen} from './map.js';

export const MAX_BOARDS=4;
export function repairBarricade(state,entry){
  if(entry.boards>=MAX_BOARDS)return {ok:false,reward:0,message:'Barricade fully repaired'};
  entry.boards++;const reward=state.repairPoints<120?10:0;state.repairPoints+=reward;state.points+=reward;
  return {ok:true,reward,message:`Board restored · ${entry.boards}/${MAX_BOARDS}${reward?' · +10 PTS':''}`};
}
export function extractionReward(state){return Math.floor(state.completedRounds/5)*100+state.kills*2;}
export function canExtract(state){return state.completedRounds>0&&state.completedRounds%5===0;}
