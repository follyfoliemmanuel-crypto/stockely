import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const FFMPEG = "C:\\Users\\DELL\\AppData\\Local\\Temp\\opencode\\ffmpeg\\node_modules\\ffmpeg-static\\ffmpeg.exe";
const FPS = 60;
const OUT = path.resolve("motion/out/stockely-motion.mp4");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("[err]", e.message));
await page.goto("file:///" + path.resolve("motion/scene.html").replace(/\\/g, "/"));
await page.waitForFunction(() => window.READY === true);
await page.waitForTimeout(500);

const DUR = await page.evaluate(() => window.DURATION);
const total = Math.round(DUR * FPS);
console.log(`rendering ${total} frames @ ${FPS}fps (${DUR}s)`);

const ff = spawn(FFMPEG, [
  "-y",
  "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "16",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-r", String(FPS),
  OUT,
], { stdio: ["pipe", "pipe", "pipe"] });

ff.stderr.on("data", (d) => {
  const s = d.toString();
  if (/error|Error|Invalid/.test(s)) process.stderr.write(s);
});
const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg exit " + c)))));

const t0 = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  const buf = await page.screenshot({ type: "png", animations: "allow" });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 60 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`  frame ${i}/${total}  ${el.toFixed(1)}s  (~${((el / (i + 1)) * (total - i - 1)).toFixed(0)}s left)`);
  }
}
ff.stdin.end();
await done;
await browser.close();
const mb = (fs.statSync(OUT).size / 1e6).toFixed(1);
console.log(`done -> ${OUT} (${mb} MB) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
