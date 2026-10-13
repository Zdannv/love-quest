// Lari Lompat: karakter (atau muka!) lari terus, tap buat lompat lewati rintangan & ambil 💖.
// Bertahan sampai waktunya habis. Nabrak = kedip & nyawa berkurang (santai, nggak langsung kalah).
import { setupCanvas, drawEmoji, drawFace, loadImage, rand, pick } from '../util.js';
import { drawToon, toonLoad } from '../toon.js';
import { drawSky, drawGround, makeFx, outlined, shadow } from '../scene.js';

export function startRunner(stage, p, api) {
  const { canvas, ctx, size, dispose } = setupCanvas(stage);
  const face = loadImage(p.face);
  const groundY = () => size.H * 0.78;
  const R = () => 26 * size.k; // jari-jari pelari (buat hitung tabrakan)
  const toon = p.toon || 'f';
  toonLoad(toon);
  const fx = makeFx();
  let stepT = 0, landT = 1;

  const runner = { y: 0, vy: 0, onGround: true, jumps: 0 };
  let obstacles = [], hearts = [], floats = [], clouds = [];
  let t = 0, spawnIn = 1.2, heartIn = 0.8, lives = p.lives, hurtT = 0, collected = 0;
  let done = false, raf = 0, last = performance.now(), lastStats = '', warned = false, scroll = 0;

  for (let i = 0; i < 4; i++) clouds.push({ x: rand(0, size.W), y: rand(30, size.H * 0.4), s: rand(0.6, 1.1) });

  function jump() {
    if (done) return;
    // Boleh lompat dua kali (double jump) biar lebih gampang
    if (runner.onGround || runner.jumps < 2) {
      runner.vy = -620 * size.k;
      runner.onGround = false;
      runner.jumps++;
      fx.burst(rx(), groundY() + runner.y, { n: 6, colors: ['#fff', '#e9d8c4'], speed: 90, size: 4, gravity: 200, life: 0.4, up: 0.1 });
      api.sfx('flip');
    }
  }
  const onTap = (e) => { e.preventDefault(); jump(); };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); jump(); } };
  canvas.addEventListener('pointerdown', onTap);
  window.addEventListener('keydown', onKey);

  const speed = () => (p.speed + t * 4) * size.k;
  const rx = () => size.W * 0.22;

  function hit() {
    if (hurtT > 0) return;
    lives--;
    hurtT = 1.3;
    fx.burst(rx(), groundY() + runner.y - R(), { n: 14, colors: ['#ff4d6d', '#ffd166', '#fff'] });
    api.sfx('bad');
    api.streak(false);
    api.say('Aduh kesandung 😵', 'sad');
    floats.push({ x: rx(), y: groundY() + runner.y - 60, text: 'Aduh!', color: '#ff4d6d', life: 1 });
    if (lives <= 0) end(false);
  }

  function update(dt) {
    t += dt;
    const left = p.time - t;
    hurtT = Math.max(0, hurtT - dt);
    scroll += speed() * dt;

    runner.vy += 1800 * size.k * dt;
    runner.y += runner.vy * dt;
    if (runner.y >= 0) { if (!runner.onGround) { landT = 0; fx.burst(rx(), groundY(), { n: 5, colors: ['#fff', '#e9d8c4'], speed: 80, size: 4, gravity: 150, life: 0.35, up: 0.1 }); } runner.y = 0; runner.vy = 0; runner.onGround = true; runner.jumps = 0; }
    landT += dt; fx.step(dt);
    stepT += dt * speed() / (38 * size.k); // langkah kaki ngikutin kecepatan

    spawnIn -= dt;
    if (spawnIn <= 0) {
      const tall = Math.random() < 0.3;
      obstacles.push({ x: size.W + 30, em: pick(p.obstacles), size: (tall ? 46 : 34) * size.k, passed: false });
      spawnIn = rand(p.gapMin, p.gapMax) * (1 - (p.endless ? 0.35 * Math.min(1, t / 90) : 0.25 * Math.min(1, t / p.time)));
    }
    heartIn -= dt;
    if (heartIn <= 0) {
      hearts.push({ x: size.W + 30, y: groundY() - rand(70, 150) * size.k, got: false });
      heartIn = rand(0.9, 1.8);
    }

    const r = R();
    const ry = groundY() + runner.y - r;
    for (const o of obstacles) {
      o.x -= speed() * dt;
      const oy = groundY() - o.size / 2;
      if (Math.abs(o.x - rx()) < (o.size * 0.4 + r * 0.6) && Math.abs(oy - ry) < (o.size * 0.4 + r * 0.6)) hit();
      if (!o.passed && o.x < rx() - r) { o.passed = true; api.streak(true); }
    }
    for (const h of hearts) {
      h.x -= speed() * dt;
      if (!h.got && Math.hypot(h.x - rx(), h.y - ry) < r + 16 * size.k) {
        h.got = true;
        collected++;
        api.sfx('good');
        fx.burst(h.x, h.y, { n: 10, colors: ['#ff5c93', '#ffb3cf', '#fff'], speed: 140 });
        floats.push({ x: h.x, y: h.y - 20, text: '+💖', color: '#ff5c93', life: 1 });
      }
    }
    obstacles = obstacles.filter((o) => o.x > -60);
    hearts = hearts.filter((h) => !h.got && h.x > -40);
    for (const f of floats) { f.y -= 40 * dt; f.life -= dt * 1.2; }
    floats = floats.filter((f) => f.life > 0);
    for (const c of clouds) { c.x -= speed() * 0.15 * c.s * dt; if (c.x < -80) { c.x = size.W + 60; c.y = rand(30, size.H * 0.4); } }

    if (!warned && left <= 5) { warned = true; api.say('5 detik lagi! Gaspol! 🏃', 'happy'); }
    if (left <= 0) end(true);
  }

  function draw() {
    const { W, H, k } = size;
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawSky(ctx, W, H, groundY(), scroll, t, 'sunset', k);
    drawGround(ctx, W, H, groundY(), scroll, 'sunset', k);

    for (const h of hearts) { const hy = h.y + Math.sin(t * 4 + h.x / 40) * 4 * k; drawEmoji(ctx, '💖', h.x, hy, 28 * k); }
    for (const o of obstacles) { shadow(ctx, o.x, groundY() + 5 * k, o.size * 0.42); drawEmoji(ctx, o.em, o.x, groundY() - o.size / 2 + 3 * k, o.size); }

    // pelari: badan kartun (lari / lompat) + foto muka
    const hgt = 122 * k, squash = landT < 0.12 ? 1 - Math.sin((landT / 0.12) * Math.PI) * 0.08 : 1;
    shadow(ctx, rx(), groundY() + 5 * k, 26 * k * (runner.onGround ? 1 : Math.max(0.5, 1 + runner.y / (300 * k))));
    ctx.save();
    if (hurtT > 0 && Math.floor(hurtT * 12) % 2) ctx.globalAlpha = 0.35;
    const pose = runner.onGround ? `walk${Math.floor(stepT) % 8}` : 'jump';
    drawToon(ctx, toon, pose, rx(), groundY() + runner.y + 6 * k, hgt * squash, 1, face, p.emoji || '🐱', '#fff', runner.onGround ? 0.06 : Math.max(-0.2, Math.min(0.2, runner.vy / (4000 * k))));
    ctx.restore();
    fx.draw(ctx);

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

    if (t < 1.5 && !done) {
      outlined(ctx, 'Tap buat lompat! (bisa 2x) 👆', W / 2, H * 0.3, 21 * k);
    }

    const s = p.endless ? `🏃 ${Math.floor(t)} dtk · 🏆 ${Math.max(p.best || 0, Math.floor(t))} · 💖 ${collected} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}` : `⏱ ${Math.max(0, Math.ceil(p.time - t))}s · 💖 ${collected} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}`;
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
    const stars = win ? Math.max(1, lives - (p.lives - 3)) : 0;
    if (p.endless) { api.finish({ win: true, score: Math.floor(t), detail: `Bertahan ${Math.floor(t)} detik, dapet ${collected} 💖` }); return; }
    api.finish({ win, stars, detail: win ? `Berhasil lari ${p.time} detik, dapet ${collected} 💖` : 'Kebanyakan kesandung 🥺' });
  }

  return {
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      dispose();
    },
  };
}
