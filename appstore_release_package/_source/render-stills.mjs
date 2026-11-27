// Renders every still in the package from the HTML sources in this folder.
// Usage: node render-stills.mjs [screens|iap|banners|all]
// Needs playwright-core (npm i playwright-core) and a Playwright Chromium.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

export const CHROME = process.env.CHROME_PATH || [path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell')].find((p) => fs.existsSync(p));

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..');
const what = process.argv[2] || 'all';
const browser = await chromium.launch({ executablePath: CHROME });

async function shot(file, query, vw, vh, dest, scale = 3) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: scale });
  await page.goto(`file://${path.join(here, file)}?${query}`);
  await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
  await page.screenshot({ path: path.join(out, dest), type: 'png' });
  await page.close();
  console.log('wrote', dest);
}

const names = ['01_hero', '02_scan_to_join', '03_shoot_live', '04_one_album', '05_find_me', '06_design_studio', '07_host_control', '08_packages'];
if (what === 'screens' || what === 'all') {
  for (let i = 1; i <= 8; i++) {
    await shot('screenshots.html', `slide=${i}&w=440`, 440, 956, `screenshots/iphone_6_9/${names[i - 1]}_1320x2868.png`);
    await shot('screenshots.html', `slide=${i}&w=428`, 428, 926, `screenshots/iphone_6_5/${names[i - 1]}_1284x2778.png`);
  }
}
if (what === 'iap' || what === 'all') {
  for (const k of ['party', 'celebration', 'branded', 'offer', 'upgrade']) {
    await shot('iap.html', `card=${k}`, 512, 512, `subscription_banners/${k === 'offer' ? 'offer_code_launch' : k === 'upgrade' ? 'promo_upgrade_difference' : `iap_${k}`}_1024x1024.png`, 2);
  }
}
if (what === 'iap' || what === 'all') {
  await shot('screen.html', 's=plans', 400, 872, 'subscription_banners/iap_review_screenshot_packages_1200x2616.png');
}
if (what === 'banners' || what === 'all') {
  const b = [
    ['feature', 800, 450, 'today_tab_feature_1600x900.png'],
    ['promo', 512, 250, 'promo_banner_1024x500.png'],
    ['cpp-weddings', 800, 450, 'cpp_hero_weddings_1600x900.png'],
    ['cpp-corporate', 800, 450, 'cpp_hero_corporate_1600x900.png'],
    ['cpp-birthdays', 800, 450, 'cpp_hero_birthdays_1600x900.png'],
    ['ads-square', 540, 540, 'search_ads_square_1080x1080.png'],
  ];
  for (const [k, w, h, f] of b) await shot('banners.html', `b=${k}`, w, h, `editorial_and_search_banners/${f}`, 2);
}
await browser.close();
