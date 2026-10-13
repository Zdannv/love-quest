// Jalan Pulang Berdua ala Fireboy & Watergirl: 🔥 Api (aman di lava) & 💧 Air (aman di air), lendir hijau bahaya buat dua-duanya.
// Injek tombol buat buka gerbang / naikin lift, ambil permata, terus dua-duanya masuk pintu masing-masing.
// Sendiri: ganti-gantian ngontrol dua karakter (🔄). Berdua (p.duel): masing-masing pegang satu karakter dari HP sendiri.
// Level dicek otomatis biar pasti bisa diselesaiin (lompat maks 2 ubin ke atas / ±3 ubin datar).
import { drawEmoji, loadImage } from '../util.js';
import { drawToon, toonLoad } from '../toon.js';
import { drawSky, makeFx } from '../scene.js';

// # tembok · L lava · A air · G lendir · P/Q lahir api/air · F/D pintu api/air · f/w permata · o tombol→gerbang g · p tombol→lift m
export const COOP_LEVELS = [
  ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#',
    '#.F......D.#', '####....####', '#....fw....#', '#...####...#', '#..........#', '#.##....##.#', '#P........Q#', '####LLAA####'],
  ['############', '#..........#', '#..........#', '#.Fo.....D.#', '#####gg#####', '#.....w....#', '#...####...#', '#..........#',
    '#.##....##.#', '#....f.....#', '#...####...#', '#..........#', '#.##....##.#', '#P...o....Q#', '##AA####LL##'],
  ['############', '#..........#', '#..........#', '#..........#', '#.Fp....pD.#', '#####..#####', '#....fw....#', '#..........#',
    '#..........#', '#..........#', '#..........#', '#..........#', '#....mm....#', '#P..p..p..Q#', '##LL####AA##'],
  ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#.F......D.#', '####....####', '#...w..f...#',
    '#...#GG#...#', '#..........#', '#.##....##.#', '#..........#', '#....##....#', '#P........Q#', '##GG#LA#GG##'],
];
const TIPS = [
  'Api 🔥 aman di lava, Air 💧 aman di air. Pencet tombol Ganti buat gantian gerakin. Ambil permata warnamu, terus masuk pintu masing-masing!',
  'Injek tombol buat buka gerbang di atas. Yang udah naik, injek tombol atas biar pasangannya bisa nyusul!',
  'Satu injek tombol, liftnya naik bawa pasangan. Di atas ada tombol lagi buat ngangkat lift sekali lagi!',
  'Awas lendir hijau 🟩, dua-duanya bisa jatuh! Lompat jauh nyebrangin kolam.',
];
const GRAV = 34, JUMP = 12.8, RUN = 4.6, CW = 0.6, CH = 0.86, LIFT = 5, LIFT_SPEED = 2.4;

export function startCoop(stage, p, api) {
  const wrap = document.createElement('div'); wrap.className = 'fight-wrap'; stage.appendChild(wrap);
  const view = document.createElement('div'); view.className = 'fight-view'; wrap.appendChild(view);
  const canvas = document.createElement('canvas'); canvas.className = 'catch-canvas'; view.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const duel = p.duel || null;
  const pad = document.createElement('div'); pad.className = 'fight-pad';
  pad.innerHTML = `<div class="fp-move"><button data-k="left" aria-label="Kiri">◀</button><button data-k="right" aria-label="Kanan">▶</button></div>
    <div class="fp-act">${duel ? '' : '<button data-k="swap" class="cp-swap" aria-label="Ganti karakter"><img alt=""><span>Ganti</span></button>'}<button data-k="jump" data-label="Lompat" aria-label="Lompat">⬆️</button></div>`;
  wrap.appendChild(pad);

  let W = 0, H = 0, T = 30, ox = 0, oy = 0;
  let lvIdx = p.level || 0, map, COLS, ROWS;
  function resize() {
    const r = view.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (map) { T = Math.floor(Math.min((W - 4) / COLS, (H - 34) / ROWS)); ox = (W - T * COLS) / 2; oy = 30 + (H - 34 - T * ROWS) / 2; }
  }

  // Fall (pasangan) = 💧 Air, Aidan (pengirim) = 🔥 Api
  const waterLook = { img: loadImage(p.waterFace), emoji: p.waterEmoji || '💧', toon: p.waterToon || 'f', name: p.waterName || 'Air' };
  const fireLook = { img: loadImage(p.fireFace), emoji: p.fireEmoji || '🔥', toon: p.fireToon || 'm', name: p.fireName || 'Api' };
  toonLoad(waterLook.toon, fireLook.toon);
  const mine = duel ? (duel.role === 'pasangan' ? 'water' : 'fire') : (p.start || 'water');
  let active = mine;
  // Tombol ganti: nunjukin muka karakter yang bakal dikontrol
  function swapFace() {
    const btn = pad.querySelector('.cp-swap'); if (!btn) return;
    const next = active === 'fire' ? 'water' : 'fire';
    btn.querySelector('img').src = next === 'fire' ? p.fireFace : p.waterFace;
    btn.style.setProperty('--sw', next === 'fire' ? '#ff7a2f' : '#3b9cff');
    btn.querySelector('span').textContent = `Ganti ke ${next === 'fire' ? '🔥' : '💧'}`;
  }
  swapFace();
  let chars, gems, liftY, gates, done = false, raf = 0, last = performance.now(), lastStats = '', lastSent = 0, state = 'play', stateT = 0, deaths = 0, msg = null;
  const offs = [];

  function load(i) {
    lvIdx = i; map = COOP_LEVELS[i].map((r) => [...r]); ROWS = map.length; COLS = map[0].length;
    const find = (ch) => { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (map[y][x] === ch) return [x, y]; return [1, 1]; };
    const mk = (kind, ch, look) => { const [x, y] = find(ch); return { kind, x: x + 0.5 - CW / 2, y: y + 1 - CH, vx: 0, vy: 0, ground: false, face: 1, walk: 0, atDoor: false, ...look }; };
    chars = { fire: mk('fire', 'P', fireLook), water: mk('water', 'Q', waterLook) };
    gems = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (map[y][x] === 'f' || map[y][x] === 'w') gems.push({ x, y, kind: map[y][x] === 'f' ? 'fire' : 'water', got: false });
    liftY = 0; gates = 0; state = 'play'; stateT = 0;
    resize();
    api.say(TIPS[i] || TIPS[0], 'happy');
  }
  const tile = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? '#' : map[y][x]);
  const pressed = (btn) => Object.values(chars).some((c) => { const cx = Math.floor(c.x + CW / 2), cy = Math.floor(c.y + CH - 0.05); return tile(cx, cy) === btn; });
  const lifts = () => { const out = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (map[y][x] === 'm') out.push({ x, y: y - liftY, w: 1, h: 0.5 }); return out; };
  const solidTile = (x, y) => { const t = tile(x, y); return t === '#' || t === 'L' || t === 'A' || t === 'G' || (t === 'g' && gates < 0.5); };
  function hits(x, y, w, h) {
    for (let ty = Math.floor(y); ty <= Math.floor(y + h - 1e-6); ty++) for (let tx = Math.floor(x); tx <= Math.floor(x + w - 1e-6); tx++) if (solidTile(tx, ty)) return true;
    return lifts().some((l) => x < l.x + l.w && x + w > l.x && y < l.y + l.h && y + h > l.y);
  }

  // ---- Fisika satu karakter ----
  function step(c, ctrl, dt) {
    c.vx = ctrl ? (ctrl.r - ctrl.l) * RUN : 0;
    if (c.vx) c.face = Math.sign(c.vx);
    if (ctrl?.jump && c.ground) { c.vy = -JUMP; c.ground = false; api.sfx('flip'); }
    c.vy = Math.min(18, c.vy + GRAV * dt);
    // horizontal
    let nx = c.x + c.vx * dt;
    if (!hits(nx, c.y, CW, CH)) c.x = nx; else c.vx = 0;
    // vertikal
    let ny = c.y + c.vy * dt;
    c.ground = false;
    if (hits(c.x, ny, CW, CH)) {
      if (c.vy > 0) { // mendarat: tempel ke atas ubin / lift
        let top = Math.floor(ny + CH);
        for (const l of lifts()) if (c.x < l.x + l.w && c.x + CW > l.x && ny + CH > l.y && c.y + CH <= l.y + 0.3) top = Math.min(top, l.y);
        c.y = top - CH; c.ground = true;
      } else c.y = Math.floor(ny) + 1; // kepala kebentur: tempel ke bawah ubin
      c.vy = 0;
    } else c.y = ny;
    c.walk = c.vx && c.ground ? c.walk + dt * 10 : 0;
    // kolam & pintu & permata
    const fx = Math.floor(c.x + CW / 2), under = tile(fx, Math.floor(c.y + CH + 0.05));
    if (c.ground && (under === 'G' || (c.kind === 'fire' && under === 'A') || (c.kind === 'water' && under === 'L'))) return die(c);
    const here = tile(fx, Math.floor(c.y + CH / 2));
    c.atDoor = c.ground && here === (c.kind === 'fire' ? 'F' : 'D');
    for (const g of gems) if (!g.got && g.kind === c.kind && Math.abs(g.x + 0.5 - (c.x + CW / 2)) < 0.6 && Math.abs(g.y + 0.5 - (c.y + CH / 2)) < 0.75) {
      g.got = true; api.sfx('good'); api.streak(true);
      if (duel) duel.send('jgem', { l: lvIdx, i: gems.indexOf(g) });
    }
    if (c.y > ROWS) die(c);
  }
  function die(c, remote) {
    if (state !== 'play') return;
    deaths++;
    api.sfx('bad'); api.streak(false);
    msg = `${c.kind === 'fire' ? '🔥' : '💧'} ${c.name} jatuh ${c.kind === 'fire' ? 'ke air' : 'ke lava'}… ulang yuk!`;
    state = 'dead'; stateT = 0;
    if (duel && !remote) duel.send('jdie', { l: lvIdx });
  }

  // ---- Input ----
  const hold = { left: false, right: false }; let jumpQ = false;
  function press(k, down) {
    if (k === 'left' || k === 'right') hold[k] = down;
    if (k === 'jump' && down) jumpQ = true;
    if (k === 'swap' && down && !duel) { active = active === 'fire' ? 'water' : 'fire'; api.sfx('click'); swapFace(); }
  }
  pad.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; e.preventDefault(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} press(b.dataset.k, true); });
  const up = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; b.classList.remove('on'); press(b.dataset.k, false); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); pad.addEventListener('contextmenu', (e) => e.preventDefault());
  const KEY = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', ' ': 'jump', Tab: 'swap', q: 'swap' };
  const onKey = (e) => { const k = KEY[e.key]; if (!k) return; e.preventDefault(); if (e.repeat && k !== 'left' && k !== 'right') return; press(k, e.type === 'keydown'); };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('resize', resize);

  // ---- Online ----
  const other = mine === 'fire' ? 'water' : 'fire';
  if (duel) {
    offs.push(duel.on('jpos', (d) => { if (d.l !== lvIdx) return; const c = chars[other]; c.tx = d.x; c.ty = d.y; c.face = d.f; c.ground = !!d.g; c.atDoor = !!d.dr; c.walkOn = !!d.w; }));
    offs.push(duel.on('jgem', (d) => { if (d.l === lvIdx && gems[d.i]) gems[d.i].got = true; }));
    offs.push(duel.on('jdie', (d) => { if (d.l === lvIdx) die(chars[other], true); }));
    offs.push(duel.on('jnext', (d) => { if (d.l > lvIdx && state !== 'clear') { if (d.l >= COOP_LEVELS.length) end(); else load(d.l); } }));
  }

  function update(dt) {
    stateT += dt;
    if (state === 'dead') { if (stateT > 1.4) { msg = null; load(lvIdx); } return; }
    if (state === 'clear') { if (stateT > 2.2) { if (!duel) end(); else if (lvIdx + 1 >= COOP_LEVELS.length) end(); else load(lvIdx + 1); } return; }
    // tombol → gerbang & lift
    gates = pressed('o') ? Math.min(1, gates + dt * 4) : Math.max(0, gates - dt * 4);
    const want = pressed('p') ? LIFT : 0, before = liftY;
    liftY += Math.sign(want - liftY) * Math.min(Math.abs(want - liftY), LIFT_SPEED * dt);
    const dLift = liftY - before;
    // lift ngangkut yang berdiri di atasnya
    if (dLift) for (const c of Object.values(chars)) {
      if (duel && c.kind === other) continue;
      if (lifts().some((l) => c.x < l.x + l.w && c.x + CW > l.x && Math.abs(c.y + CH - (l.y + dLift)) < 0.12)) c.y -= dLift;
    }
    const ctrl = { l: hold.left ? 1 : 0, r: hold.right ? 1 : 0, jump: jumpQ };
    jumpQ = false;
    if (duel) {
      step(chars[mine], ctrl, dt);
      const o = chars[other]; if (o.tx != null) { o.x += (o.tx - o.x) * Math.min(1, dt * 14); o.y += (o.ty - o.y) * Math.min(1, dt * 14); o.walk = o.walkOn ? o.walk + dt * 10 : 0; }
      if (performance.now() - lastSent > 66) { lastSent = performance.now(); const m = chars[mine]; duel.send('jpos', { l: lvIdx, x: +m.x.toFixed(3), y: +m.y.toFixed(3), f: m.face, g: m.ground ? 1 : 0, dr: m.atDoor ? 1 : 0, w: m.walk ? 1 : 0 }); }
    } else {
      for (const k of ['fire', 'water']) if (state === 'play') step(chars[k], k === active ? ctrl : null, dt);
    }
    if (state === 'play' && chars.fire.atDoor && chars.water.atDoor) {
      state = 'clear'; stateT = 0; api.sfx('win');
      if (duel) duel.send('jnext', { l: lvIdx + 1 });
    }
  }

  // ---- Gambar ----
  const X = (x) => ox + x * T, Y = (y) => oy + y * T;
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  const POOL = { L: ['#ff7a2f', '#ffb347'], A: ['#3b9cff', '#8fd3ff'], G: ['#52c41a', '#a6f07a'] };
  const fx = makeFx();
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const tm = performance.now() / 1000;
    // malam hari di jalan pulang: langit berbintang + bukit, bagian dalam level agak digelapin biar karakternya kelihatan
    drawSky(ctx, W, H, Y(ROWS) - T * 2, (chars.water.x + chars.fire.x) * T * 0.15, tm, 'night', Math.max(0.7, T / 30));
    ctx.fillStyle = 'rgba(35,25,70,.38)'; ctx.fillRect(X(0), Y(0), T * COLS, T * ROWS);
    const solid = (xx, yy) => yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS && (map[yy][xx] === '#' || POOL[map[yy][xx]]);
    const block = (px, py, x, y) => { // batu bata; yang paling atas ditumbuhin rumput
      ctx.fillStyle = '#6f4f8f'; ctx.fillRect(px, py, T + 0.5, T + 0.5);
      ctx.fillStyle = '#84629f'; ctx.fillRect(px + 1, py + 1, T - 1.5, T * 0.44); ctx.fillRect(px + ((x + y) % 2 ? 1 : T * 0.5), py + T * 0.52, T * 0.48, T * 0.42);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(px + 2, py + 2, T * 0.5, 2);
      if (!solid(x, y - 1)) { ctx.fillStyle = '#5fbf7a'; rr(px - 1, py - T * 0.1, T + 2.5, T * 0.3, T * 0.12); ctx.fill(); ctx.fillStyle = '#8fe09a'; ctx.fillRect(px, py - T * 0.1, T + 0.5, T * 0.08); }
    };
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const t = map[y][x], px = X(x), py = Y(y);
      if (t === '#') block(px, py, x, y);
      if (POOL[t]) {
        ctx.fillStyle = '#6f4f8f'; ctx.fillRect(px, py, T + 0.5, T + 0.5);
        const gw = ctx.createRadialGradient(px + T / 2, py + T * 0.2, 1, px + T / 2, py + T * 0.2, T * 1.1); gw.addColorStop(0, POOL[t][1] + '88'); gw.addColorStop(1, POOL[t][1] + '00');
        ctx.fillStyle = gw; ctx.fillRect(px - T * 0.6, py - T, T * 2.2, T * 1.4);
        if (Math.random() < 0.03) fx.burst(px + Math.random() * T, py + T * 0.15, { n: 1, colors: [POOL[t][1], '#fff'], speed: 40, size: 2.4, gravity: -60, life: 0.7, up: 1 });
        const [c1, c2] = POOL[t], g = ctx.createLinearGradient(0, py, 0, py + T * 0.55); g.addColorStop(0, c2); g.addColorStop(1, c1);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px, py + T * 0.12);
        for (let i = 0; i <= 6; i++) ctx.lineTo(px + (T * i) / 6, py + T * 0.08 + Math.sin(tm * 4 + x * 2 + i) * T * 0.05);
        ctx.lineTo(px + T, py + T * 0.55); ctx.lineTo(px, py + T * 0.55); ctx.fill();
      }
      if (t === 'g') { const op = gates; ctx.fillStyle = '#ffb020'; rr(px + T * 0.1, py + T * (0.1 + 0.8 * op), T * 0.8, T * 0.8 * (1 - op) + 2, 4); ctx.fill(); if (op < 0.9) { ctx.fillStyle = '#e08a00'; for (let i = 0; i < 3; i++) ctx.fillRect(px + T * (0.22 + i * 0.25), py + T * (0.1 + 0.8 * op), T * 0.06, T * 0.8 * (1 - op)); } }
      if (t === 'o' || t === 'p') { const on = pressed(t); ctx.fillStyle = t === 'o' ? '#ffb020' : '#a66bff'; rr(px + T * 0.18, py + T * (on ? 0.86 : 0.76), T * 0.64, T * (on ? 0.14 : 0.24), 5); ctx.fill(); }
      if (t === 'F' || t === 'D') {
        const fire = t === 'F', c = chars[fire ? 'fire' : 'water'];
        const col = fire ? '#ff7a2f' : '#3b9cff', lite = fire ? '#ffe2cf' : '#d9eeff';
        const dg = ctx.createRadialGradient(px + T / 2, py + T * 0.2, 2, px + T / 2, py + T * 0.2, T * 1.5); dg.addColorStop(0, c.atDoor ? 'rgba(255,245,170,.75)' : col + '55'); dg.addColorStop(1, col + '00');
        ctx.fillStyle = dg; ctx.fillRect(px - T, py - T * 1.4, T * 3, T * 2.6);
        ctx.fillStyle = '#fff6ea'; rr(px - T * 0.12, py - T * 0.5, T * 1.24, T * 1.5, 4); ctx.fill(); // dinding rumah
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px - T * 0.3, py - T * 0.45); ctx.lineTo(px + T / 2, py - T * 1.1); ctx.lineTo(px + T * 1.3, py - T * 0.45); ctx.closePath(); ctx.fill(); // atap
        ctx.fillStyle = c.atDoor ? '#fff2a8' : lite; rr(px + T * 0.2, py - T * 0.2, T * 0.6, T * 1.2, [T * 0.3, T * 0.3, 2, 2]); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px + T * 0.68, py + T * 0.45, T * 0.05, 0, Math.PI * 2); ctx.fill();
        drawEmoji(ctx, fire ? '🔥' : '💧', px + T / 2, py - T * 0.72, T * 0.36);
        if (c.atDoor) drawEmoji(ctx, '✨', px + T / 2, py - T * 0.7, T * 0.5);
      }
    }
    for (const l of lifts()) { ctx.fillStyle = '#a66bff'; rr(X(l.x), Y(l.y), T, T * 0.5, 5); ctx.fill(); ctx.fillStyle = '#c9a6ff'; ctx.fillRect(X(l.x) + 2, Y(l.y) + 2, T - 4, T * 0.12); }
    for (const g of gems) if (!g.got) { const gx = X(g.x) + T / 2, gy = Y(g.y) + T / 2, gg = ctx.createRadialGradient(gx, gy, 1, gx, gy, T * 0.7); gg.addColorStop(0, g.kind === 'fire' ? 'rgba(255,150,120,.6)' : 'rgba(140,210,255,.6)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, T * 0.7, 0, Math.PI * 2); ctx.fill(); }
    fx.draw(ctx);
    for (const g of gems) if (!g.got) drawEmoji(ctx, g.kind === 'fire' ? '❤️‍🔥' : '💎', X(g.x) + T / 2, Y(g.y) + T / 2 + Math.sin(tm * 3 + g.x) * T * 0.08, T * 0.7);
    for (const c of [chars.water, chars.fire]) {
      const cx = X(c.x + CW / 2), feet = Y(c.y + CH);
      const glow = ctx.createRadialGradient(cx, feet - T * 0.6, 2, cx, feet - T * 0.6, T * 0.9);
      glow.addColorStop(0, c.kind === 'fire' ? 'rgba(255,122,47,.45)' : 'rgba(59,156,255,.45)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(cx - T, feet - T * 1.6, T * 2, T * 1.8);
      const pose = !c.ground ? 'jump' : c.walk ? `walk${Math.floor(c.walk) % 8}` : 'idle';
      drawToon(ctx, c.toon, pose, cx, feet + T * 0.06, T * 1.5, c.face, c.img, c.emoji, c.kind === 'fire' ? '#ff7a2f' : '#3b9cff');
      if (!duel && c.kind === active && state === 'play') drawEmoji(ctx, '👇', cx, feet - T * 1.75 + Math.sin(tm * 6) * 3, T * 0.45);
    }
    ctx.fillStyle = 'rgba(255,255,255,.88)'; rr(4, 3, 92, 24, 12); ctx.fill(); rr(W - 74, 3, 70, 24, 12); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '700 15px Fredoka, sans-serif'; ctx.fillStyle = '#5a2a52';
    ctx.fillText(`Level ${lvIdx + 1}/${COOP_LEVELS.length}`, 10, 15);
    ctx.textAlign = 'right';
    const got = gems.filter((g) => g.got).length;
    ctx.fillText(`💎 ${got}/${gems.length}`, W - 10, 15);
    const banner = (t, sub) => { ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(Math.min(34, W / 11))}px Fredoka, sans-serif`; ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#e8558f'; ctx.strokeText(t, W / 2, H * 0.42); ctx.fillText(t, W / 2, H * 0.42); if (sub) { ctx.font = '600 15px Fredoka, sans-serif'; ctx.lineWidth = 5; ctx.strokeText(sub, W / 2, H * 0.42 + 30); ctx.fillStyle = '#8a3f6e'; ctx.fillText(sub, W / 2, H * 0.42 + 30); } };
    if (state === 'clear') banner('Sampai rumah! 🏠', `Level ${lvIdx + 1} selesai · 💎 ${got}/${gems.length}`);
    if (state === 'dead' && msg) banner('Aduh! 😵', msg);
    const s = duel ? `🏠 Level ${lvIdx + 1} · kamu ${mine === 'fire' ? '🔥 Api' : '💧 Air'}` : `🏠 Level ${lvIdx + 1} · lagi gerakin ${active === 'fire' ? '🔥 ' + fireLook.name : '💧 ' + waterLook.name}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (!done) update(dt);
    fx.step(dt);
    draw();
  }
  load(lvIdx);
  if (window.__lqTest) window.__coop = { get chars() { return chars; }, get gems() { return gems; }, get state() { return state; }, get gates() { return gates; }, get liftY() { return liftY; } };
  raf = requestAnimationFrame(loop);

  function end() {
    if (done) return;
    done = true;
    const got = gems.filter((g) => g.got).length;
    if (duel) { api.finish({ win: state === 'clear' || lvIdx >= COOP_LEVELS.length - 1, levels: state === 'clear' ? lvIdx + 1 : lvIdx }); return; }
    api.finish({ win: true, stars: Math.min(3, 1 + got), detail: `Level ${lvIdx + 1} selesai · 💎 ${got}/${gems.length}${deaths ? ` · ${deaths}x ulang` : ''}` });
  }

  return {
    destroy() {
      done = true; cancelAnimationFrame(raf); offs.forEach((f) => f());
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('resize', resize);
    },
  };
}
