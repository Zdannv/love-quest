// Susun Kue: lapisan kue geser kiri-kanan, tap buat jatuhin. Bagian yang meleset kepotong.
// Pas banget (perfect) = lebarnya balik sedikit. Meleset total = nyawa berkurang.
import { setupCanvas, drawEmoji } from '../util.js';

const COLORS = ['#ffb3cf', '#ffe29a', '#b8e6ff', '#c9b8ff', '#b9f0d2', '#ffc8a8'];

export function startStack(stage, p, api) {
  const { canvas, ctx, size, dispose } = setupCanvas(stage);
  const layerH = () => 30 * size.k;
  const baseW = () => size.W * 0.62;

  let layers = [];   // { x, w, color } dari bawah ke atas (x = kiri)
  let moving = null; // { x, w, dir }
  let falling = [];  // potongan yang jatuh
  let floats = [];
  let lives = p.lives, perfects = 0, done = false, raf = 0, last = performance.now(), camera = 0, lastStats = '';

  function reset() {
    layers = [{ x: (size.W - baseW()) / 2, w: baseW(), color: '#fff3f8' }];
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
      floats.push({ text: 'Perfect! ✨', life: 1, level: placed() + 1 });
    } else {
      api.sfx('pop');
      // Potongan yang kelebihan jatuh
      if (moving.x < top.x) falling.push({ x: moving.x, y: 0, w: top.x - moving.x, vy: 0, color: moving.color, level: placed() + 1 });
      else falling.push({ x: right, y: 0, w: moving.x + moving.w - right, vy: 0, color: moving.color, level: placed() + 1 });
    }
    layers.push({ x, w, color: moving.color });
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
    for (const f of falling) { f.vy += 1400 * dt; f.y += f.vy * dt; }
    falling = falling.filter((f) => f.y < size.H + 200);
    for (const f of floats) f.life -= dt * 0.9;
    floats = floats.filter((f) => f.life > 0);
    // Kamera naik pelan-pelan biar tumpukan paling atas selalu kelihatan
    const want = Math.max(0, (layers.length + 2) * layerH() - size.H * 0.55);
    camera += (want - camera) * Math.min(1, dt * 5);
  }

  function yOf(level) { return size.H - 40 * size.k - (level + 1) * layerH() + camera; }

  function drawLayer(x, y, w, color, isTop) {
    const h = layerH();
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h - 3, 8); else ctx.rect(x, y, w, h - 3);
    ctx.fill();
    ctx.stroke();
    // krim di atas lapisan
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillRect(x + 4, y + 3, Math.max(0, w - 8), 5 * size.k);
    if (isTop && w > 30) {
      drawEmoji(ctx, '🍓', x + w / 2, y - 6 * size.k, 22 * size.k);
    }
  }

  function draw() {
    const { W, H, k } = size;
    ctx.clearRect(0, 0, W, H);
    // piring
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath();
    ctx.ellipse(W / 2, yOf(0) + layerH() + 6, baseW() * 0.62, 12 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    layers.forEach((l, i) => drawLayer(l.x, yOf(i), l.w, l.color, i === layers.length - 1 && !moving));
    if (moving) drawLayer(moving.x, yOf(layers.length), moving.w, moving.color, true);
    for (const f of falling) drawLayer(f.x, yOf(f.level) + f.y, f.w, f.color, false);
    ctx.font = `700 ${Math.round(22 * k)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fff';
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      const y = yOf(f.level) - 20 - (1 - f.life) * 30;
      ctx.strokeText(f.text, W / 2, y);
      ctx.fillStyle = '#e0a000';
      ctx.fillText(f.text, W / 2, y);
    }
    ctx.globalAlpha = 1;
    const s = `🎂 ${placed()}/${p.target} · ✨ ${perfects} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}`;
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
    api.finish({ win, stars, detail: win ? `Kue ${p.target} tingkat jadi! (${perfects} perfect)` : `Kuenya jadi ${placed()} tingkat` });
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
