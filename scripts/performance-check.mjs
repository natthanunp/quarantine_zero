import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__qz?.ready);
const setup=await page.evaluate(()=>{
  const g=window.__qz;g.setTouch('on');g.start();g.pause(false);g.setTouch('off');g.setQuality('high');g.state.round=10;g.state.health=g.state.maxHealth=100000;g.camera.position.set(0,1.7,11);g.camera.rotation.set(0,0,0);g.yaw=0;g.waveWait=10000;g.toSpawn=0;
  for(let i=0;i<24;i++){g.spawnZombie();const z=g.zombies.at(-1);z.entering=false;z.mesh.position.set((i%6-2.5)*1.1,0,7-Math.floor(i/6)*1.8);z.health=100000;}
  const gl=g.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  return {gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixelRatio:g.renderer.getPixelRatio()};
});
await page.waitForTimeout(2500);
const samples=await page.evaluate(async()=>{
  const g=window.__qz;g.playing=true;g.state.weapon='shotgun';g.equipModel();g.nextShot=0;g.state.ammo=100000;g.state.reserve=100000;g.controls.fire=true;
  const frames=[],cpu=[],draws=[],triangles=[];let last=performance.now(),start=last;
  while(performance.now()-start<6000){await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-last);last=now;draws.push(g.renderer.info.render.calls);triangles.push(g.renderer.info.render.triangles);}
  g.controls.fire=false;g.pause(false);frames.sort((a,b)=>a-b);
  return {fps:frames.length/6,frameMedianMs:frames[Math.floor(frames.length/2)],frameP95Ms:frames[Math.floor(frames.length*.95)],maxDrawCalls:Math.max(...draws),maxTriangles:Math.max(...triangles),enemies:g.zombies.length};
});
await page.screenshot({path:'art/revision-horde.png'});console.log(JSON.stringify({...setup,...samples},null,2));await writeFile('art/performance-check.json',JSON.stringify({...setup,...samples},null,2));
}finally{await browser.close();}
