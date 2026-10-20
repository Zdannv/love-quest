// Susun Kue: lapisan kue geser kiri-kanan, tap buat jatuhin. Bagian yang meleset kepotong.
// Pas banget (perfect) = lebarnya balik sedikit. Meleset total = nyawa berkurang.
import { setupCanvas, drawEmoji } from '../util.js';
import { makeFx, outlined, roundRect } from '../scene.js';

// tiap lapis: [bolu, sisi gelap bolu, krim]
const COLORS = [['#ffc1d8', '#f59bbd', '#fff'], ['#ffe3a1', '#f2c56b', '#fff8e6'], ['#c4ebff', '#93cdf0', '#fff'], ['#d6c8ff', '#b09cf0', '#fff'], ['#c2f2d8', '#8fdcb4', '#fff'], ['#ffd2b5', '#f5ab82', '#fff6ee'], ['#b98a6a', '#93684c', '#ffe9d6']];
const SPRINK = ['#ff5c93', '#ffd166', '#6ec6ff', '#9be15d', '#c9a6ff'];
const hash = (n) => { const v = Math.sin(n * 91.7 + 13.3) * 43758.5453; return v - Math.floor(v); };

export function startStack(stage, p, api) {
  const { canvas, ctx, size, dispose } = setupCanvas(stage);
  const layerH = () => 36 * size.k;
  const fx = makeFx();
  let clock = 0, bump = 0;
  const baseW = () => size.W * 0.62;

  let layers = [];   // { x, w, color } dari bawah ke atas (x = kiri)
  let moving = null; // { x, w, dir }
  let falling = [];  // potongan yang jatuh
  let floats = [];
  let lives = p.lives, perfects = 0, done = false, raf = 0, last = performance.now(), camera = 0, lastStats = '';

  function reset() {
    layers = [{ x: (size.W - baseW()) / 2, w: baseW(), color: ['#fff3f8', '#f6d9e6', '#fff'] }];
    spawn();
  }
  function spawn() {
    const top = layers[layers.length - 1];
    const fromLeft = layers.length % 2 === 0;
    moving = { x: fromLeft ? -top.w : size.W, w: top.w, dir: fromLeft ? 1 : -1, color: COLORS[layers.length % COLORS.length] };
  }
  const placed = () => layers.length - 1;

  function drop() {
    if (done || !moving) return;
    const top = layers[layers.length - 1];
    const left = Math.max(moving.x, top.x);
    const right = Math.min(moving.x + moving.w, top.x + top.w);
    const overlap = right - left;
    if (overlap <= 0) {
      lives--;
      api.sfx('bad');
      api.streak(false);
      api.say('Yahh meleset 😵 hati-hati yaa', 'sad');
      falling.push({ x: moving.x, y: 0, w: moving.w, vy: 0, color: moving.color, level: placed() + 1 });
      if (lives <= 0) { end(false); return; }
      spawn();
      return;
    }
    const perfect = Math.abs(moving.x - top.x) < 6 * size.k;
    let x = left, w = overlap;
    if (perfect) {
      x = top.x;
      w = Math.min(baseW(), top.w + 6 * size.k);
      perfects++;
      api.sfx('gold');
      fx.burst(size.W / 2, yOf(placed() + 1) + layerH() / 2, { n: 26, colors: ['#ffd166', '#fff2a8', '#ff8fb7', '#fff'], speed: 260 });
      floats.push({ text: 'Perfect! ✨', life: 1, level: placed() + 1 });
    } else {
      api.sfx('pop');
      fx.burst(moving.x < top.x ? top.x : right, yOf(placed() + 1) + layerH() / 2, { n: 8, colors: [moving.color[0], '#fff'], speed: 120, size: 4 });
      // Potongan yang kelebihan jatuh
      if (moving.x < top.x) falling.push({ x: moving.x, y: 0, w: top.x - moving.x, vy: 0, color: moving.color, level: placed() + 1 });
      else falling.push({ x: right, y: 0, w: moving.x + moving.w - right, vy: 0, color: moving.color, level: placed() + 1 });
    }
    layers.push({ x, w, color: moving.color });
    bump = 1;
    api.streak(perfect);
    if (placed() >= p.target) { moving = null; end(true); return; }
    spawn();
  }

  const onTap = (e) => { e.preventDefault(); drop(); };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); drop(); } };
  canvas.addEventListener('pointerdown', onTap);
  window.addEventListener('keydown', onKey);

  function update(dt) {
    if (moving) {
      const speed = (p.speed + placed() * p.speedUp) * size.k;
      moving.x += moving.dir * speed * dt;
      if (moving.x + moving.w > size.W + 20) moving.dir = -1;
      if (moving.x < -20) moving.dir = 1;
    }
    clock += dt; bump = Math.max(0, bump - dt * 5); fx.step(dt);
    for (const f of falling) { f.vy += 1400 * dt; f.y += f.vy * dt; f.rot = (f.rot || 0) + dt * (f.x < size.W / 2 ? -2 : 2); }
    falling = falling.filter((f) => f.y < size.H + 200);
    for (const f of floats) f.life -= dt * 0.9;
    floats = floats.filter((f) => f.life > 0);
    // Kamera naik pelan-pelan biar tumpukan paling atas selalu kelihatan
    const want = Math.max(0, (layers.length + 2) * layerH() - size.H * 0.55);
    camera += (want - camera) * Math.min(1, dt * 5);
  }

  function yOf(level) { return size.H - 40 * size.k - (level + 1) * layerH() + camera; }

  function drawLayer(x, y, w, color, isTop, seed = 0) {
    const h = layerH(), k = size.k, [c1, c2, cream] = color, r = Math.min(9 * k, w / 2);
    // bolu: badan + sisi bawah lebih gelap + kilap
    ctx.fillStyle = c2; roundRect(ctx, x, y + 3 * k, w, h - 4 * k, r); ctx.fill();
    ctx.fillStyle = c1; roundRect(ctx, x, y + 3 * k, w, h * 0.62, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; roundRect(ctx, x + 5 * k, y + h * 0.42, Math.max(0, w - 10 * k), 3 * k, 2); ctx.fill();
    // krim di atas + lelehan
    ctx.fillStyle = cream;
    roundRect(ctx, x - 2 * k, y - 2 * k, w + 4 * k, 10 * k, 5 * k); ctx.fill();
    const n = Math.max(1, Math.floor(w / (22 * k)));
    for (let i = 0; i < n; i++) { const dx = x + (i + 0.5) * (w / n), dl = (6 + hash(seed * 7 + i) * 9) * k; roundRect(ctx, dx - 5 * k, y + 2 * k, 10 * k, dl + 5 * k, 5 * k); ctx.fill(); }
    // meses warna-warni
    for (let i = 0; i < Math.floor(w / (14 * k)); i++) { ctx.fillStyle = SPRINK[(i + seed) % SPRINK.length]; ctx.save(); ctx.translate(x + 8 * k + hash(seed * 3 + i) * Math.max(0, w - 16 * k), y + (1 + hash(seed + i * 5) * 4) * k); ctx.rotate(hash(i + seed) * 3); ctx.fillRect(-3 * k, -1 * k, 6 * k, 2 * k); ctx.restore(); }
    if (isTop && w > 30) drawEmoji(ctx, '🍓', x + w / 2, y - 10 * k, 24 * k);
  }

  // Dapur kue: tembok belang, bendera kecil, meja kayu
  function drawRoom() {
    const { W, H, k } = size;
    // latar luar ikut CSS layar game (#screen-game[data-game]), kanvasnya transparan
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    const sw = 44 * k, off = (camera * 0.25) % (sw * 2);
    for (let x = -sw; x < W + sw; x += sw * 2) ctx.fillRect(x, 0, sw, H);
    // titik-titik ikut naik pelan (kerasa kuenya makin tinggi)
    ctx.fillStyle = 'rgba(255,143,183,.16)';
    for (let i = 0; i < 26; i++) { const yy = ((hash(i) * (H + 80) + camera * (0.3 + hash(i + 4) * 0.3)) % (H + 80)) - 40; ctx.beginPath(); ctx.arc(hash(i + 9) * W, yy, (4 + hash(i + 2) * 7) * k, 0, Math.PI * 2); ctx.fill(); }
    // bendera
    const by = 26 * k - camera * 0.08;
    ctx.strokeStyle = '#e8a7c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, by); ctx.quadraticCurveTo(W / 2, by + 26 * k, W, by); ctx.stroke();
    for (let i = 0; i < 9; i++) { const u = (i + 0.5) / 9, fx0 = u * W, fy = by + 26 * k * 4 * u * (1 - u) * 0.5; ctx.fillStyle = SPRINK[i % SPRINK.length]; ctx.beginPath(); ctx.moveTo(fx0 - 11 * k, fy); ctx.lineTo(fx0 + 11 * k, fy); ctx.lineTo(fx0, fy + 20 * k); ctx.closePath(); ctx.fill(); }
    // meja kayu + tatakan kue
    const ty = yOf(0) + layerH() + 16 * k;
    if (ty < H + 10) {
      ctx.fillStyle = '#d9a777'; ctx.fillRect(0, ty, W, H - ty + 10);
      ctx.fillStyle = '#c48f5f'; ctx.fillRect(0, ty, W, 7 * k);
      ctx.strokeStyle = 'rgba(150,100,60,.25)'; ctx.lineWidth = 2;
      for (let x = 30 * k; x < W; x += 90 * k) { ctx.beginPath(); ctx.moveTo(x, ty + 16 * k); ctx.lineTo(x + 50 * k, ty + 16 * k); ctx.stroke(); }
    }
    const py = yOf(0) + layerH();
    ctx.fillStyle = 'rgba(80,40,30,.12)'; ctx.beginPath(); ctx.ellipse(W / 2, py + 17 * k, baseW() * 0.6, 9 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#f1c7d9'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(W / 2, py + 6 * k, baseW() * 0.64, 12 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    roundRect(ctx, W / 2 - 16 * k, py + 8 * k, 32 * k, 9 * k, 4 * k); ctx.fill();
  }

  function draw() {
    const { W, H, k } = size;
    ctx.clearRect(0, 0, W, H);
    drawRoom();
    layers.forEach((l, i) => {
      const top = i === layers.length - 1;
      const sq = top && bump > 0 ? Math.sin(bump * Math.PI) * 4 * k : 0; // lapis baru "mendarat" empuk
      drawLayer(l.x - sq / 2, yOf(i) + sq, l.w + sq, l.color, top && !moving, i);
    });
    if (moving) {
      // garis bantu: tepi lapisan paling atas, biar gampang ngepasin
      const top = layers[layers.length - 1], my = yOf(layers.length);
      ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(232,85,143,.35)'; ctx.lineWidth = 2;
      for (const gx of [top.x, top.x + top.w]) { ctx.beginPath(); ctx.moveTo(gx, my - 6 * k); ctx.lineTo(gx, my + layerH()); ctx.stroke(); }
      ctx.setLineDash([]);
      const near = Math.abs(moving.x - top.x) < 6 * k;
      if (near) { ctx.fillStyle = 'rgba(255,209,102,.35)'; roundRect(ctx, moving.x - 5 * k, my - 6 * k, moving.w + 10 * k, layerH() + 8 * k, 12 * k); ctx.fill(); }
      drawLayer(moving.x, my, moving.w, moving.color, false, layers.length);
    }
    for (const f of falling) { ctx.save(); ctx.translate(f.x + f.w / 2, yOf(f.level) + f.y + layerH() / 2); ctx.rotate(f.rot || 0); drawLayer(-f.w / 2, -layerH() / 2, f.w, f.color, false, f.level); ctx.restore(); }
    fx.draw(ctx);
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      outlined(ctx, f.text, W / 2, yOf(f.level) - 24 * k - (1 - f.life) * 30, 24 * k, '#e0a000');
    }
    ctx.globalAlpha = 1;
    if (placed() === 0 && moving) outlined(ctx, 'Tap pas kuenya sejajar! 👆', W / 2, H * 0.3 + Math.sin(clock * 4) * 4, 21 * k);
    const s = p.endless ? `🎂 Skor ${placed()} · 🏆 ${Math.max(p.best || 0, placed())} · ✨ ${perfects} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}` : `🎂 ${placed()}/${p.target} · ✨ ${perfects} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (!done) update(dt);
    draw();
  }

  function end(win) {
    if (done) return;
    done = true;
    const stars = !win ? 0 : Math.max(1, Math.min(3, lives + (perfects >= 3 ? 1 : 0) - (p.lives - 3)));
    if (p.endless) { api.finish({ win: true, score: placed(), detail: `Kuenya ${placed()} tingkat (${perfects} perfect)` }); return; }
    api.finish({ win, stars, score: placed(), detail: win ? `Kue ${p.target} tingkat jadi! (${perfects} perfect)` : `Kuenya jadi ${placed()} tingkat` });
  }

  reset();
  raf = requestAnimationFrame(loop);
  return {
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      dispose();
    },
  };
}
