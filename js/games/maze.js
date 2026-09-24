// Labirin Cinta: tarik garis pakai jari dari muka/karakter pasangan (kiri atas) sampai ke pengirim (kanan bawah).
// Labirinnya acak tiap main. Salah jalan? Tarik garisnya mundur aja.
import { setupCanvas, drawFace, drawEmoji, loadImage } from '../util.js';

// Bikin labirin pakai "recursive backtracker": walls[r][c] = { n, e, s, w } (true = ada tembok)
function makeMaze(cols, rows) {
  const walls = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ n: true, e: true, s: true, w: true })));
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [[0, 0]];
  seen[0][0] = true;
  const dirs = [[0, -1, 'n', 's'], [1, 0, 'e', 'w'], [0, 1, 's', 'n'], [-1, 0, 'w', 'e']];
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const options = dirs.filter(([dc, dr]) => {
      const nc = c + dc, nr = r + dr;
      return nc >= 0 && nr >= 0 && nc < cols && nr < rows && !seen[nr][nc];
    });
    if (!options.length) { stack.pop(); continue; }
    const [dc, dr, side, opposite] = options[Math.floor(Math.random() * options.length)];
    walls[r][c][side] = false;
    walls[r + dr][c + dc][opposite] = false;
    seen[r + dr][c + dc] = true;
    stack.push([c + dc, r + dr]);
  }
  return walls;
}

export function startMaze(stage, p, api) {
  const { canvas, ctx, size, dispose } = setupCanvas(stage);
  const startFace = loadImage(p.startFace);
  const endFace = loadImage(p.endFace);
  const { cols, rows } = p;
  const walls = makeMaze(cols, rows);
  const goal = { c: cols - 1, r: rows - 1 };

  let path = [{ c: 0, r: 0 }];
  let dragging = false, done = false, won = false, raf = 0, t0 = performance.now(), timeLeft = p.time, lastStats = '', wonAt = 0;

  // Posisi & ukuran labirin di layar
  function layout() {
    const pad = 14;
    const labelSpace = 44; // ruang buat label MULAI (atas) & FINISH (bawah)
    const cell = Math.floor(Math.min((size.W - pad * 2) / cols, (size.H - pad * 2 - labelSpace * 2) / rows));
    const w = cell * cols, h = cell * rows;
    return { cell, x: (size.W - w) / 2, y: (size.H - h) / 2, w, h };
  }
  const center = (L, { c, r }) => ({ x: L.x + (c + 0.5) * L.cell, y: L.y + (r + 0.5) * L.cell });

  function open(a, b) {
    if (b.c === a.c + 1 && b.r === a.r) return !walls[a.r][a.c].e;
    if (b.c === a.c - 1 && b.r === a.r) return !walls[a.r][a.c].w;
    if (b.r === a.r + 1 && b.c === a.c) return !walls[a.r][a.c].s;
    if (b.r === a.r - 1 && b.c === a.c) return !walls[a.r][a.c].n;
    return false;
  }
  const neighbors = (a) => [{ c: a.c + 1, r: a.r }, { c: a.c - 1, r: a.r }, { c: a.c, r: a.r + 1 }, { c: a.c, r: a.r - 1 }]
    .filter((b) => b.c >= 0 && b.r >= 0 && b.c < cols && b.r < rows && open(a, b));
  const same = (a, b) => a.c === b.c && a.r === b.r;

  // Cari jalan pendek (maks 4 langkah) dari ujung garis ke sel yang disentuh, buat jari yang geraknya cepat
  function shortRoute(from, to) {
    const queue = [[from]];
    const seen = new Set([`${from.c},${from.r}`]);
    while (queue.length) {
      const route = queue.shift();
      const last = route[route.length - 1];
      if (same(last, to)) return route.slice(1);
      if (route.length > 4) continue;
      for (const n of neighbors(last)) {
        const key = `${n.c},${n.r}`;
        if (!seen.has(key)) { seen.add(key); queue.push([...route, n]); }
      }
    }
    return null;
  }

  function cellAt(e) {
    const L = layout();
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left - L.x) / L.cell);
    const r = Math.floor((e.clientY - rect.top - L.y) / L.cell);
    return c >= 0 && r >= 0 && c < cols && r < rows ? { c, r } : null;
  }

  function moveTo(cell) {
    if (!cell || done) return;
    const head = path[path.length - 1];
    if (same(cell, head)) return;
    // Mundur: kalau sel itu sudah ada di garis, potong garisnya sampai situ
    const idx = path.findIndex((p2) => same(p2, cell));
    if (idx >= 0) { path = path.slice(0, idx + 1); return; }
    const route = shortRoute(head, cell);
    if (!route) return;
    for (const step of route) {
      const back = path.findIndex((p2) => same(p2, step));
      if (back >= 0) path = path.slice(0, back + 1);
      else path.push(step);
    }
    if (route.length) api.sfx('pop');
    if (same(path[path.length - 1], goal)) win();
  }

  function onDown(e) {
    if (done) return;
    e.preventDefault();
    const cell = cellAt(e);
    // Mulai narik dari ujung garis (atau dari mana pun di garis buat mundur)
    if (cell && path.some((p2) => same(p2, cell))) {
      dragging = true;
      canvas.setPointerCapture?.(e.pointerId);
      moveTo(cell);
    }
  }
  function onMove(e) { if (dragging) moveTo(cellAt(e)); }
  function onUp() { dragging = false; }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  function win() {
    won = true;
    wonAt = performance.now();
    api.sfx('win');
    api.streak(true);
    api.say('Ketemu! 💞', 'happy');
    setTimeout(() => end(true), 1100);
  }

  function draw(now) {
    const { W, H } = size;
    const L = layout();
    ctx.clearRect(0, 0, W, H);

    // lantai labirin
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(L.x - 6, L.y - 6, L.w + 12, L.h + 12, 16); else ctx.rect(L.x - 6, L.y - 6, L.w + 12, L.h + 12);
    ctx.fill();

    // kotak awal (hijau) & tujuan (pink)
    ctx.fillStyle = 'rgba(143, 227, 200, .45)';
    ctx.fillRect(L.x, L.y, L.cell, L.cell);
    ctx.fillStyle = 'rgba(255, 126, 176, .28)';
    ctx.fillRect(L.x + goal.c * L.cell, L.y + goal.r * L.cell, L.cell, L.cell);

    // garis jalan
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 126, 176, .85)';
    ctx.lineWidth = L.cell * 0.34;
    ctx.beginPath();
    path.forEach((cell, i) => {
      const { x, y } = center(L, cell);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // tembok
    ctx.strokeStyle = '#b86b95';
    ctx.lineWidth = Math.max(3, L.cell * 0.1);
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = L.x + c * L.cell, y = L.y + r * L.cell, w = walls[r][c];
        const isStart = r === 0 && c === 0;
        const isGoal = r === goal.r && c === goal.c;
        if (w.n && !isStart) { ctx.moveTo(x, y); ctx.lineTo(x + L.cell, y); }
        if (w.w) { ctx.moveTo(x, y); ctx.lineTo(x, y + L.cell); }
        if (r === rows - 1 && w.s && !isGoal) { ctx.moveTo(x, y + L.cell); ctx.lineTo(x + L.cell, y + L.cell); }
        if (c === cols - 1 && w.e) { ctx.moveTo(x + L.cell, y); ctx.lineTo(x + L.cell, y + L.cell); }
      }
    }
    ctx.stroke();

    // tujuan (goyang pelan manggil-manggil)
    const g = center(L, goal);
    const r = L.cell * 0.42;
    const pulse = won ? 1.15 : 1 + Math.sin(now / 250) * 0.05;
    // Pas ketemu, dua muka geser jadi berdampingan
    const meet = won ? Math.min(1, (now - wonAt) / 300) * r * 0.75 : 0;
    drawFace(ctx, endFace, g.x, g.y, r * pulse, p.endEmoji || '🐱', '#ffd1e3');

    // yang jalan, di ujung garis
    const h = center(L, path[path.length - 1]);
    drawFace(ctx, startFace, h.x - meet * 2, h.y, r * (won ? 1.15 : 1), p.startEmoji || '🦉', '#fff');

    if (won) {
      const k = Math.min(1, (now - wonAt) / 400);
      ctx.globalAlpha = k;
      drawEmoji(ctx, '💞', g.x - meet, g.y - L.cell * 0.9, L.cell * (0.8 + k * 0.6));
      ctx.globalAlpha = 1;
    }

    // label MULAI & FINISH (FINISH goyang pelan biar kelihatan)
    const bounce = Math.sin(now / 220) * 3;
    pill(L.x + L.cell / 2, L.y - 20 + (path.length === 1 ? bounce : 0), 'MULAI 👇', '#1f9e72');
    pill(g.x, L.y + L.h + 20 + (won ? 0 : bounce), 'FINISH 🏁', '#e8558f');
  }

  function pill(x, y, text, color) {
    ctx.font = `700 ${Math.round(14 * size.k)}px Fredoka, sans-serif`;
    const w = ctx.measureText(text).width + 22;
    const h = 26 * size.k;
    // jaga supaya label nggak keluar layar
    const cx = Math.max(w / 2 + 6, Math.min(size.W - w / 2 - 6, x));
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - w / 2, y - h / 2, w, h, h / 2); else ctx.rect(cx - w / 2, y - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, y + 1);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!done && !won) {
      timeLeft = Math.max(0, p.time - (now - t0) / 1000);
      if (timeLeft <= 0) end(false);
    }
    const s = `⏱ ${Math.ceil(timeLeft)}s · 🧭 labirin ${cols}×${rows}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
    draw(now);
  }
  raf = requestAnimationFrame(loop);

  function end(ok) {
    if (done) return;
    done = true;
    const frac = timeLeft / p.time;
    const stars = !ok ? 0 : frac > 0.5 ? 3 : frac > 0.25 ? 2 : 1;
    api.finish({ win: ok, stars, detail: ok ? `${p.startName || 'Kamu'} ketemu ${p.endName || 'dia'}, sisa ${Math.ceil(timeLeft)} detik 💞` : 'Waktunya habis sebelum ketemu 🥺' });
  }

  return {
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
      dispose();
    },
  };
}
