// Panah Cinta: jarum berayun di bar, tap pas jarumnya ada di zona hati.
// Tiap kena, zonanya makin kecil & jarumnya makin cepat. Meleset = nyawa berkurang.
import { rand, shake } from '../util.js';

export function startTiming(stage, p, api) {
  const wrap = document.createElement('div');
  wrap.className = 'timing-wrap';
  wrap.innerHTML = `
    <div class="timing-target">🎯</div>
    <div class="timing-bar">
      <div class="timing-zone"><span>💖</span></div>
      <div class="timing-needle"></div>
    </div>
    <button class="btn big timing-btn">💘 Panah!</button>`;
  stage.appendChild(wrap);
  const bar = wrap.querySelector('.timing-bar');
  const zone = wrap.querySelector('.timing-zone');
  const needle = wrap.querySelector('.timing-needle');
  const targetEl = wrap.querySelector('.timing-target');

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
    const inZone = pos >= zoneStart && pos <= zoneStart + zoneWidth;
    if (inZone) {
      hits++;
      const center = zoneStart + zoneWidth / 2;
      const perfect = Math.abs(pos - center) < zoneWidth * 0.18;
      if (perfect) perfects++;
      api.sfx(perfect ? 'gold' : 'good');
      api.streak(true);
      targetEl.textContent = perfect ? '💘' : '💖';
      targetEl.classList.remove('pop');
      void targetEl.offsetWidth;
      targetEl.classList.add('pop');
      if (perfect) api.say('Pas di tengah! Perfect ✨', 'happy');
      if (hits >= p.target) { end(true); return; }
      newZone();
    } else {
      lives--;
      api.sfx('bad');
      api.streak(false);
      shake(bar);
      targetEl.textContent = '💔';
      if (lives <= 0) { end(false); return; }
    }
    stats();
  }

  wrap.querySelector('.timing-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); shoot(); });
  bar.addEventListener('pointerdown', (e) => { e.preventDefault(); shoot(); });
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); shoot(); } };
  window.addEventListener('keydown', onKey);

  function stats() {
    api.setStats(`💘 ${hits}/${p.target} · ✨ ${perfects} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(p.lives - Math.max(0, lives))}`);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (done) return;
    cooldown = Math.max(0, cooldown - dt);
    phase += dt * (p.speed + hits * p.speedUp);
    pos = (Math.sin(phase) + 1) / 2; // 0..1 bolak-balik
    needle.style.left = `${pos * 100}%`;
  }

  function end(win) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    const stars = !win ? 0 : Math.max(1, Math.min(3, lives - (p.lives - 3) + (perfects >= 3 ? 1 : 0)));
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
    },
  };
}
