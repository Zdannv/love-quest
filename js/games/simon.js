// Ingat Urutan: perhatikan urutan tombol yang menyala, lalu ulangi.
import { pick } from '../util.js';
import { fill } from '../personal.js';

const PAD_CLASSES = ['owl', 'cat', 'heart', 'star'];

export function startSimon(stage, p, api) {
  const PADS = (p.pads || ['🦉', '🐱', '💖', '⭐']).map((em, i) => ({ em, cls: PAD_CLASSES[i] }));
  const wrap = document.createElement('div');
  wrap.className = 'simon-wrap';
  wrap.innerHTML = `
    <div class="simon-status">Perhatiin yaa…</div>
    <div class="simon-grid">
      ${PADS.map((pad, i) => `<button class="simon-pad ${pad.cls}" data-i="${i}" disabled>${pad.em}</button>`).join('')}
    </div>`;
  stage.appendChild(wrap);
  const status = wrap.querySelector('.simon-status');
  const pads = [...wrap.querySelectorAll('.simon-pad')];

  const seq = [];
  let input = 0, lives = p.lives, mistakes = 0, done = false, accepting = false;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function stats() {
    api.setStats(`🎵 ${Math.max(0, seq.length - (accepting ? 0 : 1))}/${p.target} · ${'❤️'.repeat(lives)}${'🤍'.repeat(p.lives - lives)}`);
  }

  function flash(i, ms) {
    pads[i].classList.add('lit');
    api.sfx(`note${i}`);
    later(() => pads[i].classList.remove('lit'), ms * 0.7);
  }

  function playSeq() {
    accepting = false;
    input = 0;
    pads.forEach((b) => (b.disabled = true));
    status.textContent = 'Perhatiin yaa… 👀';
    stats();
    seq.forEach((i, k) => later(() => !done && flash(i, p.speed), 500 + k * p.speed));
    later(() => {
      if (done) return;
      accepting = true;
      pads.forEach((b) => (b.disabled = false));
      status.textContent = fill('Giliran {pasangan}! 💪');
      stats();
    }, 500 + seq.length * p.speed);
  }

  function nextRound() {
    seq.push(Math.floor(Math.random() * PADS.length));
    playSeq();
  }

  wrap.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.simon-pad');
    if (!b || !accepting || done) return;
    e.preventDefault();
    const i = +b.dataset.i;
    flash(i, 300);
    if (i === seq[input]) {
      input++;
      if (input === seq.length) {
        accepting = false;
        api.streak(true);
        if (seq.length >= p.target) { end(true); return; }
        status.textContent = pick(['Pinter! 🥳', 'Betul semua! ✨', 'Mantap! 🔥']);
        later(nextRound, 800);
      }
    } else {
      accepting = false;
      lives--;
      mistakes++;
      api.sfx('bad');
      api.streak(false);
      b.classList.add('wrong');
      later(() => b.classList.remove('wrong'), 400);
      stats();
      if (lives <= 0) { end(false); return; }
      api.say('{suara}… salah dikit, diulang yaa 🥺', 'sad');
      status.textContent = 'Yahh salah, diulang yaa 🥺';
      later(playSeq, 1000);
    }
  });

  function end(win) {
    done = true;
    pads.forEach((b) => (b.disabled = true));
    const stars = !win ? 0 : Math.max(1, 3 - mistakes);
    api.finish({ win, stars, detail: win ? `Hafal ${p.target} urutan!` : `Sampai ${seq.length - 1} urutan` });
  }

  later(nextRound, 300);
  stats();
  return { destroy() { done = true; timers.forEach(clearTimeout); } };
}

