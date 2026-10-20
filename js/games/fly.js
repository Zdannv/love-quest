// Terbang Tinggi: tap buat bikin karakter terbang, lewati tiang bunga dan ambil 💖.
// Dibuat santai: 3 nyawa, dan kalau nabrak owl cuma kedip lalu lanjut terbang.
// Mode balapan online (p.race): tiang pakai angka acak yang sama (p.rng), karakter lawan ikut kelihatan.
import { rand, drawEmoji, drawFace, loadImage } from '../util.js';
import { drawSky, drawGround, makeFx, outlined, roundRect } from '../scene.js';

export function startFly(stage, p, api) {
  const face = loadImage(p.face);
  const rng = p.rng || Math.random;
  const rnd = (a, b) => a + rng() * (b - a);
  const race = p.race || null;
  const ghostFace = race ? loadImage(race.face) : null;
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
  const fx = makeFx();
  const floorY = () => H - 44 * k; // batas tanah
  let scroll = 0, flapT = 1, clock = 0;
  let passed = 0, lives = p.lives, hurtT = 0, spawnX = 0, collected = 0, lastStats = '';
  const pillarW = 62 * k;

  function flap() {
    if (done) return;
    if (!started) { started = true; api.say('Terbang terus {pasangan}! {karakter}', 'happy'); }
    owl.vy = -390 * k;
    flapT = 0;
    fx.puff(owl.x - owl.size * 0.4, owl.y + owl.size * 0.3, 'rgba(255,255,255,.9)', 7 * k);
    api.sfx('flip');
  }
  const onPointer = (e) => { e.preventDefault(); flap(); };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } };
  canvas.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', resize);

  // Mode skor & balapan berdua: makin lama makin susah, pelan-pelan & ada batasnya (celah maks -55, cepat maks +110)
  const ramp = Boolean(p.endless || p.race);
  function addPillar(x) {
    const gap = (ramp ? Math.max(p.gap - 55, p.gap - passed * 1.3) : p.gap) * k;
    const margin = 60 * k;
    const gy = rnd(margin + gap / 2, floorY() - margin * 0.6 - gap / 2);
    pillars.push({ x, gy, gap, passed: false });
    if (rng() < 0.8) hearts.push({ x: x + pillarW / 2, y: gy + rnd(-gap / 4, gap / 4), got: false });
  }

  function addFloat(x, y, text, color) { floats.push({ x, y, text, color, life: 1 }); }

  function hit() {
    if (hurtT > 0) return;
    lives--;
    hurtT = 1.4;
    owl.vy = -200 * k;
    fx.burst(owl.x, owl.y, { n: 14, colors: ['#ff4d6d', '#ffd166', '#fff'] });
    api.sfx('bad');
    api.streak(false);
    api.say('Aduh nabrak 😵 hati-hati {pasangan}!', 'sad');
    addFloat(owl.x, owl.y - 30, 'Aduh!', '#ff4d6d');
    if (lives <= 0) end(false);
  }

  function update(dt) {
    hurtT = Math.max(0, hurtT - dt);
    clock += dt; flapT += dt; fx.step(dt);
    for (const f of floats) { f.y -= 40 * dt; f.life -= dt * 1.2; }
    floats = floats.filter((f) => f.life > 0);
    if (!started) { owl.y = H * 0.45 + Math.sin(performance.now() / 300) * 8; return; }

    owl.vy += 1250 * k * dt;
    owl.y += owl.vy * dt;
    if (owl.y < owl.size / 2) { owl.y = owl.size / 2; owl.vy = 0; }
    if (owl.y > floorY() - owl.size / 2) { owl.y = floorY() - owl.size / 2; owl.vy = -330 * k; hit(); }

    const speed = (ramp ? Math.min(p.speed + 110, p.speed + passed * 2.3) : p.speed) * k;
    scroll += speed * dt;
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
        else if (ramp && passed % 10 === 0 && passed <= 40) api.say(passed >= 40 ? `${passed} tiang! Ini udah kecepatan maksimal 🔥` : `${passed} tiang! Makin cepet & celahnya makin sempit 😬`, 'happy');
      }
    }
    for (const h of hearts) {
      h.x -= speed * dt;
      if (!h.got && Math.hypot(h.x - owl.x, h.y - owl.y) < r + 16 * k) {
        h.got = true;
        collected++;
        api.sfx('good');
        fx.burst(h.x, h.y, { n: 10, colors: ['#ff5c93', '#ffb3cf', '#fff'], speed: 140 });
        addFloat(h.x, h.y - 20, '+💖', '#ff5c93');
      }
    }
    pillars = pillars.filter((pl) => pl.x > -pillarW - 10);
    hearts = hearts.filter((h) => !h.got && h.x > -30);
  }

  // Tiang permen: badan belang + topi lebih lebar di ujung celah
  function drawPillar(x, y, h, capAtBottom) {
    const g = ctx.createLinearGradient(x, 0, x + pillarW, 0);
    g.addColorStop(0, '#ff9cc4'); g.addColorStop(0.35, '#ffd0e3'); g.addColorStop(1, '#f06aa6');
    ctx.fillStyle = g; ctx.fillRect(x, y, pillarW, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, pillarW, h); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 9 * k;
    for (let yy = y - pillarW + ((capAtBottom ? y + h : y) % (34 * k)); yy < y + h + pillarW; yy += 34 * k) { ctx.beginPath(); ctx.moveTo(x - 4, yy + pillarW * 0.6); ctx.lineTo(x + pillarW + 4, yy); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#d9508f'; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, pillarW, h);
    const ch = 26 * k, cy = capAtBottom ? y + h - ch : y, cx = x - 7 * k, cw = pillarW + 14 * k;
    const cg = ctx.createLinearGradient(cx, 0, cx + cw, 0);
    cg.addColorStop(0, '#ff7fb3'); cg.addColorStop(0.3, '#ffc2dc'); cg.addColorStop(1, '#e8558f');
    ctx.fillStyle = cg; roundRect(ctx, cx, cy, cw, ch, 9 * k); ctx.fill(); ctx.stroke();
    drawEmoji(ctx, '🌸', x + pillarW / 2, cy + ch / 2, 22 * k);
  }

  // Sayap kecil yang ngepak tiap tap
  function drawWings(size) {
    const a = flapT < 0.28 ? Math.sin((flapT / 0.28) * Math.PI) * 0.9 : Math.sin(clock * 9) * 0.12;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.scale(side, 1); ctx.translate(-size * 0.42, 0); ctx.rotate(-0.5 + a);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ffb3cf'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-size * 0.3, -size * 0.06, size * 0.36, size * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-size * 0.22, size * 0.12, size * 0.24, size * 0.13, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawSky(ctx, W, H, floorY(), scroll, clock, 'day', k);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const pl of pillars) {
      drawPillar(pl.x, -20, pl.gy - pl.gap / 2 + 20, true);
      drawPillar(pl.x, pl.gy + pl.gap / 2, floorY() - (pl.gy + pl.gap / 2) + 4, false);
    }
    drawGround(ctx, W, H, floorY(), scroll, 'day', k);
    for (const h of hearts) drawEmoji(ctx, '💖', h.x, h.y + Math.sin((h.x + performance.now() / 5) / 30) * 4, 26 * k);

    if (race) {
      // Lawan: posisi tingginya dikirim lewat online, digambar agak transparan di sebelah kita
      const g = race.ghost();
      if (g) {
        const gx = owl.x + 34 * k;
        ctx.save();
        ctx.globalAlpha = g.alive ? 0.55 : 0.25;
        ctx.translate(gx, g.y * H);
        if (ghostFace) drawFace(ctx, ghostFace, 0, 0, owl.size * 0.42, race.emoji || '🐱');
        else drawEmoji(ctx, race.emoji || '🐱', 0, 0, owl.size * 0.85);
        ctx.globalAlpha = g.alive ? 0.9 : 0.4;
        ctx.font = `600 ${Math.round(12 * k)}px Fredoka, sans-serif`;
        ctx.fillStyle = '#6a2c52';
        ctx.fillText(race.name, 0, -owl.size * 0.62);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(owl.x, owl.y);
    ctx.rotate(Math.max(-0.4, Math.min(0.6, owl.vy / (900 * k))));
    if (hurtT > 0 && Math.floor(hurtT * 12) % 2) ctx.globalAlpha = 0.35;
    drawWings(owl.size);
    if (face) drawFace(ctx, face, 0, 0, owl.size * 0.5, p.flyer || '🦉');
    else drawEmoji(ctx, p.flyer || '🦉', 0, 0, owl.size);
    ctx.restore();
    fx.draw(ctx);

    if (!started) {
      outlined(ctx, 'Tap buat terbang! 👆', W / 2, H * 0.66 + Math.sin(clock * 4) * 4, 23 * k);
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

    const hearts3 = `${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}`;
    const s = race?.coopTarget
      ? `🌸 Berdua ${passed + (race.ghost()?.passed ?? 0)}/${race.coopTarget} · ${hearts3}`
      : race
      ? `🌸 Kamu ${passed} · ${race.name} ${race.ghost()?.passed ?? 0} · ${hearts3}`
      : p.endless
      ? `🌸 Skor ${passed} · 🏆 ${Math.max(p.best || 0, passed)} · ${hearts3}`
      : `🌸 ${passed}/${p.target} · 💖 ${collected} · ${hearts3}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (!done) update(dt);
    race?.tick({ y: owl.y / H, passed, alive: !done });
    draw();
  }
  raf = requestAnimationFrame(loop);

  function end(win) {
    if (done) return;
    done = true;
    const stars = win ? Math.max(1, lives) : 0;
    if (p.endless) { api.finish({ win: true, score: passed, detail: `Lewat ${passed} tiang, dapet ${collected} 💖` }); return; }
    if (race) { race.tick({ y: owl.y / H, passed, alive: false }, true); api.finish({ win, passed, collected }); return; }
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
