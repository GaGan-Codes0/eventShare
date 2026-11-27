// Renders the silent video track of a Klickers video, frame by frame, from video.html.
// Usage: node render-video.mjs <preview|ad> <cssW> <cssH> <scale> <out.mp4> [stillsAt=1.2,4.5]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const CHROME = process.env.CHROME_PATH || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const here = path.dirname(fileURLToPath(import.meta.url));
const [v, w, h, scale, out, stills] = process.argv.slice(2);
const FPS = 30;
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
await page.goto(`file://${path.join(here, 'video.html')}?v=${v}&w=${w}&h=${h}`);
await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
const dur = await page.evaluate('window.DURATION');

if (stills) {
  for (const t of stills.split(',')) {
    await page.evaluate((x) => window.seek(x), +t);
    await page.screenshot({ path: `${out}-${t}.jpg`, type: 'jpeg', quality: 80 });
  }
} else {
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '17', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((x) => window.seek(x), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`${out}: frame ${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('done', out, dur + 's');
}
await browser.close();
