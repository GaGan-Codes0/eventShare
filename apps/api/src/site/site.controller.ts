import { readFileSync } from 'node:fs';

import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { joinEventSchema } from '@eventshare/shared';

/** The klickers.app landing page: one self-contained HTML file in apps/api/site, read once at startup. */
const LANDING = readFileSync(new URL('../../site/index.html', import.meta.url), 'utf8');

const APP_STORE = 'https://apps.apple.com/app/id6831151328';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=in.co.klyra.eventshare';

/**
 * Lets iPhones open klickers.app/j/… links straight in Klickers once it's installed (Associated
 * Domains). The app id is our Apple team id and bundle id.
 */
const APPLE_APP_SITE_ASSOCIATION = JSON.stringify({
  applinks: { details: [{ appIDs: ['864G5MUXS7.in.co.klyra.eventshare'], components: [{ '/': '/j/*', comment: 'Event invites' }] }] },
});

/**
 * The page behind an invite's QR code and link, for phones where Klickers didn't open by itself:
 * open the app, or get it first. It shows only the code (no event details), so it needs no sign-in
 * and tells nobody guessing codes anything.
 */
function joinPage(code: string) {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const appLink = `eventshare://join?code=${code}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Join an event · Klickers</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
  :root { --bg: #FAF9F5; --surface: #FFFEFA; --ink: #273C32; --muted: #727868; --line: #E3E4D8; --soft: #E9EDDF; --accent: #385447; --on: #FFFEFA; --hi: #748063; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { min-height: 100vh; background: var(--bg); color: var(--ink); font: 16.5px/1.55 'DM Sans', system-ui, sans-serif; display: flex; flex-direction: column; -webkit-font-smoothing: antialiased; }
  main { flex: 1; width: 100%; max-width: 440px; margin: 0 auto; padding: 40px 20px 32px; display: flex; flex-direction: column; gap: 14px; }
  .logo { font: 400 26px 'DM Serif Display', serif; letter-spacing: -0.6px; color: var(--ink); text-decoration: none; }
  .logo i { color: var(--hi); }
  h1 { font: 400 44px/1.02 'DM Serif Display', serif; letter-spacing: -0.02em; margin-top: 28px; }
  p { color: var(--muted); }
  .code { margin: 10px 0 6px; padding: 18px; border-radius: 22px; background: var(--surface); border: 1px solid var(--line); text-align: center; }
  .code small { display: block; font-size: 13px; color: var(--muted); }
  .code b { font: 600 38px 'DM Sans'; letter-spacing: 6px; font-variant-numeric: tabular-nums; }
  .btn { display: flex; align-items: center; justify-content: center; height: 52px; border-radius: 16px; background: var(--accent); color: var(--on); font: 600 16px 'DM Sans'; text-decoration: none; }
  .btn.alt { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--line); }
  ol { margin: 8px 0 0 20px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
  footer { text-align: center; font-size: 13px; color: var(--muted); padding: 20px; }
  footer a { color: inherit; }
</style>
</head>
<body>
<main>
  <a class="logo" href="/">Klick<i>ers</i></a>
  <h1>You’re invited to an event.</h1>
  <p>Everyone’s photos from the day land in one shared album. Add yours with Klickers, free for guests.</p>
  <div class="code"><small>Your event code</small><b>${spaced}</b></div>
  <a class="btn" href="${appLink}">Open in Klickers</a>
  <a class="btn alt" id="store" href="${APP_STORE}">Get Klickers</a>
  <ol>
    <li>Get Klickers and sign in.</li>
    <li>Tap Join and enter <b>${spaced}</b>, or scan the QR code again.</li>
  </ol>
</main>
<footer><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/support">Support</a></footer>
<script>
  if (/android/i.test(navigator.userAgent)) document.getElementById('store').href = '${PLAY_STORE}';
</script>
</body>
</html>`;
}

@Controller()
export class SiteController {
  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'public, max-age=300')
  landing() {
    return LANDING;
  }

  @Get('j/:code')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'public, max-age=3600')
  join(@Param('code') code: string) {
    const parsed = joinEventSchema.safeParse({ code });
    if (!parsed.success) throw new NotFoundException('That isn’t an event code. Codes are 6 digits.');
    return joinPage(parsed.data.code);
  }

  @Get('.well-known/apple-app-site-association')
  @Header('content-type', 'application/json')
  @Header('cache-control', 'public, max-age=3600')
  appleAppSiteAssociation() {
    return APPLE_APP_SITE_ASSOCIATION;
  }
}
