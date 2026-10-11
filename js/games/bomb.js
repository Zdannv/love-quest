// Bom Cinta ala Bomberman. Joystick buat jalan, 💣 taruh bom. Ledakan bentuk tanda tambah, bisa berantai,
// ngancurin peti. Dari peti bisa keluar 💥 (ledakan makin jauh), 💣 (bom makin banyak), 👟 (lari makin cepat).
// Sendiri (p.endless): lawan 3 bot, tiap ronde botnya makin pinter. Skor = ronde yang dimenangin.
// Berdua (p.duel): duel. Tiap HP ngatur pemainnya sendiri & mutusin sendiri kalau dia kena ledakan.
// Peti & power-up diacak pakai seed yang sama, jadi isi arenanya sama di dua HP.
import { drawEmoji, drawFace, loadImage } from '../util.js';

const COLS = 11, ROWS = 13, FUSE = 2.5, FLAME = 0.55, ROUND = 120;
const CORNERS = [[1, 11], [9, 1], [9, 11], [1, 1]];
const hash = (a, b, c) => { let n = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const POWER = { range: '💥', bomb: '💣', speed: '👟' };

export function startBomb(stage, p, api) {
  const wrap = document.createElement('div'); wrap.className = 'fight-wrap'; stage.appendChild(wrap);
  const view = document.createElement('div'); view.className = 'fight-view'; wrap.appendChild(view);
  const canvas = document.createElement('canvas'); canvas.className = 'catch-canvas'; view.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const pad = document.createElement('div'); pad.className = 'fight-pad pw-pad';
  pad.innerHTML = `<div class="pw-stick"><span></span></div><div class="fp-act"><button data-k="bomb" data-label="Taruh bom" class="bm-btn" aria-label="Taruh bom">💣</button></div>`;
  wrap.appendChild(pad);
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
        row.push(wall ? 'W' : !nearSpawn && hash(seed, x, y) < 0.62 ? 'B' : '.');
      }
      grid.push(row);
    }
    const mk = (i, look) => ({ x: CORNERS[i][0] + 0.5, y: CORNERS[i][1] + 0.5, alive: true, max: 1, range: 1, speed: 3.2, ...look, ai: { path: [], t: 0 } });
    if (duel) {
      const A = { img: loadImage(p.face), emoji: p.emoji || '😊', name: p.name || 'Kamu', ring: '#ff8fb7' };
      const B = { img: loadImage(p.oppFace), emoji: p.oppEmoji || '😈', name: p.oppName || 'Lawan', ring: '#9fb4ff' };
      players = myIdx === 0 ? [mk(0, A), mk(1, B)] : [mk(0, B), mk(1, A)];
    } else {
      players = [mk(0, { img: loadImage(p.face), emoji: p.emoji || '😊', name: p.name || 'Kamu', ring: '#ff8fb7' })];
      const bots = [['🤖', 'Robot'], ['🦊', 'Rubah'], ['🐻', 'Beruang']];
      for (let i = 1; i <= (p.bots || 3); i++) players.push(mk(i, { img: null, emoji: bots[i - 1][0], name: bots[i - 1][1], ring: '#c9b6ff', bot: true }));
    }
    bombs = []; flames = []; powers = []; time = ROUND; state = 'intro'; stateT = 0; roundResult = null;
  }
  const me = () => players[myIdx];
  const cellOf = (pl) => [Math.floor(pl.x), Math.floor(pl.y)];
  const bombAt = (x, y) => bombs.find((b) => b.x === x && b.y === y);
  const solid = (x, y) => grid[y]?.[x] !== '.' ;

  // ---- Bom & ledakan ----
  function place(pl, send = true) {
    if (state !== 'fight' || !pl.alive) return;
    const [x, y] = cellOf(pl);
    if (bombAt(x, y) || bombs.filter((b) => b.owner === pl).length >= pl.max) return;
    bombs.push({ x, y, t: FUSE, range: pl.range, owner: pl, pass: new Set(players.filter((q) => q.alive && cellOf(q)[0] === x && cellOf(q)[1] === y)) });
    api.sfx('click');
    if (duel && send) duel.send('bput', { x, y, r: pl.range });
  }
  function explode(b) {
    bombs = bombs.filter((q) => q !== b);
    const cells = [[b.x, b.y]], fresh = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 1; i <= b.range; i++) {
        const x = b.x + dx * i, y = b.y + dy * i, g = grid[y][x];
        if (g === 'W') break;
        cells.push([x, y]);
        if (g === 'B') {
          grid[y][x] = '.';
          const h = hash(seedBase + round * 7, x, y);
          if (h < 0.33) fresh.push({ x, y, k: h < 0.12 ? 'range' : h < 0.23 ? 'bomb' : 'speed' });
          break;
        }
        const other = bombAt(x, y); if (other) other.t = Math.min(other.t, 0.06);
      }
    }
    // power-up lama yang kena ledakan hangus; yang baru keluar dari peti aman
    powers = powers.filter((q) => !cells.some(([x, y]) => q.x === x && q.y === y)).concat(fresh);
    for (const [x, y] of cells) flames.push({ x, y, life: FLAME });
    api.sfx('bad');
  }
  const inFlame = (x, y) => flames.some((f) => f.x === x && f.y === y);

  // ---- Bahaya (buat bot): sel yang bakal kena ledakan ----
  function dangerMap(extra) {
    const d = new Set(flames.map((f) => `${f.x},${f.y}`));
    for (const b of [...bombs, ...(extra ? [extra] : [])]) {
      d.add(`${b.x},${b.y}`);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 1; i <= b.range; i++) {
        const x = b.x + dx * i, y = b.y + dy * i; if (grid[y][x] === 'W') break; d.add(`${x},${y}`); if (grid[y][x] === 'B') break;
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
    const nearBlock = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy][x + dx] === 'B');
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
      : bfs(x, y, (cx, cy) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[cy + dy]?.[cx + dx] === 'B'), danger);
    const pu = bfs(x, y, (cx, cy) => powers.some((q) => q.x === cx && q.y === cy), danger);
    const path = pu && pu.length < 6 ? pu : goTo;
    if (path) b.ai.path = path.slice(0, 3);
  }

  // ---- Gerak (nempel ke lorong, ada bantuan belok) ----
  function canEnter(pl, x, y) { if (solid(x, y)) return false; const b = bombAt(x, y); return !b || b.pass.has(pl); }
  function move(pl, mx, my, dt) {
    if (!pl.alive) return;
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
    stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`;
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
      if (pl.alive && inFlame(...cellOf(pl))) { pl.alive = false; api.sfx('bad'); if (pl === m) api.streak(false); if (duel) duel.send('bdead', { r: round }); }
    }
    if (duel && performance.now() - lastSent > 66) { lastSent = performance.now(); duel.send('bpos', { r: round, x: +m.x.toFixed(2), y: +m.y.toFixed(2), mx: m.max, rg: m.range }); }
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
  const X = (x) => ox + x * T, Y = (y) => oy + y * T;
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e9f7e4'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const g = grid[y][x], px = X(x), py = Y(y);
      if (g === 'W') {
        ctx.fillStyle = '#c66b97'; rr(px + 1, py + 3, T - 2, T - 3, 7); ctx.fill();
        ctx.fillStyle = '#ef9cc1'; rr(px + 1, py + 1, T - 2, T - 5, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(px + 4, py + 4, T * 0.4, T * 0.18, 4); ctx.fill();
      } else {
        ctx.fillStyle = (x + y) % 2 ? '#d8f2cf' : '#cdeec2'; ctx.fillRect(px, py, T, T);
        if (g === 'B') { ctx.fillStyle = '#c99263'; rr(px + 2, py + 4, T - 4, T - 5, 6); ctx.fill(); ctx.fillStyle = '#e8b27d'; rr(px + 2, py + 2, T - 4, T - 7, 6); ctx.fill(); drawEmoji(ctx, '📦', px + T / 2, py + T / 2 - 1, T * 0.7); }
      }
    }
    for (const q of powers) if (grid[q.y][q.x] === '.') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(X(q.x) + T / 2, Y(q.y) + T / 2, T * 0.38, 0, Math.PI * 2); ctx.fill(); drawEmoji(ctx, POWER[q.k], X(q.x) + T / 2, Y(q.y) + T / 2 + Math.sin(performance.now() / 200) * 1.5, T * 0.6); }
    for (const b of bombs) { const pulse = 1 + Math.sin((FUSE - b.t) * (b.t < 0.8 ? 30 : 10)) * 0.08; drawEmoji(ctx, '💣', X(b.x) + T / 2, Y(b.y) + T / 2, T * 0.85 * pulse); }
    for (const f of flames) { ctx.globalAlpha = Math.min(1, f.life * 3); ctx.fillStyle = 'rgba(255,170,60,.55)'; rr(X(f.x) + 2, Y(f.y) + 2, T - 4, T - 4, 8); ctx.fill(); drawEmoji(ctx, '🔥', X(f.x) + T / 2, Y(f.y) + T / 2, T * 0.9); ctx.globalAlpha = 1; }
    for (const pl of [...players].sort((a, b) => a.y - b.y)) {
      const x = X(pl.x), y = Y(pl.y), r = T * 0.42;
      if (!pl.alive) { ctx.globalAlpha = 0.45; drawEmoji(ctx, '😵', x, y, T * 0.8); ctx.globalAlpha = 1; continue; }
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.85, r * 0.85, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      if (pl.img) drawFace(ctx, pl.img, x, y - 2, r, pl.emoji, pl.ring); else drawEmoji(ctx, pl.emoji, x, y - 2, r * 2.1);
    }
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
    if (!done) update(dt);
    draw();
  }
  newRound();
  if (window.__lqTest) window.__bomb = { get players() { return players; }, get bombs() { return bombs; }, get grid() { return grid; }, get state() { return state; } };
  raf = requestAnimationFrame(loop);
  api.say('Joystick buat jalan · 💣 taruh bom, terus kabur! Ledakin peti buat dapet power-up 💥💣👟', 'happy');

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
