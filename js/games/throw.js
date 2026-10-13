// Lempar Hati: target (muka!) geser kiri-kanan di atas, tap buat lempar 💖 lurus ke atas.
// Kena target sejumlah `target` sebelum lemparan habis.
import { setupCanvas, drawEmoji, drawFace, loadImage, pick } from '../util.js';
import { drawSky, drawGround, makeFx, outlined, shadow } from '../scene.js';

const HIT_LINES = ['Kena! 😘', 'Tepat sasaran 💘', 'Aww kena hati 🥰', 'Mantap! 💖'];

export function startThrow(stage, p, api) {
  const { canvas, ctx, size, dispose } = setupCanvas(stage);
  const face = loadImage(p.face);
  const targetY = () => size.H * 0.3;
  const launchY = () => size.H - 70 * size.k;
  const R = () => 34 * size.k;

  const target = { x: 0, dir: 1, wobble: 0 };
  let hearts = [], floats = [], hits = 0, thrown = 0, done = false, raf = 0, last = performance.now(), lastStats = '', t = 0;
  target.x = size.W / 2;
  const fx = makeFx();
  let recoil = 0;

  function throwHeart() {
    if (done || thrown >= p.throws) return;
    thrown++;
    hearts.push({ x: size.W / 2, y: launchY(), vy: -900 * size.k, resolved: false });
    recoil = 1;
    api.sfx('flip');
  }
  const onTap = (e) => { e.preventDefault(); throwHeart(); };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); throwHeart(); } };
  canvas.addEventListener('pointerdown', onTap);
  window.addEventListener('keydown', onKey);

  function update(dt) {
    t += dt; recoil = Math.max(0, recoil - dt * 5); fx.step(dt);
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
      if (Math.random() < 0.6) fx.puff(h.x + (Math.random() - 0.5) * 8, h.y + 14, 'rgba(255,170,205,.8)', 4 * size.k);
      if (!h.resolved && h.y <= targetY()) {
        h.resolved = true;
        if (Math.abs(h.x - target.x) < R() * 1.05) {
          h.gone = true;
          hits++;
          target.wobble = 1;
          fx.burst(target.x, targetY(), { n: 20, colors: ['#ff5c93', '#ffd3e4', '#ffd166', '#fff'], speed: 230 });
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

    const gy = H - 34 * k;
    drawSky(ctx, W, H, gy, target.x * 0.3, t, 'sunset', k);
    drawGround(ctx, W, H, gy, 0, 'sunset', k);

    // sasaran: muka digantung balon, melayang di kawat
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(14, targetY() - R() * 2.3); ctx.lineTo(W - 14, targetY() - R() * 2.3); ctx.stroke(); ctx.setLineDash([]);
    const wob = Math.sin(target.wobble * 20) * target.wobble * 0.3, sway = Math.sin(t * 2.4) * 0.06 - target.dir * 0.07;
    ctx.save();
    ctx.translate(target.x, targetY() - R() * 2.3);
    ctx.rotate(sway + wob);
    for (const [dx, em] of [[-0.55, '🎈'], [0.55, '🎈'], [0, '🎈']]) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(dx * R(), R() * 0.2); ctx.lineTo(0, R() * 1.5); ctx.stroke();
      drawEmoji(ctx, em, dx * R(), -R() * 0.25 + Math.abs(dx) * R() * 0.3, R() * 1.1);
    }
    ctx.fillStyle = 'rgba(255,143,183,.28)'; ctx.beginPath(); ctx.arc(0, R() * 2.3, R() * 1.35, 0, Math.PI * 2); ctx.fill();
    drawFace(ctx, face, 0, R() * 2.3, R(), p.emoji || '😘', '#fff');
    ctx.restore();

    fx.draw(ctx);
    for (const h of hearts) drawEmoji(ctx, '💖', h.x, h.y, 32 * k);

    // ketapel
    const left = p.throws - thrown, ly = launchY() - recoil * 10 * k;
    shadow(ctx, W / 2, gy + 4 * k, 34 * k);
    ctx.strokeStyle = '#a8703f'; ctx.lineWidth = 9 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(W / 2, gy); ctx.lineTo(W / 2, ly + 22 * k); ctx.moveTo(W / 2, ly + 22 * k); ctx.lineTo(W / 2 - 26 * k, ly - 16 * k); ctx.moveTo(W / 2, ly + 22 * k); ctx.lineTo(W / 2 + 26 * k, ly - 16 * k); ctx.stroke();
    ctx.strokeStyle = '#ff8fb7'; ctx.lineWidth = 3 * k;
    ctx.beginPath(); ctx.moveTo(W / 2 - 26 * k, ly - 16 * k); ctx.lineTo(W / 2, ly + (1 - recoil) * 8 * k); ctx.lineTo(W / 2 + 26 * k, ly - 16 * k); ctx.stroke();
    if (left > 0) drawEmoji(ctx, '💖', W / 2, ly + (1 - recoil) * 4 * k, 34 * k * (1 - recoil * 0.5));
    // sisa lemparan: deretan hati kecil
    const per = Math.min(22 * k, (W - 40) / Math.max(1, p.throws));
    for (let i = 0; i < p.throws; i++) { ctx.globalAlpha = i < left ? 1 : 0.22; drawEmoji(ctx, '💗', W / 2 + (i - (p.throws - 1) / 2) * per, H - 12 * k, 15 * k); }
    ctx.globalAlpha = 1;

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
      outlined(ctx, 'Tap buat lempar hati! 👆', W / 2, H * 0.55, 21 * k);
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
    api.finish({ win, stars, score: hits, detail: win ? `Kena ${hits} kali, sisa ${spare} lemparan` : `Kena ${hits} dari ${p.target}` });
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
