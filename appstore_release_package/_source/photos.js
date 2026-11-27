// Illustrated "event photos" for the store art, in the same flat style as the
// app's own welcome illustrations (apps/mobile/assets/images/welcome). Swap any
// of them for real event photos later: every tile reads PHOTOS[i] as a CSS url().
(function () {
  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const W = 400, H = 500;
  const wrap = (body, defs = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;
  const bokeh = (r, n, colors, minR, maxR, yMax = H, op = [0.15, 0.45]) => {
    let out = '';
    for (let i = 0; i < n; i++) {
      const c = colors[Math.floor(r() * colors.length)];
      out += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * yMax).toFixed(1)}" r="${(minR + r() * (maxR - minR)).toFixed(1)}" fill="${c}" opacity="${(op[0] + r() * (op[1] - op[0])).toFixed(2)}"/>`;
    }
    return out;
  };
  const person = (x, y, s, fill, armUp = false) => {
    const head = `<circle cx="${x}" cy="${y - 62 * s}" r="${15 * s}" fill="${fill}"/>`;
    const body = `<path d="M${x - 26 * s} ${y + 80 * s} L${x - 24 * s} ${y - 20 * s} Q${x} ${y - 46 * s} ${x + 24 * s} ${y - 20 * s} L${x + 26 * s} ${y + 80 * s} Z" fill="${fill}"/>`;
    const arm = armUp ? `<path d="M${x + 16 * s} ${y - 30 * s} L${x + 34 * s} ${y - 96 * s}" stroke="${fill}" stroke-width="${10 * s}" stroke-linecap="round"/>` : '';
    return head + body + arm;
  };

  const scenes = {
    lights(seed = 1) {
      const r = rng(seed);
      let wire = '';
      for (let k = 0; k < 3; k++) {
        const y0 = 70 + k * 70;
        wire += `<path d="M-10 ${y0} Q200 ${y0 + 70} 410 ${y0 - 10}" stroke="#2b2433" stroke-width="2" fill="none"/>`;
        for (let i = 0; i <= 14; i++) {
          const t = i / 14, x = -10 + 420 * t, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + 70) + t * t * (y0 - 10);
          wire += `<circle cx="${x}" cy="${y + 6}" r="9" fill="#ffd98a" opacity=".35"/><circle cx="${x}" cy="${y + 6}" r="3.6" fill="#fff4cf"/>`;
        }
      }
      return wrap(
        `<rect width="400" height="500" fill="url(#g)"/>${bokeh(r, 26, ['#f7b0c8', '#b9a3ff', '#ffd18a', '#ff9e7a'], 10, 38)}${wire}` +
          person(70, 440, 1, '#1d1620') + person(150, 430, 1.15, '#1d1620', true) + person(250, 445, 1.05, '#1d1620') + person(335, 435, 1.1, '#1d1620', true),
        `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2140"/><stop offset=".6" stop-color="#6b3f5e"/><stop offset="1" stop-color="#d9825f"/></linearGradient>`,
      );
    },
    toast(seed = 2) {
      const r = rng(seed);
      const glass = (x, rot) => `<g transform="rotate(${rot} ${x} 330)"><path d="M${x - 34} 150 L${x + 34} 150 L${x + 22} 280 Q${x} 300 ${x - 22} 280 Z" fill="#fff6dc" opacity=".22" stroke="#fff3cf" stroke-width="3"/><path d="M${x - 30} 190 L${x + 30} 190 L${x + 21} 276 Q${x} 294 ${x - 21} 276 Z" fill="#f6c453" opacity=".85"/><rect x="${x - 3}" y="290" width="6" height="110" fill="#fff3cf" opacity=".7"/><ellipse cx="${x}" cy="402" rx="34" ry="8" fill="#fff3cf" opacity=".7"/></g>`;
      let fizz = '';
      for (let i = 0; i < 30; i++) fizz += `<circle cx="${175 + r() * 50}" cy="${60 + r() * 110}" r="${1.5 + r() * 3}" fill="#fff8e0" opacity="${0.5 + r() * 0.5}"/>`;
      return wrap(`<rect width="400" height="500" fill="url(#g)"/>${bokeh(r, 30, ['#ffcf7a', '#ff9f5a', '#ffe7b0'], 8, 34)}${glass(150, 14)}${glass(250, -14)}${fizz}`,
        `<radialGradient id="g" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#7a4a22"/><stop offset="1" stop-color="#241510"/></radialGradient>`);
    },
    cake(seed = 3) {
      const r = rng(seed);
      let candles = '';
      for (let i = 0; i < 5; i++) {
        const x = 140 + i * 30;
        candles += `<rect x="${x - 4}" y="196" width="8" height="40" rx="3" fill="${['#f4a6b8', '#a7d3c4', '#f8d77a'][i % 3]}"/><ellipse cx="${x}" cy="180" rx="16" ry="24" fill="#ffcf6a" opacity=".35"/><path d="M${x} 166 Q${x + 8} 182 ${x} 192 Q${x - 8} 182 ${x} 166Z" fill="#ffe9a8"/>`;
      }
      return wrap(`<rect width="400" height="500" fill="url(#g)"/>${bokeh(r, 22, ['#ffb36b', '#ff7f7f', '#ffd9a0'], 8, 30, 260)}
        <ellipse cx="200" cy="452" rx="170" ry="26" fill="#000" opacity=".35"/>
        <rect x="80" y="330" width="240" height="110" rx="12" fill="#fbe4d8"/><path d="M80 350 Q100 372 120 350 Q140 372 160 350 Q180 372 200 350 Q220 372 240 350 Q260 372 280 350 Q300 372 320 350 L320 330 L80 330Z" fill="#f3a5b6"/>
        <rect x="115" y="236" width="170" height="98" rx="10" fill="#fff3ea"/><path d="M115 252 Q132 272 149 252 Q166 272 183 252 Q200 272 217 252 Q234 272 251 252 Q268 272 285 252 L285 236 L115 236Z" fill="#a7d3c4"/>${candles}`,
        `<radialGradient id="g" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#5a2f2f"/><stop offset="1" stop-color="#1b1012"/></radialGradient>`);
    },
    dance(seed = 4) {
      const r = rng(seed);
      const beams = ['#ff5fa2', '#5fd0ff', '#ffe066', '#9c7bff'].map((c, i) => `<path d="M200 70 L${-60 + i * 150} 500 L${20 + i * 150} 500Z" fill="${c}" opacity=".18"/>`).join('');
      let tiles = '';
      for (let i = 0; i < 40; i++) tiles += `<rect x="${178 + (i % 7) * 6.5}" y="${50 + Math.floor(i / 7) * 6.5}" width="5" height="5" fill="${r() > 0.5 ? '#ffffff' : '#9fb3c8'}" opacity=".9"/>`;
      return wrap(`<rect width="400" height="500" fill="url(#g)"/>${beams}<circle cx="200" cy="70" r="26" fill="#cfd8e3"/>${tiles}<line x1="200" y1="0" x2="200" y2="44" stroke="#cfd8e3" stroke-width="2"/>
        ${bokeh(r, 24, ['#ff5fa2', '#5fd0ff', '#ffe066'], 4, 16)}${person(90, 430, 1.1, '#120c1e', true)}${person(190, 445, 1.2, '#120c1e')}${person(300, 425, 1.05, '#120c1e', true)}`,
        `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1236"/><stop offset="1" stop-color="#4a1d5c"/></linearGradient>`);
    },
    couple(seed = 5) {
      const r = rng(seed);
      let flowers = '';
      for (let i = 0; i < 46; i++) {
        const a = Math.PI * (i / 45), x = 200 - Math.cos(a) * 150, y = 400 - Math.sin(a) * 260;
        flowers += `<circle cx="${x + (r() - 0.5) * 18}" cy="${y + (r() - 0.5) * 18}" r="${9 + r() * 9}" fill="${['#f7c6d0', '#fff1e6', '#e88fa6', '#c9d8b6'][i % 4]}"/>`;
      }
      return wrap(`<rect width="400" height="500" fill="url(#g)"/><circle cx="200" cy="300" r="70" fill="#ffe2a8" opacity=".75"/>${flowers}
        <rect x="0" y="420" width="400" height="80" fill="#3d2a35"/>
        <circle cx="178" cy="292" r="16" fill="#2a1c24"/><path d="M152 430 L158 320 Q178 300 198 320 L206 430Z" fill="#2a1c24"/>
        <circle cx="224" cy="300" r="15" fill="#2a1c24"/><path d="M196 430 Q214 330 224 318 Q236 330 256 430Z" fill="#2a1c24"/>`,
        `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6b393"/><stop offset=".6" stop-color="#f08a8a"/><stop offset="1" stop-color="#8a4a68"/></linearGradient>`);
    },
    sparklers(seed = 6) {
      const r = rng(seed);
      let trail = '';
      for (let k = 0; k < 2; k++) {
        const cx = 140 + k * 120, cy = 190 + k * 20;
        for (let i = 0; i < 60; i++) {
          const a = r() * Math.PI * 2, d = 6 + r() * 70;
          trail += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * d).toFixed(1)}" y2="${(cy + Math.sin(a) * d).toFixed(1)}" stroke="#ffe9a8" stroke-width="${(0.6 + r() * 1.6).toFixed(1)}" opacity="${(0.3 + r() * 0.7).toFixed(2)}"/>`;
        }
        trail += `<circle cx="${cx}" cy="${cy}" r="30" fill="#ffd36a" opacity=".35"/><circle cx="${cx}" cy="${cy}" r="7" fill="#fffbe8"/>`;
      }
      return wrap(`<rect width="400" height="500" fill="url(#g)"/>${bokeh(r, 30, ['#ffffff'], 1, 2.4, 300, [0.4, 0.9])}${trail}${person(150, 440, 1.25, '#0b1020', true)}${person(255, 448, 1.2, '#0b1020', true)}`,
        `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1633"/><stop offset="1" stop-color="#2b2a52"/></linearGradient>`);
    },
    table(seed = 7) {
      const r = rng(seed);
      let set = '';
      [[110, 140], [290, 140], [110, 360], [290, 360]].forEach(([x, y]) => {
        set += `<circle cx="${x}" cy="${y}" r="58" fill="#fffdf6"/><circle cx="${x}" cy="${y}" r="40" fill="#f3efe4"/><rect x="${x + 66}" y="${y - 40}" width="6" height="80" rx="3" fill="#c9b37a"/><rect x="${x - 72}" y="${y - 40}" width="6" height="80" rx="3" fill="#c9b37a"/>`;
      });
      let fl = '';
      for (let i = 0; i < 24; i++) fl += `<circle cx="${200 + (r() - 0.5) * 70}" cy="${250 + (r() - 0.5) * 120}" r="${10 + r() * 10}" fill="${['#f4b6c2', '#fff6e8', '#e7a0b0', '#a8c49a'][i % 4]}"/>`;
      return wrap(`<rect width="400" height="500" fill="#d9c3a5"/><rect width="400" height="500" fill="url(#p)" opacity=".35"/>${set}${fl}`,
        `<pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M0 12h24" stroke="#bfa47e" stroke-width="1"/></pattern>`);
    },
    stage(seed = 8) {
      const r = rng(seed);
      let heads = '';
      for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) heads += `<circle cx="${20 + i * 46 + (row % 2) * 22}" cy="${400 + row * 36}" r="${16 + row * 2}" fill="#0c1424"/><rect x="${2 + i * 46 + (row % 2) * 22}" y="${410 + row * 36}" width="${36 + row * 4}" height="40" rx="14" fill="#0c1424"/>`;
      return wrap(`<rect width="400" height="500" fill="url(#g)"/>${bokeh(r, 14, ['#6aa0ff', '#ffffff'], 4, 14, 200)}
        <rect x="70" y="90" width="260" height="150" rx="6" fill="#1f4fd1"/><rect x="70" y="90" width="260" height="150" rx="6" fill="url(#s)"/>
        <text x="200" y="162" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="30" fill="#fff">SUMMIT 26</text>
        <text x="200" y="192" text-anchor="middle" font-family="DM Sans, sans-serif" font-size="13" fill="#cfdcff">Keynote · Hall A</text>
        <rect x="60" y="300" width="280" height="14" fill="#1a2438"/>${person(200, 290, 0.9, '#0c1424')}${heads}`,
        `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1e3d"/><stop offset="1" stop-color="#1c2f57"/></linearGradient><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
    },
    confetti(seed = 9) {
      const r = rng(seed);
      let c = '';
      for (let i = 0; i < 90; i++) c += `<rect x="${r() * 400}" y="${r() * 460}" width="${4 + r() * 6}" height="${8 + r() * 10}" rx="2" transform="rotate(${r() * 180} ${r() * 400} ${r() * 460})" fill="${['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#ff8fd8'][i % 5]}"/>`;
      return wrap(`<rect width="400" height="500" fill="url(#g)"/>${c}${person(200, 420, 1.5, '#3a2a1a', true)}<path d="M176 290 L150 230" stroke="#3a2a1a" stroke-width="15" stroke-linecap="round"/>`,
        `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe7c2"/><stop offset="1" stop-color="#ffb39b"/></linearGradient>`);
    },
    mehendi(seed = 10) {
      const r = rng(seed);
      let dots = '';
      for (let i = 0; i < 70; i++) dots += `<circle cx="${r() * 400}" cy="${r() * 500}" r="${2 + r() * 5}" fill="#ffd36a" opacity="${0.3 + r() * 0.5}"/>`;
      return wrap(`<rect width="400" height="500" fill="url(#g)"/>${dots}
        <path d="M120 520 Q110 360 170 300 Q190 280 200 240 Q206 220 220 230 Q230 240 222 270 L240 200 Q246 186 258 192 Q266 198 262 214 L250 270 L272 214 Q278 202 290 208 Q298 214 294 228 L276 290 L292 252 Q298 242 308 248 Q316 254 312 266 L290 340 Q276 400 280 520Z" fill="#c98b5a"/>
        <path d="M200 330 q20 -18 40 0 q-20 18 -40 0z M230 380 q14 -12 28 0 q-14 12 -28 0z M196 400 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0" fill="none" stroke="#6b2f12" stroke-width="3"/>`,
        `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a1f2b"/><stop offset="1" stop-color="#c2410c"/></linearGradient>`);
    },
  };

  const svgUrl = (svg) => `url('data:image/svg+xml;utf8,${encodeURIComponent(svg).replace(/'/g, '%27')}')`;
  const raster = (f) => `url('img/${f}')`;
  // Ordered so neighbouring tiles differ in colour.
  window.PHOTOS = [
    svgUrl(scenes.lights(1)), raster('welcome-2.jpg'), svgUrl(scenes.toast(2)), svgUrl(scenes.couple(5)),
    svgUrl(scenes.dance(4)), raster('welcome-3.jpg'), svgUrl(scenes.cake(3)), svgUrl(scenes.sparklers(6)),
    svgUrl(scenes.table(7)), raster('welcome-1.jpg'), svgUrl(scenes.confetti(9)), svgUrl(scenes.mehendi(10)),
    raster('look-sample.jpg'), svgUrl(scenes.lights(11)), svgUrl(scenes.toast(12)), svgUrl(scenes.dance(14)),
  ];
  window.STAGE_PHOTO = svgUrl(scenes.stage(8));
  window.SCENES = scenes;
  window.svgUrl = svgUrl;
})();
