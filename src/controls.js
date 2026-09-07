export class Controls {
  constructor(canvas, callbacks) {
    this.resets=[];this.canvas = canvas; this.cb = callbacks; this.keys = new Set(); this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 }; this.use = false; this.fire = false; this.ads = false; this.touch = matchMedia('(pointer: coarse)').matches; this.sensitivity = 1; this.active = false;
    window.addEventListener('keydown', e => {
      if (!this.active || /INPUT|SELECT/.test(e.target.tagName) || (e.code === 'Escape' && !document.querySelector('#modal')?.classList.contains('hidden'))) return;
      if (['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) { if (e.code === 'KeyR') callbacks.reload(); if (e.code === 'KeyE') callbacks.interact(); if (e.code === 'Escape' || e.code === 'KeyP') callbacks.pause(); if (e.code === 'KeyF') callbacks.flashlight(); }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('mousemove', e => { if (this.active && document.pointerLockElement === canvas) callbacks.look(e.movementX * .002 * this.sensitivity, e.movementY * .002 * this.sensitivity); });
    canvas.addEventListener('mousedown', e => { if (!this.active) return; if (!document.pointerLockElement && !this.touch) this.lock(); else { if (e.button === 0) this.fire = true; if (e.button === 2) this.ads = true; } });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.fire = false; if (e.button === 2 && !this.touch) this.ads = false; });
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) this.lockRequested = false; });
    window.addEventListener('blur', () => { this.clear(); if (this.active) callbacks.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.active) { this.clear(); callbacks.pause(); } });
    this.moveArea('touch-move-area');this.lookArea('touch-look-area');this.lookArea('touch-fire',true);
     const aim=document.getElementById('touch-ads');aim.setAttribute('aria-pressed','false');aim.addEventListener('pointerdown',e=>{e.preventDefault();if(!this.active)return;this.ads=!this.ads;aim.setAttribute('aria-pressed',String(this.ads));});
    document.querySelector('#touch-reload').onclick = () => callbacks.reload(); this.hold('touch-interact',v=>{this.use=v;if(v)callbacks.interact();});
  }
  lock() { if (!this.touch) { this.lockRequested = true; try { this.canvas.requestPointerLock()?.catch(() => { this.lockRequested = false; this.cb.notice('Click the scene to capture your mouse'); }); } catch { this.lockRequested = false; this.cb.notice('Click the scene to capture your mouse'); } } }
  clear() {
    this.resets.forEach(reset=>reset());document.getElementById('touch-ads').setAttribute('aria-pressed','false');
    this.keys.clear();this.use=false;this.fire=false;this.ads=false;this.move.x=this.move.y=this.look.x=this.look.y=0;
  }
  hold(id,set){
    const el=document.getElementById(id);let pointer=null;
    const reset=()=>{const previous=pointer;pointer=null;set(false);el.classList.remove('pressed');if(previous!==null&&el.hasPointerCapture(previous))el.releasePointerCapture(previous);};
    this.resets.push(reset);
    el.addEventListener('pointerdown',e=>{e.preventDefault();if(!this.active||pointer!==null)return;pointer=e.pointerId;el.setPointerCapture(pointer);el.classList.add('pressed');set(true);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  }
  moveArea(id){
    const el=document.getElementById(id);let pointer=null,anchorX=0,anchorY=0,radius=56;
    const reset=()=>{const previous=pointer;pointer=null;this.move.x=this.move.y=0;el.classList.remove('engaged');el.querySelector('span').textContent='DRAG TO MOVE';if(previous!==null&&el.hasPointerCapture(previous))el.releasePointerCapture(previous);};
    this.resets.push(reset);
    el.addEventListener('pointerdown',e=>{
      e.preventDefault();if(!this.active||pointer!==null)return;pointer=e.pointerId;anchorX=e.clientX;anchorY=e.clientY;
      radius=Math.max(42,Math.min(64,el.clientHeight*.18));el.setPointerCapture(pointer);el.classList.add('engaged');
    });
    el.addEventListener('pointermove',e=>{
      if(!this.active||e.pointerId!==pointer)return;e.preventDefault();let x=e.clientX-anchorX,y=e.clientY-anchorY,length=Math.hypot(x,y);
      if(length>radius){anchorX=e.clientX-x/length*radius;anchorY=e.clientY-y/length*radius;x=x/length*radius;y=y/length*radius;length=radius;}
      const magnitude=Math.max(0,(length-5)/(radius-5));this.move.x=length?x/length*magnitude:0;this.move.y=length?y/length*magnitude:0;
      el.querySelector('span').textContent=magnitude>.85?'SPRINT':magnitude>0?'MOVE':'DRAG TO MOVE';
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  }
  lookArea(id,firing=false){
    const el=document.getElementById(id);let pointer=null,lastX=0,lastY=0;
    const reset=()=>{const previous=pointer;pointer=null;if(firing)this.fire=false;el.classList.remove('engaged','pressed');if(previous!==null&&el.hasPointerCapture(previous))el.releasePointerCapture(previous);};
    this.resets.push(reset);
    el.addEventListener('pointerdown',e=>{e.preventDefault();if(!this.active||pointer!==null)return;pointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;el.setPointerCapture(pointer);el.classList.add(firing?'pressed':'engaged');if(firing)this.fire=true;});
    el.addEventListener('pointermove',e=>{
      if(!this.active||e.pointerId!==pointer)return;e.preventDefault();const scale=.005*this.sensitivity*(this.ads?.55:1);
      this.cb.look((e.clientX-lastX)*scale,(e.clientY-lastY)*scale);lastX=e.clientX;lastY=e.clientY;
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  }
  update() {} // Look uses finger displacement, never continuous joystick turning.
  get interactHeld(){return this.active&&(this.use||this.keys.has('KeyE'));}
  get movement() { return { x: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.move.x, y: (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0) + this.move.y }; }
}
