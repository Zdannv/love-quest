// Lempar Hati: target (muka!) geser kiri-kanan di atas, tap buat lempar 💖 lurus ke atas.
// Kena target sejumlah `target` sebelum lemparan habis.
import { setupCanvas, drawEmoji, drawFace, loadImage, pick } from '../util.js';

const HIT_LINES = ['Kena! 😘', 'Tepat sasaran 💘', 'Aww kena hati 🥰', 'Mantap! 💖'];

export function startThrow(stage, p, api) {
  const { canvas, ctx, size, dispose } = setupCanvas(stage);
  const face = loadImage(p.face);
  const targetY = () => size.H * 0.24;
  const launchY = () => size.H - 70 * size.k;
  const R = () => 34 * size.k;

  const target = { x: 0, dir: 1, wobble: 0 };
  let hearts = [], floats = [], hits = 0, thrown = 0, done = false, raf = 0, last = performance.now(), lastStats = '', t = 0;
  target.x = size.W / 2;

  function throwHeart() {
    if (done || thrown >= p.throws) return;
    thrown++;
    hearts.push({ x: size.W / 2, y: launchY(), vy: -900 * size.k, resolved: false });
    api.sfx('flip');
  }
  const onTap = (e) => { e.preventDefault(); throwHeart(); };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); throwHeart(); } };
  canvas.addEventListener('pointerdown', onTap);
  window.addEventListener('keydown', onKey);

  function update(dt) {
    t += dt;
    const speed = (p.speed + hits * p.speedUp) * size.k;
    // Gerak kiri-kanan, kadang ganti arah mendadak biar seru
    target.x += target.dir * speed * dt;
    const margin = R() + 10;
    if (target.x > size.W - margin) { target.x = size.W - margin; target.dir = -1; }
    if (target.x < margin) { target.x = margin; target.dir = 1; }
    if (Math.random() < p.jitter * dt) target.dir *= -1;
    target.wobble = Math.max(0, target.wobble - dt * 3);

    for (const h of hearts) {
      h.y += h.vy * dt;
      if (!h.resolved && h.y <= targetY()) {
        h.resolved = true;
        if (Math.abs(h.x - target.x) < R() * 1.05) {
          h.gone = true;
          hits++;
          target.wobble = 1;
          api.sfx('good');
          api.streak(true);
          floats.push({ x: target.x, y: targetY() - R() - 10, text: pick(HIT_LINES), color: '#ff5c93', life: 1 });
          if (hits >= p.target) end(true);
        } else {
          api.sfx('pop');
          api.streak(false);
          floats.push({ x: h.x, y: targetY(), text: 'Meleset 🙈', color: '#a0678a', life: 1 });
        }
      }
    }
    hearts = hearts.filter((h) => !h.gone && h.y > -40);
    for (const f of floats) { f.y -= 35 * dt; f.life -= dt * 1.1; }
    floats = floats.filter((f) => f.life > 0);

    if (!done && thrown >= p.throws && hearts.length === 0 && hits < p.target) end(false);
  }

  function draw() {
    const { W, H, k } = size;
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // jalur target
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, targetY());
    ctx.lineTo(W - 20, targetY());
    ctx.stroke();
    ctx.setLineDash([]);

    const wob = Math.sin(target.wobble * 20) * target.wobble * 0.3;
    ctx.save();
    ctx.translate(target.x, targetY());
    ctx.rotate(wob);
    drawFace(ctx, face, 0, 0, R(), p.emoji || '😘', '#ffd1e3');
    ctx.restore();

    for (const h of hearts) drawEmoji(ctx, '💖', h.x, h.y, 30 * k);

    // pelontar
    const left = p.throws - thrown;
    if (left > 0) drawEmoji(ctx, '💘', W / 2, launchY(), 44 * k);
    ctx.font = `600 ${Math.round(15 * k)}px Fredoka, sans-serif`;
    ctx.fillStyle = '#a0678a';
    ctx.fillText(`sisa lemparan: ${left}`, W / 2, launchY() + 38 * k);

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
      ctx.font = `600 ${Math.round(20 * k)}px Fredoka, sans-serif`;
      ctx.strokeText('Tap buat lempar hati! 👆', W / 2, H * 0.55);
      ctx.fillStyle = '#e8558f';
      ctx.fillText('Tap buat lempar hati! 👆', W / 2, H * 0.55);
    }

    const s = `🎯 ${hits}/${p.target} · 💘 ${p.throws - thrown}`;
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
    const spare = p.throws - thrown;
    const stars = !win ? 0 : spare >= 3 ? 3 : spare >= 1 ? 2 : 1;
    api.finish({ win, stars, detail: win ? `Kena ${hits} kali, sisa ${spare} lemparan` : `Kena ${hits} dari ${p.target}` });
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
