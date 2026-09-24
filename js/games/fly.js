// Terbang Tinggi: tap buat bikin karakter terbang, lewati tiang bunga dan ambil 💖.
// Dibuat santai: 3 nyawa, dan kalau nabrak owl cuma kedip lalu lanjut terbang.
import { rand, drawEmoji, drawFace, loadImage } from '../util.js';

export function startFly(stage, p, api) {
  const face = loadImage(p.face);
  const canvas = document.createElement('canvas');
  canvas.className = 'catch-canvas';
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, k = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    k = Math.min(1.25, Math.max(0.8, H / 650));
  }
  resize();

  const owl = { x: W * 0.28, y: H * 0.45, vy: 0, size: 46 * k };
  let pillars = [], hearts = [], floats = [];
  let started = false, done = false, raf = 0, last = performance.now();
  let passed = 0, lives = p.lives, hurtT = 0, spawnX = 0, collected = 0, lastStats = '';
  const pillarW = 62 * k;

  function flap() {
    if (done) return;
    if (!started) { started = true; api.say('Terbang terus {pasangan}! {karakter}', 'happy'); }
    owl.vy = -390 * k;
    api.sfx('flip');
  }
  const onPointer = (e) => { e.preventDefault(); flap(); };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } };
  canvas.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', resize);

  function addPillar(x) {
    const gap = p.gap * k;
    const margin = 60 * k;
    const gy = rand(margin + gap / 2, H - margin - gap / 2);
    pillars.push({ x, gy, gap, passed: false });
    if (Math.random() < 0.8) hearts.push({ x: x + pillarW / 2, y: gy + rand(-gap / 4, gap / 4), got: false });
  }

  function addFloat(x, y, text, color) { floats.push({ x, y, text, color, life: 1 }); }

  function hit() {
    if (hurtT > 0) return;
    lives--;
    hurtT = 1.4;
    owl.vy = -200 * k;
    api.sfx('bad');
    api.streak(false);
    api.say('Aduh nabrak 😵 hati-hati {pasangan}!', 'sad');
    addFloat(owl.x, owl.y - 30, 'Aduh!', '#ff4d6d');
    if (lives <= 0) end(false);
  }

  function update(dt) {
    hurtT = Math.max(0, hurtT - dt);
    for (const f of floats) { f.y -= 40 * dt; f.life -= dt * 1.2; }
    floats = floats.filter((f) => f.life > 0);
    if (!started) { owl.y = H * 0.45 + Math.sin(performance.now() / 300) * 8; return; }

    owl.vy += 1250 * k * dt;
    owl.y += owl.vy * dt;
    if (owl.y < owl.size / 2) { owl.y = owl.size / 2; owl.vy = 0; }
    if (owl.y > H - owl.size / 2) { owl.y = H - owl.size / 2; owl.vy = -330 * k; hit(); }

    const speed = p.speed * k;
    spawnX -= speed * dt;
    if (spawnX <= 0) { addPillar(W + 10); spawnX = p.spacing * k; }

    const r = owl.size * 0.36;
    for (const pl of pillars) {
      pl.x -= speed * dt;
      const inX = owl.x + r > pl.x && owl.x - r < pl.x + pillarW;
      if (inX && (owl.y - r < pl.gy - pl.gap / 2 || owl.y + r > pl.gy + pl.gap / 2)) hit();
      if (!pl.passed && pl.x + pillarW < owl.x - r) {
        pl.passed = true;
        passed++;
        api.sfx('pop');
        api.streak(true);
        if (passed >= p.target && !done) end(true);
      }
    }
    for (const h of hearts) {
      h.x -= speed * dt;
      if (!h.got && Math.hypot(h.x - owl.x, h.y - owl.y) < r + 16 * k) {
        h.got = true;
        collected++;
        api.sfx('good');
        addFloat(h.x, h.y - 20, '+💖', '#ff5c93');
      }
    }
    pillars = pillars.filter((pl) => pl.x > -pillarW - 10);
    hearts = hearts.filter((h) => !h.got && h.x > -30);
  }

  function drawPillar(x, y, h, capAtBottom) {
    ctx.fillStyle = '#b8e986';
    ctx.strokeStyle = '#86c45a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, pillarW, h, 14);
    else ctx.rect(x, y, pillarW, h);
    ctx.fill();
    ctx.stroke();
    drawEmoji(ctx, '🌸', x + pillarW / 2, capAtBottom ? y + h - 16 * k : y + 16 * k, 26 * k);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const pl of pillars) {
      drawPillar(pl.x, -20, pl.gy - pl.gap / 2 + 20, true);
      drawPillar(pl.x, pl.gy + pl.gap / 2, H - (pl.gy + pl.gap / 2) + 20, false);
    }
    for (const h of hearts) drawEmoji(ctx, '💖', h.x, h.y + Math.sin((h.x + performance.now() / 5) / 30) * 4, 26 * k);

    ctx.save();
    ctx.translate(owl.x, owl.y);
    ctx.rotate(Math.max(-0.4, Math.min(0.6, owl.vy / (900 * k))));
    if (hurtT > 0 && Math.floor(hurtT * 12) % 2) ctx.globalAlpha = 0.35;
    if (face) drawFace(ctx, face, 0, 0, owl.size * 0.5, p.flyer || '🦉');
    else drawEmoji(ctx, p.flyer || '🦉', 0, 0, owl.size);
    ctx.restore();

    if (!started) {
      ctx.font = `600 ${Math.round(22 * k)}px Fredoka, sans-serif`;
      ctx.fillStyle = '#e8558f';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 5;
      ctx.strokeText('Tap buat terbang! 👆', W / 2, H * 0.7);
      ctx.fillText('Tap buat terbang! 👆', W / 2, H * 0.7);
    }

    ctx.font = `700 ${Math.round(22 * k)}px Fredoka, sans-serif`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fff';
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    const s = `🌸 ${passed}/${p.target} · 💖 ${collected} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (!done) update(dt);
    draw();
  }
  raf = requestAnimationFrame(loop);

  function end(win) {
    if (done) return;
    done = true;
    const stars = win ? Math.max(1, lives) : 0;
    api.finish({ win, stars, detail: win ? `Lewat ${passed} tiang, dapet ${collected} 💖` : `Lewat ${passed} dari ${p.target} tiang` });
  }

  return {
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
    },
  };
}
