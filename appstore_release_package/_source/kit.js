// Klickers store-art kit: the app's real screens rebuilt in HTML from
// apps/mobile/src (copy, layout, theme tokens from docs/DESIGN.md), plus an
// iPhone 16 Pro titanium frame. Every screen is drawn at 390×844 pt.
(function () {
  const T = {
    paper: '#FAF9F5', surface: '#FFFEFA', surfaceBar: '#FDFCF8', ink: '#273C32', primary: '#385447', onPrimary: '#FFFEFA',
    muted: '#6E7464', subtle: '#8C8F7E', accent: '#748063', line: '#E9E9DF', lineStrong: '#DEDFD3', sage: '#E9EDDF',
    sageDeep: '#A5B18F', field: '#F0F1E9', warm: '#F0EADD', viewfinder: '#304538', danger: '#9F4C3E',
  };
  window.T = T;

  const ICON = {
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    images: '<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    aperture: '<circle cx="12" cy="12" r="10"/><path d="m14.31 8 5.74 9.94"/><path d="M9.69 8h11.48"/><path d="m7.38 12 5.74-9.94"/><path d="M9.69 16 3.95 6.06"/><path d="M14.31 16H2.83"/><path d="m16.62 12-5.74 9.94"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    share: '<path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>',
    face: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    flip: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    infinity: '<path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    eyeoff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  };
  const ic = (n, size = 20, color = 'currentColor', sw = 1.6, fill = 'none') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">${ICON[n]}</svg>`;
  window.ic = ic;

  const P = (i) => window.PHOTOS[i % window.PHOTOS.length];
  window.P = P;

  // ---------- QR (illustrative, deterministic, not a live code) ----------
  window.qrSvg = function (size = 180, color = T.ink) {
    const n = 25, c = size / n;
    let s = 7, out = '';
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const finder = (x, y) => `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}" rx="${c * 1.4}" fill="${color}"/><rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" rx="${c}" fill="#fff"/><rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}" rx="${c * 0.6}" fill="${color}"/>`;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!inF && rnd() > 0.52) out += `<rect x="${x * c + 0.4}" y="${y * c + 0.4}" width="${c - 0.8}" height="${c - 0.8}" rx="${c * 0.3}" fill="${color}"/>`;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${out}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
  };

  // ---------- chrome ----------
  const statusBar = (dark) => {
    const c = dark ? '#fff' : '#111';
    return `<div class="sb" style="color:${c}"><span class="sb-t">9:41</span><span class="sb-r">
      <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="${c}"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="${c}"/><rect x="10" y="3" width="3" height="9" rx="1" fill="${c}"/><rect x="15" y="0" width="3" height="12" rx="1" fill="${c}"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0z M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0z M1.2 4.6a9.6 9.6 0 0 1 13.6 0L13.4 6a7.6 7.6 0 0 0-10.8 0z" fill="${c}"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="${c}" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.5" fill="${c}"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="${c}" opacity=".45"/></svg></span></div>`;
  };
  const homeInd = (dark) => `<div class="hi" style="background:${dark ? 'rgba(255,255,255,.85)' : '#111'}"></div>`;

  const tabBar = (tabs, active) => `<div class="tabbar">${tabs.map((t) => {
    if (t === 'camera') return `<div class="tab"><div class="tab-cam">${ic('camera', 22, T.onPrimary)}</div><span class="tab-l" style="color:${active === t ? T.ink : T.subtle}">Camera</span></div>`;
    const map = { home: ['house', 'Home'], album: ['images', 'Album'], overview: ['house', 'Overview'], gallery: ['grid', 'Gallery'], design: ['palette', 'Design'], people: ['users', 'People'], rules: ['sliders', 'Rules'] };
    const [i, l] = map[t];
    const on = active === t;
    return `<div class="tab">${ic(i, 22, on ? T.ink : T.subtle)}<span class="tab-l" style="color:${on ? T.ink : T.subtle};font-weight:${on ? 600 : 500}">${l}</span>${on ? '<i class="tab-dot"></i>' : ''}</div>`;
  }).join('')}</div>`;
  const GUEST_TABS = ['home', 'camera', 'album'];
  const HOST_TABS = ['overview', 'gallery', 'camera', 'design', 'people'];

  const eventHeader = (title, right = '') => `<div class="ehead"><div class="ehead-l"><span class="iconbtn">${ic('left', 20, T.ink)}</span><span class="title">${title}</span></div>${right}</div>`;
  const avatar = (txt, size = 34, bg = T.sage) => `<span class="av" style="width:${size}px;height:${size}px;background:${bg};font-size:${size * 0.42}px">${txt}</span>`;
  const tile = (i, opts = {}) => `<div class="ptile" style="background-image:${P(i)};${opts.style || ''}">${opts.badge || ''}${opts.frame ? `<span class="fno">${opts.frame}</span>` : ''}</div>`;

  // ---------- screens (each returns inner HTML of a 390×844 screen) ----------
  const S = {};

  S.guestHome = (o = {}) => `${statusBar(false)}
    ${eventHeader('Klickers', avatar('R', 32))}
    <div class="scroll" style="padding:6px 16px 0;gap:14px">
      <div class="hero" style="background-image:${P(o.cover ?? 3)}">
        <div class="hero-grad"></div>
        <div class="hero-txt"><span class="eyebrow" style="color:#fff;opacity:.92;font-size:10px">SATURDAY, 12 DECEMBER 2026</span>
          <span class="display" style="color:#fff">Tanya <i>&amp;</i> Paul</span>
          <span class="row" style="gap:5px;color:#fff;opacity:.92">${ic('pin', 13, '#fff')}<span class="cap" style="color:#fff">The Lake Palace, Udaipur</span></span></div>
        <span class="glass">${ic('star', 10, '#273C32', 2, '#273C32')}${ic('star', 10, '#273C32', 2, '#273C32')}</span>
      </div>
      <div class="cap" style="color:${T.muted};padding:0 4px;font-size:14px">“Thank you for being here. Shoot everything.” — Tanya &amp; Paul</div>
      <div class="card" style="padding:16px;gap:12px;border-radius:20px">
        <div class="row" style="justify-content:space-between;align-items:flex-end">
          <div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow" style="color:${T.primary}">Your roll</span>
            <div class="row" style="align-items:baseline;gap:6px"><span class="mono" style="font-size:34px;line-height:38px;color:${T.ink};letter-spacing:-.6px">${o.left ?? 24}</span><span class="cap">of 36 left</span></div></div>
          <span class="mono" style="font-size:12px;color:${T.muted}">${36 - (o.left ?? 24)} taken</span>
        </div>
        <div class="track"><div class="fill" style="width:${((o.left ?? 24) / 36) * 100}%"></div></div>
        <div class="row" style="gap:16px"><span class="row cap" style="gap:5px">${ic('video', 14, T.muted)}0:30 of video</span><span class="row cap" style="gap:5px">${ic('mic', 14, T.muted)}1:00 of voice notes</span></div>
        <div class="btn">${ic('camera', 18, T.onPrimary)}<span>Open camera</span></div>
      </div>
      <div class="row" style="justify-content:space-between"><span class="bs">From the room</span><span class="row" style="gap:3px;color:${T.primary};font:500 14px DM Sans">See all ${ic('right', 15, T.primary)}</span></div>
      <div class="grid4">${[0, 4, 2, 7, 9, 5, 10, 6].map((i) => tile(i, { style: 'aspect-ratio:1/1;border-radius:10px' })).join('')}</div>
    </div>
    ${tabBar(GUEST_TABS, 'home')}${homeInd(false)}`;

  S.camera = (o = {}) => `<div style="position:absolute;inset:0;background:#141c17"></div>${statusBar(true)}
    <div style="position:relative;display:flex;justify-content:space-between;align-items:center;padding:6px 18px 0;color:#fff">
      <span class="row" style="gap:8px"><span class="iconbtn dark">${ic('left', 20, '#fff')}</span><span style="font:600 17px DM Sans">Your camera</span></span>
      <span class="mono" style="font-size:13px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.12)">${o.count ?? '24 / 36'}</span></div>
    <div class="vf" style="background-image:${P(o.photo ?? 3)}">
      <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
      ${o.flash ? '<div style="position:absolute;inset:0;background:#fff;opacity:.85"></div>' : ''}
      <span class="mono" style="position:absolute;left:12px;bottom:10px;color:#fff;font-size:11px;opacity:.9">KLICKERS · 12.12.26</span>
    </div>
    <div style="position:relative;text-align:center;color:rgba(255,255,255,.78);font:400 13px DM Sans;margin-top:14px">Photos appear live for everyone</div>
    <div class="modes"><span>VOICE</span><span>VIDEO</span><span class="on">PHOTO</span></div>
    <div class="shutter-row">
      <div class="thumb" style="background-image:${P(o.last ?? 2)}"></div>
      <div class="shutter"><i></i></div>
      <span class="iconbtn dark" style="width:52px;height:52px;background:rgba(255,255,255,.12)">${ic('flip', 22, '#fff')}</span>
    </div>
    ${homeInd(true)}`;

  S.album = (o = {}) => {
    const ids = o.ids || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    return `${statusBar(false)}
    ${eventHeader('The album', `<span class="row" style="gap:6px;color:${T.primary};font:600 14px DM Sans">${ic('download', 18, T.primary)}Download</span>`)}
    <div class="seg">${['Everyone', 'Me', 'Mine'].map((l) => `<span class="${l === (o.tab || 'Everyone') ? 'on' : ''}">${l}</span>`).join('')}</div>
    <div class="scroll" style="padding:12px 16px 0">
      ${o.banner || ''}
      <div class="grid3">${ids.map((i, k) => tile(i, {
        frame: String(k + 1).padStart(2, '0'),
        style: `aspect-ratio:4/5;${o.highlight === k ? 'outline:3px solid #C9D3B0;outline-offset:-3px' : ''}`,
        badge: k === 1 ? `<span class="chip-v">${ic('video', 11, '#fff', 2)}0:12</span>` : k === 4 ? `<span class="chip-v">${ic('mic', 11, '#fff', 2)}0:24</span>` : '',
      })).join('')}</div>
    </div>
    ${tabBar(GUEST_TABS, 'album')}${homeInd(false)}`;
  };

  S.findMe = () => `${statusBar(false)}
    ${eventHeader('The album')}
    <div class="seg">${['Everyone', 'Me', 'Mine'].map((l) => `<span class="${l === 'Me' ? 'on' : ''}">${l}</span>`).join('')}</div>
    <div class="scroll" style="padding:14px 16px 0;gap:14px">
      <div class="card row" style="padding:14px;gap:14px;border-radius:18px;background:${T.sage};border-color:${T.sage}">
        <div class="selfie"><svg viewBox="0 0 80 80" width="64" height="64"><rect width="80" height="80" fill="#cfd7bd"/><circle cx="40" cy="34" r="15" fill="#8a6a55"/><path d="M14 80c2-18 13-26 26-26s24 8 26 26z" fill="#385447"/><path d="M25 30c2-12 28-14 30 0-6-5-24-5-30 0z" fill="#2a1d16"/></svg></div>
        <div style="display:flex;flex-direction:column;gap:3px;flex:1"><span class="bs">Photos you’re in</span><span class="cap">23 found · from guests and photographers</span><span style="font:600 13px DM Sans;color:${T.primary}">Change</span></div>
      </div>
      <div class="grid3">${[3, 7, 0, 10, 12, 4, 9, 1, 13].map((i, k) => tile(i, { style: 'aspect-ratio:4/5', badge: `<span class="facebox" style="left:${30 + (k * 13) % 30}%;top:${22 + (k * 7) % 20}%"></span>` })).join('')}</div>
    </div>
    ${tabBar(GUEST_TABS, 'album')}${homeInd(false)}`;

  S.design = () => {
    const themes = [['Sage & ivory', '#FAF9F5', '#385447'], ['Blush & rose', '#FBF5F3', '#A3455A'], ['Marigold', '#FFF8EC', '#C4521A'], ['Midnight & gold', '#11151E', '#D6B36C'], ['Boardroom', '#F4F6F9', '#1F4FD1'], ['Graphite & lime', '#101210', '#C3EE4F']];
    const fonts = [['Classic', "'DM Serif Display'"], ['Romantic', "'Cormorant Garamond'"], ['Script', "'Pinyon Script'"], ['Modern', "'Space Grotesk'"], ['Statement', "'Syne'"]];
    return `${statusBar(false)}
    ${eventHeader('Design studio')}
    <div class="scroll" style="padding:8px 20px 0;gap:16px">
      <div style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">Colour theme</span>
        <div class="row" style="gap:10px">${themes.map(([n, bg, ac], k) => `<span class="sw" style="background:${bg};${k === 1 ? `box-shadow:0 0 0 2px ${T.paper},0 0 0 4px ${T.ink}` : ''}"><i style="background:${ac}"></i></span>`).join('')}</div>
        <span class="cap">Blush &amp; rose</span></div>
      <div style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">Name font</span>
        <div class="row" style="gap:8px;flex-wrap:wrap">${fonts.map(([n, f], k) => `<span class="fchip ${k === 2 ? 'on' : ''}" style="font-family:${f}">${n}</span>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">Photo frame</span>
        <div class="polaroid"><div class="pimg" style="background-image:${P(3)}"></div><div class="pcap"><span style="font:400 22px 'Pinyon Script';color:#A3455A">Tanya &amp; Paul</span><span class="mono" style="font-size:10px;color:#8A7376">12 · 12 · 2026</span></div></div></div>
      <div class="row" style="justify-content:space-between;padding:14px 0;border-top:1px solid ${T.line}"><span class="bs">Stamp every photo</span><span class="toggle on"><i></i></span></div>
    </div>
    ${tabBar(HOST_TABS, 'design')}${homeInd(false)}`;
  };

  S.overview = () => `${statusBar(false)}
    ${eventHeader('Overview', avatar('T', 32))}
    <div class="scroll" style="padding:6px 16px 0;gap:14px">
      <div class="hero" style="height:150px;background-image:${P(0)}"><div class="hero-grad"></div>
        <div class="hero-txt"><span class="pill-live"><i></i>Live · uploads open</span><span class="display" style="color:#fff;font-size:30px;line-height:32px">Tanya <i>&amp;</i> Paul</span></div></div>
      <div class="grid2">
        <div class="stat"><span class="cap">Guests in</span><span class="num">142<small>/200</small></span></div>
        <div class="stat"><span class="cap">Photos</span><span class="num">2,318</span></div>
        <div class="stat"><span class="cap">Photographers</span><span class="num">2<small>/2</small></span></div>
        <div class="stat"><span class="cap">Videos &amp; voice</span><span class="num">164</span></div>
      </div>
      <div class="card" style="padding:14px;gap:12px;border-radius:18px">
        <div class="row" style="justify-content:space-between"><span class="bs">Waiting for review</span><span class="mono" style="font-size:12px;color:${T.muted}">3</span></div>
        ${[[11, 'Riya', '2 min ago'], [8, 'Kabir', '5 min ago']].map(([p, n, t]) => `<div class="row" style="gap:12px">${tile(p, { style: 'width:48px;height:48px;flex:none;border-radius:10px' })}<div style="flex:1;display:flex;flex-direction:column"><span class="bs" style="font-size:14px">Photo by ${n}</span><span class="cap">${t}</span></div><span class="rbtn">${ic('x', 16, T.danger, 2)}</span><span class="rbtn ok">${ic('check', 16, T.onPrimary, 2.2)}</span></div>`).join('')}
      </div>
      <div class="row" style="gap:10px"><div class="btn" style="flex:1">${ic('qr', 18, T.onPrimary)}<span>Invite guests</span></div><div class="btn sec" style="flex:1">${ic('download', 18, T.ink)}<span>Download all</span></div></div>
    </div>
    ${tabBar(HOST_TABS, 'overview')}${homeInd(false)}`;

  S.people = () => `${statusBar(false)}
    ${eventHeader('People')}
    <div class="scroll" style="padding:6px 16px 0;gap:14px">
      <div class="card" style="padding:14px;gap:12px;border-radius:18px;background:${T.warm};border-color:${T.warm}">
        <div class="row" style="gap:12px">${avatar('R', 40, '#E3D9C2')}<div style="flex:1;display:flex;flex-direction:column"><span class="bs">Riya wants to keep shooting?</span><span class="cap">Out of shots · asks for 18 more</span></div></div>
        <div class="row" style="gap:10px"><div class="btn sec" style="flex:1;height:42px">Reject</div><div class="btn" style="flex:1.6;height:42px">Allow Riya 18 more shots</div></div>
      </div>
      <span class="eyebrow">Designated photographers · 2 of 2</span>
      ${[['A', 'Arjun Mehta', 'Shares 3,000 uploads, with a badge on every shot'], ['S', 'Sara Khan', 'Joined 12 Dec']].map(([a, n, c]) => `<div class="lrow">${avatar(a, 38)}<div style="flex:1;display:flex;flex-direction:column"><span class="bs">${n}</span><span class="cap">${c}</span></div><span class="badge">${ic('aperture', 11, T.ink, 2)}Photographer</span></div>`).join('')}
      <span class="eyebrow">Guests · 142</span>
      ${[['K', 'Kabir Singh', '31 photos · 1 video'], ['M', 'Meera Iyer', '24 photos · voice note'], ['D', 'Dev Patel', '36 photos · roll complete']].map(([a, n, c]) => `<div class="lrow">${avatar(a, 38)}<div style="flex:1;display:flex;flex-direction:column"><span class="bs">${n}</span><span class="cap">${c}</span></div>${ic('right', 18, T.subtle)}</div>`).join('')}
    </div>
    ${tabBar(HOST_TABS, 'people')}${homeInd(false)}`;

  S.invite = () => `<div style="position:absolute;inset:0;background:rgba(24,42,36,.4)"></div>${statusBar(true)}
    <div class="sheet" style="top:96px">
      <i class="grab"></i>
      <span class="eyebrow" style="text-align:center">Invite guests</span>
      <div style="text-align:center;font:400 30px/34px 'DM Serif Display';color:${T.ink};letter-spacing:-.6px">Scan, and <i style="color:${T.accent}">you’re in.</i></div>
      <div class="qrcard">${qrSvg(196)}<span class="mono" style="font-size:20px;letter-spacing:6px;color:${T.ink}">482 917</span></div>
      <div class="cap" style="text-align:center">klickers.app/j/482917 · works without the app</div>
      <div class="btn">${ic('share', 18, T.onPrimary)}<span>Share invite link</span></div>
      <div class="btn sec">${ic('download', 18, T.ink)}<span>Download table card</span></div>
    </div>`;

  S.joinPreview = () => `${statusBar(false)}
    <div class="scroll" style="padding:20px 20px 0;gap:16px">
      <div class="hero" style="height:300px;background-image:${P(3)}"><div class="hero-grad"></div><div class="hero-txt"><span class="eyebrow" style="color:#fff">You’re invited</span><span class="display" style="color:#fff">Tanya <i>&amp;</i> Paul</span></div></div>
      ${[['camera', 'Your own roll for the event', '36 shots, plus a video and a voice note'], ['zap', 'Photos appear live for everyone', 'Every guest’s shots in one album'], ['sparkles', 'Full quality, nothing compressed', 'Download the originals']].map(([i, t, c]) => `<div class="row" style="gap:12px"><span class="itile">${ic(i, 18, T.ink)}</span><div style="display:flex;flex-direction:column"><span class="bs">${t}</span><span class="cap">${c}</span></div></div>`).join('')}
      <div class="btn" style="margin-top:6px"><span>Enter the event</span></div>
    </div>${homeInd(false)}`;

  S.plans = () => {
    const plans = [
      ['Party', '₹999', ['75 guests, up to 24 photos each', 'One 30-second video and a voice message per guest', 'Gallery open for 90 days'], false],
      ['Celebration', '₹2,499', ['200 guests, up to 50 photos each', 'Two photographers: 3,000 photos and 30 videos', 'Your own colours and fonts', 'Download every original as a ZIP', 'Gallery open for 12 months'], true],
      ['Branded Event', '₹4,999', ['300 guests, up to 50 photos each', 'Your logo, photo frames and approving photos'], false],
    ];
    return `${statusBar(false)}
    <div class="scroll" style="padding:24px 20px 0;gap:12px">
      <span class="eyebrow">Packages</span>
      <div style="font:400 26px/30px 'DM Serif Display';color:${T.ink};letter-spacing:-.5px">One payment per event</div>
      <div class="cap" style="font-size:14px;line-height:20px">Guests and photographers always join free.</div>
      ${plans.map(([n, p, f, cur]) => `<div class="card" style="padding:16px;gap:8px;border-radius:18px;${cur ? `border:2px solid ${T.accent}` : ''}">
        <div class="row" style="justify-content:space-between;align-items:baseline"><span style="font:600 17px DM Sans;color:${T.ink}">${n}</span><span style="font:400 22px 'DM Serif Display';color:${T.ink}">${p}</span></div>
        ${f.map((x) => `<div class="row" style="gap:8px;align-items:flex-start">${ic('check', 15, T.accent, 2)}<span class="cap" style="flex:1">${x}</span></div>`).join('')}
        ${cur ? '' : `<div class="btn" style="height:44px;margin-top:4px"><span>Upgrade for ${p}</span></div>`}
        ${cur ? `<span style="font:500 14px DM Sans;color:${T.muted}">Your package</span>` : ''}
      </div>`).join('')}
    </div>${homeInd(false)}`;
  };

  S.photo = (o = {}) => `<div style="position:absolute;inset:0;background:#0d120f"></div>${statusBar(true)}
    <div class="row" style="position:relative;justify-content:space-between;padding:8px 16px;color:#fff"><span class="iconbtn dark">${ic('x', 20, '#fff')}</span><span style="font:600 15px DM Sans">Photo by ${o.by || 'Riya'}</span><span class="iconbtn dark">${ic('heart', 20, '#fff')}</span></div>
    <div style="position:absolute;left:0;right:0;top:150px;height:520px;background:${P(o.i ?? 7)} center/cover"></div>
    <div class="row" style="position:absolute;left:20px;right:20px;bottom:56px;gap:10px"><div class="btn" style="flex:1;background:#fff;color:${T.ink}">${ic('download', 18, T.ink)}<span>Save</span></div><div class="btn" style="flex:1;background:rgba(255,255,255,.14)">${ic('share', 18, '#fff')}<span>Share</span></div></div>
    ${homeInd(true)}`;

  window.SCREENS = S;

  // ---------- device ----------
  // An iPhone 16 Pro-proportioned titanium frame around a 390×844 screen, scaled to `width` px.
  window.phone = function (screenHtml, width = 300, extraStyle = '') {
    const scale = width / 430;
    return `<div class="dev" style="width:430px;height:932px;transform:scale(${scale});transform-origin:top left;${extraStyle}"><div class="dev-ti"><div class="dev-bz"><div class="dev-scr">${screenHtml}<div class="di"></div></div></div></div><i class="btn-a"></i><i class="btn-b"></i><i class="btn-c"></i><i class="btn-d"></i></div>`;
  };
  window.phoneBox = (screenHtml, width, style = '') =>
    `<div style="width:${width}px;height:${width * 932 / 430}px;position:absolute;${style}">${phone(screenHtml, width)}</div>`;

  // ---------- CSS ----------
  const css = `
  .dev{position:relative;flex:none}
  .dev-ti{position:absolute;inset:0;border-radius:74px;padding:5px;background:linear-gradient(140deg,#d8d6d0 0%,#8d8b86 18%,#c9c7c1 38%,#6f6e6a 62%,#b9b7b1 82%,#7d7c78 100%);box-shadow:0 50px 90px -30px rgba(0,0,0,.65),0 18px 40px -20px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.35)}
  .dev-bz{position:absolute;inset:5px;border-radius:69px;background:#050505;padding:15px}
  .dev-scr{position:relative;width:400px;height:872px;border-radius:55px;overflow:hidden;background:${T.paper}}
  .dev-scr>*{zoom:1}
  .dev .di{position:absolute;top:13px;left:50%;width:124px;height:36px;margin-left:-62px;border-radius:20px;background:#000;z-index:20}
  .dev i[class^=btn-]{position:absolute;width:5px;border-radius:2px;background:linear-gradient(90deg,#77756f,#b5b3ad)}
  .dev .btn-a{left:-3px;top:180px;height:34px}.dev .btn-b{left:-3px;top:240px;height:64px}.dev .btn-c{left:-3px;top:316px;height:64px}.dev .btn-d{right:-3px;top:270px;height:100px}
  .dev-scr{font-family:'DM Sans',system-ui,sans-serif;color:${T.ink};display:flex;flex-direction:column}
  .sb{position:relative;z-index:10;height:54px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:6px 34px 0 46px}
  .sb-t{font:600 17px/1 -apple-system,'SF Pro Text','DM Sans',sans-serif;letter-spacing:-.2px}.sb-r{display:flex;gap:6px;align-items:center}
  .hi{position:absolute;bottom:9px;left:50%;width:140px;height:5px;margin-left:-70px;border-radius:3px;z-index:30}
  .ehead{height:52px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px 0 10px;border-bottom:1px solid ${T.line}}
  .ehead-l{display:flex;align-items:center;gap:4px}
  .title{font:600 17px/22px 'DM Sans'}
  .iconbtn{width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center}
  .iconbtn.dark{background:rgba(255,255,255,.1)}
  .scroll{position:relative;flex:1;display:flex;flex-direction:column;overflow:hidden}
  .row{display:flex;align-items:center}
  .eyebrow{font:600 11px/14px 'DM Sans';letter-spacing:1.5px;text-transform:uppercase;color:${T.subtle}}
  .display{font:400 38px/40px 'DM Serif Display',serif;letter-spacing:-1px}
  .display i{font-style:italic;color:#E4EBD2}
  .cap{font:400 13px/18px 'DM Sans';color:${T.muted}}
  .bs{font:600 15px/22px 'DM Sans';color:${T.ink}}
  .mono{font-family:'DM Mono',ui-monospace,monospace;font-weight:500}
  .hero{position:relative;height:246px;flex:none;border-radius:22px;overflow:hidden;background-size:cover;background-position:center}
  .hero-grad{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.62))}
  .hero-txt{position:absolute;left:18px;right:18px;bottom:16px;display:flex;flex-direction:column;gap:6px}
  .glass{position:absolute;top:12px;left:12px;display:flex;gap:2px;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.92)}
  .card{display:flex;flex-direction:column;background:${T.surface};border:1px solid ${T.line}}
  .track{height:6px;border-radius:3px;background:${T.sage};overflow:hidden}.fill{height:100%;border-radius:3px;background:${T.primary}}
  .btn{height:48px;flex:none;border-radius:14px;background:${T.primary};color:${T.onPrimary};display:flex;align-items:center;justify-content:center;gap:8px;font:600 15px 'DM Sans'}
  .btn.sec{background:${T.field};color:${T.ink};box-shadow:inset 0 0 0 1px ${T.lineStrong}}
  .grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
  .grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  .grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .ptile{position:relative;border-radius:12px;background-color:${T.sage};background-size:cover;background-position:center;overflow:hidden}
  .fno{position:absolute;left:7px;bottom:5px;font:500 10px 'DM Mono',monospace;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5)}
  .chip-v{position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:3px;padding:3px 6px;border-radius:999px;background:rgba(0,0,0,.45);color:#fff;font:600 10px 'DM Sans'}
  .facebox{position:absolute;width:30%;aspect-ratio:1;border:2px solid #E4EBD2;border-radius:8px;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
  .seg{display:flex;flex:none;border-bottom:1px solid ${T.line}}
  .seg span{flex:1;text-align:center;padding:12px 0 10px;font:500 14px 'DM Sans';color:${T.subtle};border-bottom:2px solid transparent}
  .seg span.on{color:${T.ink};font-weight:600;border-bottom-color:${T.primary}}
  .tabbar{position:absolute;left:0;right:0;bottom:0;height:88px;padding:8px 6px 0;display:flex;align-items:flex-start;justify-content:space-around;background:${T.surfaceBar};border-top:1px solid ${T.line};z-index:5}
  .tab{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding-top:4px}
  .tab-l{font:500 11px/14px 'DM Sans'}
  .tab-dot{position:absolute;top:31px;width:4px;height:4px;border-radius:2px;background:${T.primary};display:none}
  .tab-cam{width:52px;height:44px;margin-top:-22px;border-radius:15px;background:${T.primary};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 5px ${T.paper}}
  .av{border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-family:'DM Serif Display',serif;color:${T.ink};flex:none}
  .vf{position:relative;margin:14px 16px 0;aspect-ratio:3/4;border-radius:18px;background-size:cover;background-position:center;overflow:hidden;flex:none}
  .vf .c{position:absolute;width:26px;height:26px;border:0 solid rgba(255,255,255,.9)}
  .vf .tl{top:12px;left:12px;border-top-width:2.5px;border-left-width:2.5px;border-top-left-radius:6px}
  .vf .tr{top:12px;right:12px;border-top-width:2.5px;border-right-width:2.5px;border-top-right-radius:6px}
  .vf .bl{bottom:12px;left:12px;border-bottom-width:2.5px;border-left-width:2.5px;border-bottom-left-radius:6px}
  .vf .br{bottom:12px;right:12px;border-bottom-width:2.5px;border-right-width:2.5px;border-bottom-right-radius:6px}
  .modes{position:relative;display:flex;justify-content:center;gap:26px;margin-top:14px;font:600 12px 'DM Sans';letter-spacing:1.5px;color:rgba(255,255,255,.55)}
  .modes .on{color:#E4EBD2}
  .shutter-row{position:relative;display:flex;align-items:center;justify-content:space-between;padding:18px 40px 0}
  .thumb{width:52px;height:52px;border-radius:12px;background-size:cover;background-position:center;box-shadow:0 0 0 2px rgba(255,255,255,.8)}
  .shutter{width:78px;height:78px;border-radius:999px;border:4px solid #fff;display:flex;align-items:center;justify-content:center}
  .shutter i{width:62px;height:62px;border-radius:999px;background:#fff}
  .selfie{width:64px;height:64px;border-radius:999px;overflow:hidden;flex:none;box-shadow:0 0 0 3px ${T.surface}}
  .sw{width:40px;height:40px;border-radius:999px;position:relative;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);flex:none}
  .sw i{position:absolute;right:4px;bottom:4px;width:16px;height:16px;border-radius:999px}
  .fchip{height:38px;padding:0 14px;border-radius:999px;display:inline-flex;align-items:center;font-size:17px;background:${T.surface};box-shadow:inset 0 0 0 1px ${T.lineStrong}}
  .fchip.on{background:${T.ink};color:${T.paper};box-shadow:none}
  .polaroid{align-self:center;width:230px;padding:10px 10px 0;background:#FFFCFB;border-radius:4px;box-shadow:0 18px 36px -18px rgba(0,0,0,.45),0 1px 4px rgba(0,0,0,.1);transform:rotate(-2deg)}
  .pimg{aspect-ratio:1/1.05;background-size:cover;background-position:center}
  .pcap{display:flex;flex-direction:column;align-items:center;padding:8px 0 10px;gap:2px}
  .toggle{width:51px;height:31px;border-radius:999px;background:${T.lineStrong};position:relative}
  .toggle.on{background:${T.primary}}.toggle i{position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:999px;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.2)}.toggle.on i{left:22px}
  .pill-live{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.92);font:600 12px 'DM Sans';color:${T.ink}}
  .pill-live i{width:7px;height:7px;border-radius:999px;background:#3BA55C}
  .stat{display:flex;flex-direction:column;gap:2px;padding:14px;border-radius:16px;background:${T.surface};border:1px solid ${T.line}}
  .stat .num{font:400 28px/32px 'DM Serif Display';color:${T.ink}}.stat small{font:400 15px 'DM Sans';color:${T.muted}}
  .rbtn{width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:${T.field};box-shadow:inset 0 0 0 1px ${T.lineStrong};flex:none}
  .rbtn.ok{background:${T.primary};box-shadow:none}
  .lrow{display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid ${T.line}}
  .badge{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:8px;background:${T.sage};font:600 11px 'DM Sans';color:${T.ink}}
  .sheet{position:absolute;left:0;right:0;bottom:0;background:${T.paper};border-radius:28px 28px 0 0;padding:12px 24px 40px;display:flex;flex-direction:column;gap:14px;z-index:6}
  .grab{align-self:center;width:36px;height:4px;border-radius:2px;background:${T.lineStrong};margin-bottom:6px}
  .qrcard{align-self:center;display:flex;flex-direction:column;align-items:center;gap:12px;padding:22px 22px 16px;border-radius:22px;background:#fff;border:1px solid ${T.line}}
  .itile{width:40px;height:40px;border-radius:12px;background:${T.sage};display:flex;align-items:center;justify-content:center;flex:none}
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
})();
