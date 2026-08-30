import { chromium } from "playwright";
const BASE="http://localhost:3000";
const outDir="C:\\Users\\arsat\\AppData\\Local\\Temp\\opencode";
console.log("start");
const browser=await chromium.launch({ headless:true });
const context=await browser.newContext({
  viewport:{width:1280,height:900},
  recordVideo:{ dir: outDir, size:{width:1280,height:900} }
});
const page=await context.newPage();
await page.goto(BASE+"/login",{waitUntil:"domcontentloaded",timeout:30000});
await page.waitForTimeout(800);
await page.evaluate(()=>localStorage.setItem("bsw-user", JSON.stringify({name:"Video Collector",phone:"9876543211",role:"collector",loggedInAt:new Date().toISOString()})));
await page.goto(BASE+"/collector",{waitUntil:"domcontentloaded",timeout:30000});
await page.waitForTimeout(3500);
console.log("map ready, recording 30s...");
await page.waitForTimeout(30000);
console.log("closing...");
const video = page.video();
const videoPath = video ? await video.path() : "no-video";
console.log("video path before close:", videoPath);
await context.close();
await browser.close();
console.log("done, video at:", videoPath);
import fs from "fs";
const files=fs.readdirSync(outDir).filter(f=>f.endsWith(".webm")).map(f=>({name:f, size: fs.statSync(outDir+"\\"+f).size})).sort((a,b)=>b.size-a.size);
console.log(files);
