// Bom Cinta ala Bomberman. Joystick buat jalan, 💣 taruh bom. Ledakan bentuk tanda tambah, bisa berantai,
// ngancurin peti. Dari peti bisa keluar 💥 (ledakan makin jauh), 💣 (bom makin banyak), 👟 (lari makin cepat).
// Sendiri (p.endless): lawan 3 bot, tiap ronde botnya makin pinter. Skor = ronde yang dimenangin.
// Berdua (p.duel): duel. Tiap HP ngatur pemainnya sendiri & mutusin sendiri kalau dia kena ledakan.
// Peti & power-up diacak pakai seed yang sama, jadi isi arenanya sama di dua HP.
// Peti spesial: 🧨 TNT (ledakin satu baris penuh) · ❄️ es (lawan beku 3 detik) · 🛡️ perisai (tahan 1 ledakan) · 🎁 kado (pasti power-up).
// Pemain boleh jalan nembus bom (biar nggak kejebak di antara dua bom); bot tetap nganggep bom itu tembok.
import { drawEmoji, drawFace, loadImage, keyHint } from '../util.js';
import { drawToon, toonLoad } from '../toon.js';
import { makeFx } from '../scene.js';

const COLS = 11, ROWS = 13, FUSE = 2.5, FLAME = 0.55, ROUND = 120;
const CORNERS = [[1, 11], [9, 1], [9, 11], [1, 1]];
const hash = (a, b, c) => { let n = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const POWER = { range: '💥', bomb: '💣', speed: '👟' };
const CRATE = 'BTGIS'; // B biasa · T TNT · G kado · I es · S perisai
const isCrate = (g) => Boolean(g) && CRATE.includes(g);
const SPECIAL = { T: { em: '🧨', c1: '#ff6b5a', c2: '#c8352b' }, G: { em: '🎁', c1: '#ffa3c6', c2: '#e05b93' }, I: { em: '❄️', c1: '#a8e2ff', c2: '#4aa8e0' }, S: { em: '🛡️', c1: '#cdb6ff', c2: '#8a6ae6' } };

export function startBomb(stage, p, api) {
  const wrap = document.createElement('div'); wrap.className = 'fight-wrap'; stage.appendChild(wrap);
  const view = document.createElement('div'); view.className = 'fight-view'; wrap.appendChild(view);
  const canvas = document.createElement('canvas'); canvas.className = 'catch-canvas'; view.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const pad = document.createElement('div'); pad.className = 'fight-pad pw-pad';
  pad.innerHTML = `<div class="pw-stick"><span></span></div><div class="fp-act"><button data-k="bomb" data-label="Taruh bom" class="bm-btn" aria-label="Taruh bom">💣</button></div>`;
  wrap.appendChild(pad);
  keyHint(wrap, [['W A S D / ←↑↓→', 'jalan'], ['Spasi / J', 'taruh bom']]);
  const knob = pad.querySelector('.pw-stick span');

  let W = 0, H = 0, T = 30, ox = 0, oy = 0;
  function resize() {
    const r = view.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    T = Math.floor(Math.min((W - 8) / COLS, (H - 40) / ROWS)); ox = (W - T * COLS) / 2; oy = 36 + (H - 40 - T * ROWS) / 2;
  }
  resize();

  const duel = p.duel || null;
  const seedBase = (p.seed || 777) >>> 0;
  let level = p.botLevel || 0, wins = 0, round = 0;
  let grid, players, bombs, flames, powers, time, state, stateT, roundResult;
  let done = false, raf = 0, last = performance.now(), lastStats = '', lastSent = 0;
  const offs = [];
  const myIdx = duel && duel.role === 'pengirim' ? 1 : 0;

  function newRound() {
    round++;
    const seed = seedBase + round * 101;
    grid = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        const wall = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0);
        const nearSpawn = CORNERS.some(([cx, cy]) => Math.abs(cx - x) + Math.abs(cy - y) <= 2);
        const box = !wall && !nearSpawn && hash(seed, x, y) < 0.62;
        const sp = hash(seed + 999, x, y); // jenis peti (sama di dua HP)
        row.push(wall ? 'W' : !box ? '.' : sp < 0.07 ? 'T' : sp < 0.13 ? 'G' : sp < 0.18 ? 'I' : sp < 0.23 ? 'S' : 'B');
      }
      grid.push(row);
    }
    const mk = (i, look) => ({ x: CORNERS[i][0] + 0.5, y: CORNERS[i][1] + 0.5, alive: true, max: 1, range: 1, speed: 3.2, frozen: 0, shield: false, inv: 0, ...look, ai: { path: [], t: 0 } });
    if (duel) {
      const A = { img: loadImage(p.face), emoji: p.emoji || '😊', name: p.name || 'Kamu', ring: '#ff8fb7', toon: p.toon || 'f' };
      const B = { img: loadImage(p.oppFace), emoji: p.oppEmoji || '😈', name: p.oppName || 'Lawan', ring: '#9fb4ff', toon: p.oppToon || 'm' };
      players = myIdx === 0 ? [mk(0, A), mk(1, B)] : [mk(0, B), mk(1, A)];
    } else {
      players = [mk(0, { img: loadImage(p.face), emoji: p.emoji || '😊', name: p.name || 'Kamu', ring: '#ff8fb7', toon: p.toon || 'f' })];
      const bots = [['🤖', 'Robot'], ['🦊', 'Rubah'], ['🐻', 'Beruang']];
      for (let i = 1; i <= (p.bots || 3); i++) players.push(mk(i, { img: null, emoji: bots[i - 1][0], name: bots[i - 1][1], ring: '#c9b6ff', bot: true, toon: i % 2 ? 'm' : 'f' }));
    }
    bombs = []; flames = []; powers = []; time = ROUND; state = 'intro'; stateT = 0; roundResult = null; rain = { n: 0, next: 50, warn: null };
  }
  const me = () => players[myIdx];
  const cellOf = (pl) => [Math.floor(pl.x), Math.floor(pl.y)];
  const bombAt = (x, y) => bombs.find((b) => b.x === x && b.y === y);
  const solid = (x, y) => grid[y]?.[x] !== '.' ;

  // ---- Bom & ledakan ----
  function place(pl, send = true) {
    if (state !== 'fight' || !pl.alive || pl.frozen > 0) return;
    const [x, y] = cellOf(pl);
    if (bombAt(x, y) || bombs.filter((b) => b.owner === pl).length >= pl.max) return;
    bombs.push({ x, y, t: FUSE, range: pl.range, owner: pl, pass: new Set(players.filter((q) => q.alive && cellOf(q)[0] === x && cellOf(q)[1] === y)) });
    api.sfx('click');
    if (duel && send) duel.send('bput', { x, y, r: pl.range });
  }
  function explode(b) {
    bombs = bombs.filter((q) => q !== b);
    api.sfx('boom');
    const cells = [[b.x, b.y]], fresh = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 1; i <= b.range; i++) {
        const x = b.x + dx * i, y = b.y + dy * i, g = grid[y][x];
        if (g === 'W') break;
        cells.push([x, y]);
        if (isCrate(g)) { breakCrate(x, y, b.owner, cells, fresh); break; }
        const other = bombAt(x, y); if (other) other.t = Math.min(other.t, 0.06);
      }
    }
    // power-up lama yang kena ledakan hangus; yang baru keluar dari peti aman
    powers = powers.filter((q) => !cells.some(([x, y]) => q.x === x && q.y === y)).concat(fresh);
    for (const [x, y] of cells) flames.push({ x, y, life: FLAME });
  }
  const inFlame = (x, y) => flames.some((f) => f.x === x && f.y === y);
  // Peti pecah: isi & efeknya (urutan & hasilnya sama di dua HP karena pakai seed)
  function breakCrate(x, y, owner, cells, fresh) {
    const g = grid[y][x];
    grid[y][x] = '.';
    const col = SPECIAL[g] ? [SPECIAL[g].c1, SPECIAL[g].c2, '#fff'] : ['#e0a868', '#b97c45', '#fff2d6'];
    fx.burst(X(x) + T / 2, Y(y) + T / 2, { n: g === 'B' ? 12 : 22, colors: col, speed: g === 'B' ? 170 : 240, size: 4 });
    const h = hash(seedBase + round * 7, x, y), pk = h < 0.36 ? 'range' : h < 0.68 ? 'bomb' : 'speed';
    const mine = owner === me();
    if (g === 'B') { if (h < 0.33) fresh.push({ x, y, k: h < 0.12 ? 'range' : h < 0.23 ? 'bomb' : 'speed' }); return; }
    if (g === 'G') { fresh.push({ x, y, k: pk }); if (mine) api.say('🎁 Peti kado: power-up!', 'happy'); return; }
    if (g === 'S') { if (owner?.alive) { owner.shield = true; } if (mine) { api.sfx('gold'); api.say('🛡️ Dapet perisai! Kebal 1x ledakan', 'happy'); } return; }
    if (g === 'I') {
      if (owner) for (const pl of players) if (pl !== owner && pl.alive) pl.frozen = 3;
      api.sfx('freeze');
      if (mine) api.say('❄️ Lawan membeku 3 detik!', 'happy'); else if (me().alive) api.say('❄️ Kamu membeku 3 detik!', 'sad');
      fx.burst(X(x) + T / 2, Y(y) + T / 2, { n: 18, colors: ['#e8f7ff', '#a8e2ff', '#fff'], speed: 260, size: 3 });
      return;
    }
    if (g === 'T') { // satu baris penuh meledak (tembok batu tetap aman), peti di baris itu ikut pecah
      shake = 0.45; api.sfx('boom');
      if (mine) api.say('🧨 TNT! Satu baris meledak!', 'happy');
      for (let xx = 1; xx < COLS - 1; xx++) {
        const gg = grid[y][xx];
        if (gg === 'W') continue;
        cells.push([xx, y]);
        if (isCrate(gg)) breakCrate(xx, y, owner, cells, fresh);
        const other = bombAt(xx, y); if (other) other.t = Math.min(other.t, 0.06);
      }
    }
  }
  let shake = 0;
  let rain = { n: 0, next: 50, warn: null };

  // ---- Bahaya (buat bot): sel yang bakal kena ledakan ----
  function dangerMap(extra) {
    const d = new Set(flames.map((f) => `${f.x},${f.y}`));
    for (const b of [...bombs, ...(extra ? [extra] : [])]) {
      d.add(`${b.x},${b.y}`);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 1; i <= b.range; i++) {
        const x = b.x + dx * i, y = b.y + dy * i; if (grid[y][x] === 'W') break; d.add(`${x},${y}`); if (isCrate(grid[y][x])) break;
      }
    }
    return d;
  }
  function bfs(sx, sy, goal, avoid) {
    const seen = new Set([`${sx},${sy}`]), q = [[sx, sy, []]];
    while (q.length) {
      const [x, y, path] = q.shift();
      if (goal(x, y) && path.length) return path;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (seen.has(k) || solid(nx, ny) || bombAt(nx, ny) || (avoid && avoid.has(k) && !goal(nx, ny))) continue;
        seen.add(k); q.push([nx, ny, [...path, [nx, ny]]]);
      }
    }
    return null;
  }
  function botThink(b, dt) {
    const lvl = Math.min(level, 6);
    if (b.frozen > 0) return;
    b.ai.t -= dt;
    const [x, y] = cellOf(b);
    const danger = dangerMap();
    if (danger.has(`${x},${y}`)) {
      const path = bfs(x, y, (cx, cy) => !danger.has(`${cx},${cy}`));
      if (path) b.ai.path = path;
      return;
    }
    if (b.ai.path.length || b.ai.t > 0) return;
    b.ai.t = Math.max(0.15, 0.6 - lvl * 0.07) * (0.7 + Math.random() * 0.6);
    const target = players.find((q) => q.alive && !q.bot);
    const nearBlock = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isCrate(grid[y + dy][x + dx]));
    const lineHit = target && (() => { const [tx, ty] = cellOf(target); if (tx !== x && ty !== y) return false; const d = Math.abs(tx - x) + Math.abs(ty - y); if (d > b.range) return false; const sx = Math.sign(tx - x), sy = Math.sign(ty - y); for (let i = 1; i < d; i++) if (solid(x + sx * i, y + sy * i)) return false; return true; })();
    if ((nearBlock || (lineHit && Math.random() < 0.55 + lvl * 0.07)) && bombs.filter((q) => q.owner === b).length < b.max) {
      const fake = { x, y, range: b.range };
      const d2 = dangerMap(fake);
      const escape = bfs(x, y, (cx, cy) => !d2.has(`${cx},${cy}`), null);
      if (escape && escape.length <= 4) { place(b, false); b.ai.path = escape; return; }
    }
    // jalan: deketin pemain (kalau lagi pinter) atau cari peti, hindari bahaya
    const goTo = target && Math.random() < 0.35 + lvl * 0.08
      ? bfs(x, y, (cx, cy) => Math.abs(cx - cellOf(target)[0]) + Math.abs(cy - cellOf(target)[1]) <= 1, danger)
      : bfs(x, y, (cx, cy) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isCrate(grid[cy + dy]?.[cx + dx])), danger);
    const pu = bfs(x, y, (cx, cy) => powers.some((q) => q.x === cx && q.y === cy), danger);
    const path = pu && pu.length < 6 ? pu : goTo;
    if (path) b.ai.path = path.slice(0, 3);
  }

  // ---- Gerak (nempel ke lorong, ada bantuan belok) ----
  function canEnter(pl, x, y) { if (solid(x, y)) return false; const b = bombAt(x, y); return !b || b.pass.has(pl) || !pl.bot; }
  function move(pl, mx, my, dt) {
    if (!pl.alive || pl.frozen > 0) return;
    const sp = pl.speed * dt;
    const [cx, cy] = cellOf(pl);
    if (Math.abs(mx) < 0.2 && Math.abs(my) < 0.2) return;
    const horiz = Math.abs(mx) >= Math.abs(my);
    const dir = horiz ? Math.sign(mx) : Math.sign(my);
    if (horiz) {
      const nx = cx + dir;
      const off = pl.y - (cy + 0.5);
      if (canEnter(pl, nx, cy) || (dir > 0 ? pl.x < cx + 0.5 : pl.x > cx + 0.5)) {
        if (Math.abs(off) > 0.05) pl.y -= Math.sign(off) * Math.min(Math.abs(off), sp); // lurusin ke tengah lorong
        else { pl.y = cy + 0.5; pl.x += dir * sp; if (!canEnter(pl, nx, cy)) pl.x = dir > 0 ? Math.min(pl.x, cx + 0.5) : Math.max(pl.x, cx + 0.5); }
      } else if (Math.abs(off) > 0.12 && canEnter(pl, nx, cy + Math.sign(off))) pl.y += Math.sign(off) * sp; // geser dikit biar bisa belok
    } else {
      const ny = cy + dir;
      const off = pl.x - (cx + 0.5);
      if (canEnter(pl, cx, ny) || (dir > 0 ? pl.y < cy + 0.5 : pl.y > cy + 0.5)) {
        if (Math.abs(off) > 0.05) pl.x -= Math.sign(off) * Math.min(Math.abs(off), sp);
        else { pl.x = cx + 0.5; pl.y += dir * sp; if (!canEnter(pl, cx, ny)) pl.y = dir > 0 ? Math.min(pl.y, cy + 0.5) : Math.max(pl.y, cy + 0.5); }
      } else if (Math.abs(off) > 0.12 && canEnter(pl, cx + Math.sign(off), ny)) pl.x += Math.sign(off) * sp;
    }
    for (const b of bombs) if (b.pass.has(pl) && (b.x !== Math.floor(pl.x) || b.y !== Math.floor(pl.y))) b.pass.delete(pl);
  }
  function moveBot(b, dt) {
    const nxt = b.ai.path[0]; if (!nxt) return;
    const tx = nxt[0] + 0.5, ty = nxt[1] + 0.5, dx = tx - b.x, dy = ty - b.y;
    if (Math.hypot(dx, dy) <= b.speed * dt + 0.02) { b.x = tx; b.y = ty; b.ai.path.shift(); return; }
    // arah penuh (bukan selisih kecil), biar nggak dianggap "joystick diam" pas udah deket
    if (Math.abs(dx) >= Math.abs(dy)) move(b, Math.sign(dx), 0, dt); else move(b, 0, Math.sign(dy), dt);
  }

  // ---- Input ----
  const stick = { x: 0, y: 0, id: null };
  const stickEl = pad.querySelector('.pw-stick');
  function stickAt(e) {
    const r = stickEl.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * r.width * 0.3}px, ${dy * r.width * 0.3}px)`;
  }
  stickEl.addEventListener('pointerdown', (e) => { e.preventDefault(); stick.id = e.pointerId; try { stickEl.setPointerCapture(e.pointerId); } catch {} stickAt(e); });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) stickAt(e); });
  const rel = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  stickEl.addEventListener('pointerup', rel); stickEl.addEventListener('pointercancel', rel);
  pad.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; e.preventDefault(); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); place(me()); });
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  const keys = {};
  const onKey = (e) => {
    const down = e.type === 'keydown';
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(e.key)) { e.preventDefault(); keys[e.key] = down; }
    if (down && !e.repeat && (e.key === ' ' || e.key === 'j')) { e.preventDefault(); place(me()); }
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('resize', resize);

  // ---- Online ----
  const opp = () => players[1 - myIdx];
  if (duel) {
    offs.push(duel.on('bpos', (d) => { const o = opp(); if (d.r === round) { o.tx = d.x; o.ty = d.y; o.max = d.mx; o.range = d.rg; } }));
    offs.push(duel.on('bput', (d) => { const o = opp(); if (bombAt(d.x, d.y)) return; bombs.push({ x: d.x, y: d.y, t: FUSE - 0.12, range: d.r, owner: o, pass: new Set([o, ...(cellOf(me())[0] === d.x && cellOf(me())[1] === d.y ? [me()] : [])]) }); api.sfx('click'); }));
    offs.push(duel.on('bpick', (d) => { powers = powers.filter((q) => !(q.x === d.x && q.y === d.y)); }));
    offs.push(duel.on('bdead', (d) => { if (d.r === round) { opp().alive = false; api.sfx('bad'); } }));
  }

  function update(dt) {
    stateT += dt;
    for (const f of flames) f.life -= dt;
    flames = flames.filter((f) => f.life > 0);
    if (state === 'intro') { if (stateT > 1.3) { state = 'fight'; stateT = 0; } return; }
    if (state === 'over') { if (stateT > 2) nextRound(); return; }
    time = Math.max(0, time - dt);
    shake = Math.max(0, shake - dt);
    // Hujan bom (berdua): mulai detik ke-50, jedanya makin pendek (6 → 2,5 detik). Ditandain 1 detik sebelum jatuh.
    if (duel) {
      const el = ROUND - time;
      if (!rain.warn && el >= rain.next - 1) {
        for (let tries = 0; tries < 12; tries++) {
          const h = hash(seedBase + round * 31, rain.n, tries), cx = 1 + Math.floor(h * (COLS - 2)), cy = 1 + Math.floor(hash(seedBase + round * 37, rain.n, tries) * (ROWS - 2));
          if (grid[cy][cx] === '.' && !bombAt(cx, cy)) { rain.warn = { x: cx, y: cy, at: rain.next }; break; }
        }
        if (!rain.warn) rain.next += 1;
        if (rain.n === 0 && rain.warn) api.say('☄️ Hujan bom dimulai! Liat tanda merah, langsung kabur!', 'happy');
      }
      if (rain.warn && el >= rain.warn.at) {
        if (!bombAt(rain.warn.x, rain.warn.y)) bombs.push({ x: rain.warn.x, y: rain.warn.y, t: 1.4, range: 2, owner: null, pass: new Set(players) });
        rain.n++; rain.next = rain.warn.at + Math.max(2.5, 6 - rain.n * 0.5); rain.warn = null;
      }
    }
    for (const pl of players) { pl.frozen = Math.max(0, pl.frozen - dt); pl.inv = Math.max(0, pl.inv - dt); }
    const m = me();
    const mx = stick.x + ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
    const my = stick.y + ((keys.ArrowDown || keys.s) ? 1 : 0) - ((keys.ArrowUp || keys.w) ? 1 : 0);
    move(m, mx, my, dt);
    if (duel) { const o = opp(); if (o.tx != null) { o.x += (o.tx - o.x) * Math.min(1, dt * 14); o.y += (o.ty - o.y) * Math.min(1, dt * 14); } }
    else for (const b of players) if (b.bot && b.alive) { botThink(b, dt); moveBot(b, dt); }
    for (const b of [...bombs]) { b.t -= dt; if (b.t <= 0 && bombs.includes(b)) explode(b); }
    // ambil power-up (masing-masing HP cuma ngurus pemainnya sendiri; bot diurus HP sendiri juga)
    for (const pl of duel ? [m] : players) {
      if (!pl.alive) continue;
      const [x, y] = cellOf(pl), pu = powers.find((q) => q.x === x && q.y === y);
      if (pu && !inFlame(x, y) && pl.alive) {
        powers = powers.filter((q) => q !== pu);
        if (pu.k === 'range') pl.range = Math.min(6, pl.range + 1); else if (pu.k === 'bomb') pl.max = Math.min(5, pl.max + 1); else pl.speed = Math.min(5, pl.speed + 0.45);
        if (pl === m) { api.sfx('good'); api.streak(true); }
        if (duel) duel.send('bpick', { x, y });
      }
    }
    // kena ledakan?
    for (const pl of duel ? [m] : players) {
      if (pl.alive && pl.inv <= 0 && inFlame(...cellOf(pl)) && pl.shield) { pl.shield = false; pl.inv = 1.2; if (pl === m) { api.sfx('gold'); api.say('🛡️ Perisaimu nahan ledakan!', 'happy'); } continue; }
      if (pl.alive && pl.inv <= 0 && inFlame(...cellOf(pl))) { pl.alive = false; api.sfx('bad'); if (pl === m) api.streak(false); if (duel) duel.send('bdead', { r: round }); }
    }
    if (duel && performance.now() - lastSent > 110) { lastSent = performance.now(); duel.send('bpos', { r: round, x: +m.x.toFixed(2), y: +m.y.toFixed(2), mx: m.max, rg: m.range }); }
    // selesai ronde?
    const alive = players.filter((q) => q.alive);
    const meAlive = m.alive, othersAlive = alive.filter((q) => q !== m).length;
    if (!meAlive || !othersAlive || time <= 0) {
      if (!meAlive && othersAlive) roundResult = 'lose';
      else if (meAlive && !othersAlive) roundResult = 'win';
      else roundResult = 'draw';
      state = 'over'; stateT = 0;
      api.sfx(roundResult === 'win' ? 'win' : roundResult === 'lose' ? 'lose' : 'pop');
    }
  }
  function nextRound() {
    if (!duel && !p.endless) { end(); return; }
    if (!duel && roundResult !== 'lose') {
      if (roundResult === 'win') wins++;
      level++;
      newRound(); api.sfx('go');
      api.say(roundResult === 'win' ? `Menang! 💣 Ronde ${wins + 1}, botnya makin pinter!` : 'Seri! Lanjut ronde berikutnya 😤', 'happy');
      return;
    }
    end();
  }

  // ---- Gambar ----
  const fx = makeFx();
  toonLoad('f', 'm');
  const X = (x) => ox + x * T, Y = (y) => oy + y * T;
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  // Gerak & arah tiap pemain (buat animasi jalan), dihitung dari perpindahan posisinya
  function animate(dt) {
    for (const pl of players) {
      const dx = pl.x - (pl._px ?? pl.x), dy = pl.y - (pl._py ?? pl.y), d = Math.hypot(dx, dy);
      pl._px = pl.x; pl._py = pl.y;
      if (d > 0.002) { pl._walk = (pl._walk || 0) + d * 5.5; pl._still = 0; if (Math.abs(dx) > 0.004) pl._dir = dx > 0 ? 1 : -1; }
      else if ((pl._still = (pl._still || 0) + dt) > 0.08) pl._walk = 0;
    }
    fx.step(dt);
  }
  function stone(px, py) { // tembok batu 3D
    ctx.fillStyle = '#8a5a86'; rr(px + 1, py + 4, T - 2, T - 4, 6); ctx.fill();
    ctx.fillStyle = '#c48bbf'; rr(px + 1, py + 1, T - 2, T - 7, 6); ctx.fill();
    ctx.fillStyle = '#d9a6d4'; rr(px + 3, py + 3, T - 6, T * 0.3, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(110,60,105,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px + 3, py + T * 0.5); ctx.lineTo(px + T - 3, py + T * 0.5); ctx.moveTo(px + T * 0.5, py + 3); ctx.lineTo(px + T * 0.5, py + T * 0.5); ctx.moveTo(px + T * 0.28, py + T * 0.5); ctx.lineTo(px + T * 0.28, py + T - 7); ctx.moveTo(px + T * 0.72, py + T * 0.5); ctx.lineTo(px + T * 0.72, py + T - 7); ctx.stroke();
  }
  function crate(px, py, kind) { // peti kayu (peti spesial: warna & ikon beda)
    const sp = SPECIAL[kind];
    ctx.fillStyle = '#9a6335'; rr(px + 2, py + 5, T - 4, T - 6, 5); ctx.fill();
    ctx.fillStyle = '#e0a868'; rr(px + 2, py + 2, T - 4, T - 8, 5); ctx.fill();
    ctx.strokeStyle = '#b97c45'; ctx.lineWidth = Math.max(2, T * 0.08);
    rr(px + 5, py + 5, T - 10, T - 14, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + T - 6, py + T - 10); ctx.moveTo(px + T - 6, py + 6); ctx.lineTo(px + 6, py + T - 10); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(px + 5, py + 4, T - 10, 3, 2); ctx.fill();
    if (!sp) return;
    ctx.fillStyle = sp.c2; rr(px + 2, py + 5, T - 4, T - 6, 5); ctx.fill();
    ctx.fillStyle = sp.c1; rr(px + 2, py + 2, T - 4, T - 8, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(px + 5, py + 4, T - 10, 3, 2); ctx.fill();
    if (kind === 'T') { ctx.fillStyle = '#fff'; ctx.fillRect(px + 3, py + T * 0.36, T - 6, T * 0.2); ctx.fillStyle = '#c8352b'; ctx.font = `800 ${Math.round(T * 0.2)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TNT', px + T / 2, py + T * 0.465); }
    else drawEmoji(ctx, sp.em, px + T / 2, py + T * 0.44, T * 0.52);
    const tw = 0.5 + 0.5 * Math.sin(performance.now() / 300 + px); // kilau biar keliatan spesial
    ctx.fillStyle = `rgba(255,255,255,${0.25 * tw})`; rr(px + 2, py + 2, T - 4, T - 8, 5); ctx.fill();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save(); if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 18, (Math.random() - 0.5) * shake * 18);
    // taman di sekeliling arena
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#bfeaa6'); bg.addColorStop(1, '#9bd985');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(40,90,40,.22)'; rr(X(0) - 5, Y(0) - 3, T * COLS + 10, T * ROWS + 12, 14); ctx.fill();
    ctx.fillStyle = '#7b4f78'; rr(X(0) - 5, Y(0) - 5, T * COLS + 10, T * ROWS + 10, 14); ctx.fill();
    const now = performance.now() / 1000;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const g = grid[y][x], px = X(x), py = Y(y);
      if (g === 'W') { stone(px, py); continue; }
      ctx.fillStyle = (x + y) % 2 ? '#d3f0c4' : '#c5eab4'; ctx.fillRect(px, py, T, T);
      if (y > 0 && grid[y - 1][x] !== '.') { ctx.fillStyle = 'rgba(40,80,40,.16)'; ctx.fillRect(px, py, T, T * 0.16); } // bayangan tembok di atasnya
      if (isCrate(g)) crate(px, py, g);
    }
    for (const q of powers) if (grid[q.y][q.x] === '.') {
      const cx = X(q.x) + T / 2, cy = Y(q.y) + T / 2, bob = Math.sin(now * 5 + q.x) * 2;
      const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, T * 0.6); gl.addColorStop(0, 'rgba(255,240,150,.95)'); gl.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, T * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ffc93d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy + bob, T * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawEmoji(ctx, POWER[q.k], cx, cy + bob, T * 0.5);
    }
    for (const b of bombs) {
      const cx = X(b.x) + T / 2, cy = Y(b.y) + T / 2, hot = b.t < 0.8, pulse = 1 + Math.sin((FUSE - b.t) * (hot ? 30 : 10)) * (hot ? 0.13 : 0.07);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.34, T * 0.32 * pulse, T * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      if (hot) { ctx.fillStyle = 'rgba(255,80,60,.28)'; ctx.beginPath(); ctx.arc(cx, cy, T * 0.55 * pulse, 0, Math.PI * 2); ctx.fill(); }
      drawEmoji(ctx, '💣', cx, cy, T * 0.86 * pulse);
      if (Math.random() < 0.5) fx.burst(cx + T * 0.24, cy - T * 0.34, { n: 1, colors: ['#ffd166', '#ff8a3d', '#fff'], speed: 50, size: 2.2, gravity: 120, life: 0.3 });
    }
    if (rain.warn) { // tanda bom jatuh
      const cx = X(rain.warn.x) + T / 2, cy = Y(rain.warn.y) + T / 2, a = 0.5 + 0.5 * Math.sin(now * 20);
      ctx.strokeStyle = `rgba(255,60,60,${0.5 + a * 0.5})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, T * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - T * 0.25, cy); ctx.lineTo(cx + T * 0.25, cy); ctx.moveTo(cx, cy - T * 0.25); ctx.lineTo(cx, cy + T * 0.25); ctx.stroke();
      drawEmoji(ctx, '☄️', cx, cy - T * (0.6 + a * 0.3), T * 0.55);
    }
    // ledakan: inti putih-kuning + pinggir oranye, mengecil pas habis
    for (const f of flames) {
      const a = Math.min(1, f.life / FLAME), cx = X(f.x) + T / 2, cy = Y(f.y) + T / 2, r = T * (0.42 + 0.3 * a);
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,235,${a})`); g.addColorStop(0.4, `rgba(255,214,90,${a})`); g.addColorStop(0.75, `rgba(255,128,40,${a * 0.9})`); g.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = g; rr(X(f.x) - T * 0.12, Y(f.y) - T * 0.12, T * 1.24, T * 1.24, T * 0.3); ctx.fill();
      ctx.globalAlpha = a; drawEmoji(ctx, '🔥', cx, cy + Math.sin(now * 30 + f.x) * 1.5, T * 0.7 * (0.7 + a * 0.4)); ctx.globalAlpha = 1;
    }
    fx.draw(ctx);
    // pemain: badan kartun kecil yang jalan + muka
    for (const pl of [...players].sort((a, b) => a.y - b.y)) {
      const x = X(pl.x), y = Y(pl.y), r = T * 0.42;
      if (!pl.alive) { ctx.globalAlpha = 0.5; drawEmoji(ctx, '😵', x, y, T * 0.8); ctx.globalAlpha = 1; continue; }
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.8, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      if (pl.inv > 0 && Math.floor(now * 12) % 2) ctx.globalAlpha = 0.45;
      drawToon(ctx, pl.toon || 'f', pl._walk ? `walk${Math.floor(pl._walk) % 8}` : 'idle', x, y + r * 1.02, T * 1.5, pl._dir || 1, pl.img, pl.emoji, pl.ring);
      ctx.globalAlpha = 1;
      if (pl.shield) { ctx.strokeStyle = `rgba(150,120,255,${0.6 + 0.3 * Math.sin(now * 6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - r * 0.2, T * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(180,160,255,.18)'; ctx.fill(); }
      if (pl.frozen > 0) { ctx.fillStyle = 'rgba(160,220,255,.45)'; rr(x - T * 0.5, y - T * 0.95, T, T * 1.4, T * 0.25); ctx.fill(); drawEmoji(ctx, '❄️', x, y - T * 1.15, T * 0.5); }
      if (pl === me() && state !== 'over') { ctx.fillStyle = '#ff5c93'; ctx.beginPath(); const ay = y - T * 1.12 + Math.sin(now * 6) * 2; ctx.moveTo(x - 6, ay - 7); ctx.lineTo(x + 6, ay - 7); ctx.lineTo(x, ay + 2); ctx.fill(); }
    }
    ctx.restore();
    // HUD atas
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '700 14px Fredoka, sans-serif'; ctx.fillStyle = '#5a2a52';
    const m = me();
    drawEmoji(ctx, '💣', 18, 18, 18); ctx.fillText(`${m.max}`, 30, 19);
    drawEmoji(ctx, '💥', 56, 18, 18); ctx.fillText(`${m.range}`, 68, 19);
    drawEmoji(ctx, '👟', 94, 18, 18); ctx.fillText(`${Math.round((m.speed - 3.2) / 0.45) + 1}`, 106, 19);
    ctx.textAlign = 'right'; ctx.font = '700 20px Fredoka, sans-serif'; ctx.fillStyle = '#c2306f'; ctx.fillText(Math.ceil(time), W - 12, 19);
    const banner = (t) => { ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(Math.min(40, W / 10))}px Fredoka, sans-serif`; ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#e8558f'; ctx.strokeText(t, W / 2, H * 0.45); ctx.fillText(t, W / 2, H * 0.45); };
    if (state === 'intro') banner(duel ? 'Siap… Bom! 💣' : `Ronde ${wins + 1}`);
    if (state === 'over') banner(roundResult === 'win' ? 'Menang! 🏆' : roundResult === 'lose' ? 'Kena bom 😵' : 'Seri!');
    const s = duel ? `💣 ${me().name} vs ${opp().name}` : p.endless ? `💣 Menang ${wins} · 🏆 ${Math.max(p.best || 0, wins)}` : `💣 Lawan tersisa ${players.filter((q) => q.bot && q.alive).length}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    animate(dt);
    if (!done) update(dt);
    draw();
  }
  newRound();
  if (window.__lqTest) window.__bomb = { get players() { return players; }, get bombs() { return bombs; }, get grid() { return grid; }, get state() { return state; } };
  raf = requestAnimationFrame(loop);
  api.say('Taruh 💣 terus kabur! Peti spesial: 🧨 ledakin 1 baris · ❄️ bekuin lawan · 🛡️ perisai · 🎁 power-up', 'happy');

  function end() {
    if (done) return;
    done = true;
    if (!duel && !p.endless) { const win = roundResult === 'win'; api.finish({ win, stars: win ? (time > 70 ? 3 : time > 35 ? 2 : 1) : 0, detail: win ? `Semua lawan kena bom! Sisa waktu ${Math.ceil(time)} dtk 💣` : roundResult === 'draw' ? 'Waktunya habis, coba lebih cepet!' : 'Kena bom duluan 😵 coba lagi!' }); return; }
    if (!duel) { api.finish({ win: true, score: wins, detail: `Menang ${wins} ronde 💣` }); return; }
    api.finish({ win: roundResult === 'win', draw: roundResult === 'draw', result: roundResult });
  }

  return {
    destroy() {
      done = true; cancelAnimationFrame(raf); offs.forEach((f) => f());
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('resize', resize);
    },
  };
}
