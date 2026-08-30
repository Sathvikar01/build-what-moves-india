import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3100";
const OUT = "scripts/redesign-shots";
mkdirSync(OUT, { recursive: true });

const run = async (page, tag) => {
  const shot = async (name, fullPage = true) => {
    await page.waitForSelector('.map-frame[aria-busy="false"]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
    console.log("shot:", name);
  };

  await page.goto(BASE, { waitUntil: "networkidle" });
  await shot(`${tag}-landing`);

  await page.goto(`${BASE}/data-assumptions`, { waitUntil: "networkidle" });
  await shot(`${tag}-data-assumptions`);

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot(`${tag}-login`);

  // Citizen console
  await page.fill("input[autocomplete='name']", "Arjun Mehta");
  await page.fill("input[inputmode='numeric']", "9876543210");
  await page.click("button[type='submit']");
  await page.waitForURL("**/citizen", { timeout: 20000 });
  await shot(`${tag}-citizen`);

  // BBMP console
  await page.goto(`${BASE}/bbmp`, { waitUntil: "networkidle" });
  await shot(`${tag}-bbmp-overview`);
  await page.click("#tab-routes").catch(() => {});
  await shot(`${tag}-bbmp-routes`);
  await page.click("#tab-placement").catch(() => {});
  await shot(`${tag}-bbmp-placement`);

  // Collector console
  await page.goto(`${BASE}/collector`, { waitUntil: "networkidle" });
  await shot(`${tag}-collector`);
};

const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await run(desktop, "d");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await run(mobile, "m");

await browser.close();
console.log("done");
