import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3100";
const OUT = "scripts/redesign-shots";
mkdirSync(OUT, { recursive: true });

const shot = async (page, name, fullPage = true) => {
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log("shot:", name);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE, { waitUntil: "networkidle" });
await shot(page, "01-landing");

await page.goto(`${BASE}/data-assumptions`, { waitUntil: "networkidle" });
await shot(page, "02-data-assumptions");

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await shot(page, "03-login");

// Citizen console
await page.fill("input[autocomplete='name']", "Arjun Mehta");
await page.fill("input[inputmode='numeric']", "9876543210");
await page.click("button[type='submit']");
await page.waitForURL("**/citizen", { timeout: 20000 });
await shot(page, "04-citizen");

// BBMP console
await page.goto(`${BASE}/bbmp`, { waitUntil: "networkidle" });
await shot(page, "05-bbmp-overview");
await page.click("#tab-routes").catch(() => {});
await shot(page, "06-bbmp-routes");
await page.click("#tab-placement").catch(() => {});
await shot(page, "07-bbmp-placement");

// Collector console
await page.goto(`${BASE}/collector`, { waitUntil: "networkidle" });
await shot(page, "08-collector");

await browser.close();
console.log("done");
