// Panah Cinta: jarum berayun di bar, tap pas jarumnya ada di zona hati.
// Tiap kena, zonanya makin kecil & jarumnya makin cepat. Meleset = nyawa berkurang.
import { rand, shake, drawEmoji, loadImage } from '../util.js';
import { drawToon, toonLoad } from '../toon.js';
import { drawSky, drawGround, makeFx, outlined, shadow } from '../scene.js';

export function startTiming(stage, p, api) {
  const wrap = document.createElement('div');
  wrap.className = 'timing-wrap';
  wrap.innerHTML = `
    <canvas class="timing-scene"></canvas>
    <div class="timing-bar">
      <div class="timing-zone"><span>💖</span></div>
      <div class="timing-needle"></div>
    </div>
    <button class="btn big timing-btn">💘 Panah!</button>`;
  stage.appendChild(wrap);
  const bar = wrap.querySelector('.timing-bar');
  const zone = wrap.querySelector('.timing-zone');
  const needle = wrap.querySelector('.timing-needle');
  // Adegan di atas bar: pemanah di kiri, hati sasaran di kanan. Tiap tap, panahnya beneran melesat.
  const cv = wrap.querySelector('.timing-scene'), ctx = cv.getContext('2d');
  const face = loadImage(p.face), toon = p.toon || 'f';
  toonLoad(toon);
  const fx = makeFx();
  let W = 0, H = 0, clock = 0, arrows = [], floats = [], pull = 0, hitT = 1, missT = 1, lastHeart = '💖';
  function resize() { const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0); }
  resize();
  window.addEventListener('resize', resize);
  const gY = () => H * 0.84, ax = () => W * 0.2, tx = () => W * 0.8, ty = () => gY() - H * 0.4;

  let hits = 0, lives = p.lives, perfects = 0, done = false, raf = 0, phase = 0, last = performance.now();
  let zoneStart = 0, zoneWidth = p.zone, pos = 0, cooldown = 0;

  function newZone() {
    zoneWidth = Math.max(p.minZone, p.zone - hits * p.shrink);
    zoneStart = rand(0.05, 0.95 - zoneWidth);
    zone.style.left = `${zoneStart * 100}%`;
    zone.style.width = `${zoneWidth * 100}%`;
  }

  function shoot() {
    if (done || cooldown > 0) return;
    cooldown = 0.35;
    pull = 1;
    const inZone = pos >= zoneStart && pos <= zoneStart + zoneWidth;
    if (inZone) {
      hits++;
      const center = zoneStart + zoneWidth / 2;
      const perfect = Math.abs(pos - center) < zoneWidth * 0.18;
      if (perfect) perfects++;
      api.sfx(perfect ? 'gold' : 'good');
      api.streak(true);
      arrows.push({ u: 0, hit: true, perfect, off: 0 });
      if (perfect) api.say('Pas di tengah! Perfect ✨', 'happy');
      if (hits >= p.target) { end(true); return; }
      newZone();
    } else {
      lives--;
      api.sfx('bad');
      api.streak(false);
      shake(bar);
      arrows.push({ u: 0, hit: false, off: pos < zoneStart ? 1 : -1 }); // meleset: kependekan / kelewatan
      if (lives <= 0) { end(false); return; }
    }
    stats();
  }

  wrap.querySelector('.timing-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); shoot(); });
  bar.addEventListener('pointerdown', (e) => { e.preventDefault(); shoot(); });
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); shoot(); } };
  window.addEventListener('keydown', onKey);

  function stats() {
    api.setStats(p.endless ? `💘 Skor ${hits} · 🏆 ${Math.max(p.best || 0, hits)} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}` : `💘 ${hits}/${p.target} · ✨ ${perfects} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}`);
  }

  function drawScene(dt) {
    clock += dt; pull = Math.max(0, pull - dt * 4); hitT += dt; missT += dt; fx.step(dt);
    if (!W) { resize(); if (!W) return; }
    const k = Math.min(1.2, H / 260);
    ctx.clearRect(0, 0, W, H);
    drawSky(ctx, W, H, gY(), 0, clock, 'night', k);
    drawGround(ctx, W, H, gY(), 0, 'night', k);
    // sasaran: hati besar di tiang, makin kecil pas zonanya makin sempit
    const hs = (64 + zoneWidth * 90) * k * (1 + (hitT < 0.3 ? Math.sin((hitT / 0.3) * Math.PI) * 0.25 : 0)), bob = Math.sin(clock * 2.2) * 4 * k;
    ctx.strokeStyle = '#c9a27a'; ctx.lineWidth = 6 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx(), gY()); ctx.lineTo(tx(), ty() + bob + hs * 0.3); ctx.stroke();
    shadow(ctx, tx(), gY() + 4 * k, 26 * k);
    const gl = ctx.createRadialGradient(tx(), ty() + bob, 4, tx(), ty() + bob, hs); gl.addColorStop(0, 'rgba(255,143,183,.5)'); gl.addColorStop(1, 'rgba(255,143,183,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(tx(), ty() + bob, hs, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(tx() + (missT < 0.3 ? Math.sin(missT * 60) * 3 : 0), ty() + bob); drawEmoji(ctx, missT < 0.7 ? '💔' : lastHeart, 0, 0, hs); ctx.restore();
    // pemanah
    const h = 150 * k;
    shadow(ctx, ax(), gY() + 4 * k, 30 * k);
    drawToon(ctx, toon, pull > 0.3 ? 'attack1' : 'idle', ax(), gY() + 6 * k, h, 1, face, p.emoji || '😊', '#fff');
    ctx.save(); ctx.translate(ax() + 62 * k - pull * 6 * k, gY() - h * 0.36); ctx.rotate(-0.78 - 0.1); drawEmoji(ctx, '🏹', 0, 0, 54 * k); ctx.restore();
    // panah melesat
    for (const a of arrows) {
      a.u += dt * 2.6;
      const sx = ax() + 74 * k, sy = gY() - h * 0.38, ex = a.hit ? tx() - hs * 0.2 : tx() + (a.off > 0 ? -W * 0.22 : W * 0.3), ey = a.hit ? ty() + bob : a.off > 0 ? gY() - 4 * k : ty() - H * 0.25;
      const u = Math.min(1, a.u), x = sx + (ex - sx) * u, y = sy + (ey - sy) * u - Math.sin(u * Math.PI) * H * (a.hit ? 0.1 : 0.16);
      const u2 = Math.min(1, u + 0.03), x2 = sx + (ex - sx) * u2, y2 = sy + (ey - sy) * u2 - Math.sin(u2 * Math.PI) * H * (a.hit ? 0.1 : 0.16);
      const ang = Math.atan2(y2 - y, x2 - x);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(-26 * k, 0); ctx.lineTo(6 * k, 0); ctx.stroke();
      ctx.fillStyle = '#ff5c93'; ctx.beginPath(); ctx.moveTo(14 * k, 0); ctx.lineTo(2 * k, -6 * k); ctx.lineTo(2 * k, 6 * k); ctx.fill();
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(-26 * k, 0); ctx.lineTo(-34 * k, -6 * k); ctx.lineTo(-30 * k, 0); ctx.lineTo(-34 * k, 6 * k); ctx.fill();
      ctx.restore();
      if (a.u < 1) fx.puff(x, y, 'rgba(255,255,255,.7)', 3 * k);
      if (a.u >= 1 && !a.done) {
        a.done = true;
        if (a.hit) { hitT = 0; lastHeart = a.perfect ? '💘' : '💖'; fx.burst(tx(), ty(), { n: a.perfect ? 30 : 16, colors: a.perfect ? ['#ffd166', '#fff2a8', '#ff8fb7', '#fff'] : ['#ff8fb7', '#ffd3e4', '#fff'], speed: a.perfect ? 260 : 190 }); floats.push({ text: a.perfect ? 'Perfect! ✨' : 'Kena! 💘', life: 1, c: a.perfect ? '#ffd166' : '#ff8fb7' }); }
        else { missT = 0; floats.push({ text: a.off > 0 ? 'Kependekan 🙈' : 'Kelewatan 🙈', life: 1, c: '#e6d4ff' }); }
      }
    }
    arrows = arrows.filter((a) => a.u < 1.05);
    fx.draw(ctx);
    for (const f of floats) { f.life -= dt * 1.1; ctx.globalAlpha = Math.max(0, f.life); outlined(ctx, f.text, W / 2, H * 0.24 - (1 - f.life) * 24, 22 * k, f.c, '#3a2b63'); }
    floats = floats.filter((f) => f.life > 0);
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    drawScene(dt);
    if (done) return;
    cooldown = Math.max(0, cooldown - dt);
    phase += dt * (p.speed + hits * p.speedUp);
    pos = (Math.sin(phase) + 1) / 2; // 0..1 bolak-balik
    needle.style.left = `${pos * 100}%`;
  }

  function end(win) {
    if (done) return;
    done = true;
    const stars = !win ? 0 : Math.max(1, Math.min(3, lives - (p.lives - 3) + (perfects >= 3 ? 1 : 0)));
    if (p.endless) { api.finish({ win: true, score: hits, detail: `Kena ${hits} kali (${perfects} perfect)` }); return; }
    api.finish({ win, stars, detail: win ? `Kena ${hits} kali (${perfects} perfect)` : `Kena ${hits} dari ${p.target}` });
  }

  newZone();
  stats();
  raf = requestAnimationFrame(loop);
  return {
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
    },
  };
}
