const SAMPLES = {
  'shot-pistol': 'assets/sfx/shot-pistol.mp3',
  'shot-carbine': 'assets/sfx/shot-carbine.mp3',
  'shot-shotgun': 'assets/sfx/shot-shotgun.mp3',
  'shot-smg': 'assets/sfx/shot-smg.mp3',
  'shot-arc': 'assets/sfx/shot-arc.mp3',
  hit: 'assets/sfx/hit.mp3',
  hurt: 'assets/sfx/hurt.mp3',
  reload: 'assets/sfx/reload.mp3',
  buy: 'assets/sfx/buy.mp3',
  wave: 'assets/sfx/wave.mp3',
  'repair-wood': 'assets/sfx/hammer-on-wood.wav',
  cash: 'assets/sfx/cha-ching.wav',
};

export class AudioEngine {
  constructor() { this.ctx = null; this.volume = .35; this.buffers = {}; this.repairSource = null; this.menuMusic = new Audio('assets/sfx/main-menu.mp3'); this.menuMusic.loop = true; this.menuMusic.preload = 'auto'; this.lossMusic = new Audio('assets/sfx/Broken_Ground.mp3'); this.lossMusic.preload = 'auto'; }
  startMenuMusic() { if (!this.menuMusic.paused) return; this.menuMusic.play().catch(() => {}); }
  stopMenuMusic() { this.menuMusic.pause(); this.menuMusic.currentTime = 0; }
  startLossMusic() { this.stopMenuMusic(); this.lossMusic.currentTime = 0; this.lossMusic.play().catch(() => {}); }
  stopLossMusic() { this.lossMusic.pause(); this.lossMusic.currentTime = 0; }
  start() {
    this.stopMenuMusic();
    this.stopLossMusic();
    this.stopRepair();
    if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination); this.ambience(); this.loadSamples(); }
    this.ctx.resume().catch(() => {});
  }
  async loadSamples() {
    await Promise.all(Object.entries(SAMPLES).map(async ([key, url]) => {
      try { const res = await fetch(url); const data = await res.arrayBuffer(); this.buffers[key] = await this.ctx.decodeAudioData(data); }
      catch { /* fall back to synth if a sample is missing */ }
    }));
  }
  play(key, gain = 1) {
    const buf = this.buffers[key];
    if (!buf) return false;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = buf; g.gain.value = gain;
    s.connect(g); g.connect(this.master); s.start();
    return true;
  }
  startRepair() {
    this.stopRepair();
    const buf = this.buffers['repair-wood'];
    if (!buf || !this.ctx) return;
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = buf; source.loop = true; gain.gain.value = .75;
    source.connect(gain); gain.connect(this.master); source.start(); this.repairSource = source;
  }
  stopRepair() {
    if (!this.repairSource) return;
    try { this.repairSource.stop(); } catch {}
    this.repairSource.disconnect(); this.repairSource = null;
  }
  setVolume(v) { this.volume = v; this.menuMusic.volume = v; this.lossMusic.volume = v; if (this.master) this.master.gain.value = v; }
  tone(freq, duration, type = 'sine', gain = .2, end = 25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + duration);
    o.connect(g); g.connect(this.master); o.start(); o.stop(t + duration);
  }
  noise(duration, gain, filter = 1800) {
    if (!this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * duration), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = filter; g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }
  shot(weapon = 'pistol') { if (this.play(`shot-${weapon}`, .8)) return; this.noise(.16, .65, weapon === 'arc' ? 4000 : 2400); this.tone(weapon === 'arc' ? 640 : 110, .16, 'sawtooth', .2, 30); }
  hit() { if (this.play('hit', .8)) return; this.tone(170, .12, 'triangle', .15, 60); }
  hurt() { if (this.play('hurt', .8)) return; this.noise(.4, .5, 400); this.tone(65, .3, 'sine', .5); }
  reload() { if (this.play('reload', .8)) return; this.noise(.10, .25, 5000); this.tone(700, .06, 'square', .04, 250); }
  wood(breaking=false){this.noise(breaking?.16:.045,breaking?.20:.12,breaking?1600:850);this.tone(breaking?110:210,breaking?.16:.06,'triangle',.10,50);}
  swipe(){this.noise(.16,.09,900);}
  buy() { if (this.play('buy', .8)) return; this.tone(380, .32, 'sine', .25, 900); }
  wave() { if (this.play('wave', .8)) return; this.tone(95, 2.5, 'sawtooth', .16, 45); }
  ambience() {
    const n = this.ctx.sampleRate * 3, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); s.buffer = b; s.loop = true; f.type = 'lowpass'; f.frequency.value = 650; g.gain.value = .10; s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }
}
