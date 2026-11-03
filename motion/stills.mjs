import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const times = process.argv.slice(2).map(Number);
const outDir = path.resolve("motion/out/stills");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[err]", e.message));
await page.goto("file:///" + path.resolve("motion/scene.html").replace(/\\/g, "/"));
await page.waitForFunction(() => window.READY === true);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

for (const t of times) {
  await page.evaluate((v) => window.render(v), t);
  await page.waitForTimeout(60);
  const f = path.join(outDir, `t${String(t).padStart(5, "0")}.png`);
  await page.screenshot({ path: f, animations: "allow" });
  console.log("wrote", f);
}
await browser.close();
