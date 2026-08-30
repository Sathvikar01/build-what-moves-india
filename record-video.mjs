import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE="http://localhost:3000";
const outDir="C:\\Users\\arsat\\AppData\\Local\\Temp\\opencode";
const videoDir=outDir;

console.log("Launching browser with video recording...");
const browser=await chromium.launch({ headless:true });
const context=await browser.newContext({
  viewport:{width:1280,height:900},
  recordVideo:{ dir: videoDir, size:{width:1280,height:900} }
});
const page=await context.newPage();

// Login as collector
console.log("Navigating to /login to set auth...");
await page.goto(BASE+"/login",{waitUntil:"domcontentloaded",timeout:30000});
await page.waitForTimeout(1200);
await page.evaluate(()=>{
  localStorage.setItem("bsw-user", JSON.stringify({name:"Video Collector",phone:"9876543211",role:"collector",loggedInAt:new Date().toISOString()}));
});
console.log("Auth set, going to /collector...");
await page.goto(BASE+"/collector",{waitUntil:"domcontentloaded",timeout:30000});
await page.waitForTimeout(4000);

// Initial API snapshot
let r0=await fetch(BASE+"/api/state",{headers:{"x-demo-role":"bbmp"}}).then(r=>r.json()).then(j=>j.data).catch(e=>null);
console.log(`START: vehicle ${r0?.vehicles[0]?.location.lat.toFixed(5)},${r0?.vehicles[0]?.location.lng.toFixed(5)} progress=${r0?.dayCycle.progressKm.toFixed(3)} user ${r0?.userLocation?.location.lat.toFixed(5)},${r0?.userLocation?.location.lng.toFixed(5)} stops=${r0?.route.routes[0]?.stops.length} geom=${r0?.route.roadGeometrySource}`);

// Check map loaded
const leaflet=await page.locator(".leaflet-container").count();
const tiles=await page.locator(".leaflet-tile").count();
const poly=await page.locator("path.leaflet-interactive").count();
console.log(`Map ready: leaflet=${leaflet} tiles=${tiles} polylines=${poly}`);

// Record for 60s - keep page alive, also poll API midway
console.log("Recording 60s video (vehicle should advance ~4km, user may drift once)...");
for(let sec=0; sec<60; sec+=15){
  await page.waitForTimeout(15000);
  let snap=await fetch(BASE+"/api/state",{headers:{"x-demo-role":"bbmp"}}).then(r=>r.json()).then(j=>j.data).catch(()=>null);
  if(snap){
    console.log(` +${sec+15}s: progress=${snap.dayCycle.progressKm.toFixed(3)}km vehicle=${snap.vehicles[0].location.lat.toFixed(5)},${snap.vehicles[0].location.lng.toFixed(5)} status=${snap.vehicles[0].status} user=${snap.userLocation.location.lat.toFixed(5)},${snap.userLocation.location.lng.toFixed(5)} events:${snap.events.slice(-2).map(e=>e.type).join(",")}`);
  }
  // Take intermediate screenshot for verification
  await page.screenshot({path: path.join(outDir, `video_frame_${sec+15}s.png`), fullPage:false});
}

// Final snapshot before close
let r1=await fetch(BASE+"/api/state",{headers:{"x-demo-role":"bbmp"}}).then(r=>r.json()).then(j=>j.data).catch(()=>null);
console.log(`END: progress=${r1?.dayCycle.progressKm.toFixed(3)} vehicle=${r1?.vehicles[0]?.location.lat.toFixed(5)},${r1?.vehicles[0]?.location.lng.toFixed(5)} user=${r1?.userLocation.location.lat.toFixed(5)},${r1?.userLocation.location.lng.toFixed(5)}`);

// Need to get video path before closing context
const videoPath=await page.video().path().catch(()=>path.join(videoDir,"unknown.webm"));
console.log("Video temp path:", videoPath);

await page.close();
await context.close();
await browser.close();

// After close, video is saved to videoPath - find actual file
const files=fs.readdirSync(videoDir).filter(f=>f.endsWith(".webm")).map(f=>({name:f, mtime: fs.statSync(path.join(videoDir,f)).mtime, size: fs.statSync(path.join(videoDir,f)).size})).sort((a,b)=>b.mtime-a.mtime);
console.log("Video files in outDir:", files.slice(0,5));
if(files[0]){
  const finalPath=path.join(videoDir, files[0].name);
  console.log(`Final video: ${finalPath} size=${files[0].size} bytes`);
  // Copy to a stable name
  const stable=path.join(videoDir, "collector_live_60s.webm");
  try{ fs.copyFileSync(finalPath, stable); console.log("Copied to", stable); }catch{}
  // Also save meta
  fs.writeFileSync(path.join(videoDir,"video_meta.json"), JSON.stringify({start:r0?.dayCycle, end:r1?.dayCycle, startVehicle:r0?.vehicles[0], endVehicle:r1?.vehicles[0], startUser:r0?.userLocation, endUser:r1?.userLocation, files},null,2));
}
