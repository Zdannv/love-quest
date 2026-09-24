// Cari yang Beda: semua emoji sama, kecuali satu. Tap yang beda secepatnya!
import { pick, shake, floatText } from '../util.js';

const PAIRS = [
  ['🐱', '😺'], ['🦉', '🐦'], ['💖', '💗'], ['🌸', '🌺'], ['🍓', '🍒'], ['⭐', '🌟'],
  ['🐰', '🐇'], ['🍭', '🍬'], ['🌙', '🌛'], ['😊', '😃'], ['🐻', '🐨'], ['🧁', '🍰'],
];

export function startOdd(stage, p, api) {
  const wrap = document.createElement('div');
  wrap.className = 'odd-wrap';
  stage.appendChild(wrap);

  let round = 0, done = false, killed = false, timeLeft = p.time, penalty = 0, lastPair = null;
  const t0 = performance.now();

  function sizeFor(r) {
    return 3 + Math.floor((r * (p.maxSize - 2)) / p.rounds);
  }

  function renderRound() {
    const n = sizeFor(round);
    let pair;
    do { pair = pick(PAIRS); } while (pair === lastPair);
    lastPair = pair;
    const [base, odd] = Math.random() < 0.5 ? pair : [pair[1], pair[0]];
    const oddAt = Math.floor(Math.random() * n * n);
    wrap.innerHTML = `<div class="odd-grid" style="--n:${n}">${
      Array.from({ length: n * n }, (_, i) => `<button class="odd-cell" data-odd="${i === oddAt ? 1 : 0}">${i === oddAt ? odd : base}</button>`).join('')
    }</div>`;
    stats();
  }

  wrap.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.odd-cell');
    if (!cell || done) return;
    e.preventDefault();
    if (cell.dataset.odd === '1') {
      cell.classList.add('found');
      api.sfx('good');
      api.streak(true);
      round++;
      if (round >= p.rounds) { end(true); return; }
      done = true; // kunci sebentar selama animasi
      setTimeout(() => { if (killed) return; done = false; renderRound(); }, 350);
    } else {
      penalty += 3;
      cell.classList.add('nope');
      floatText(cell, '-3s', 'bad');
      shake(wrap);
      api.sfx('bad');
      api.streak(false);
    }
  });

  function stats() {
    api.setStats(`⏱ ${Math.ceil(timeLeft)}s · 🔍 ${round}/${p.rounds}`);
  }

  const iv = setInterval(() => {
    timeLeft = Math.max(0, p.time - penalty - (performance.now() - t0) / 1000);
    stats();
    if (timeLeft <= 0) end(false);
  }, 150);

  function end(win) {
    if (win === false && round >= p.rounds) return;
    done = true;
    clearInterval(iv);
    const frac = timeLeft / p.time;
    const stars = !win ? 0 : frac > 0.45 ? 3 : frac > 0.2 ? 2 : 1;
    api.finish({ win, stars, detail: win ? `Semua ketemu, sisa ${Math.ceil(timeLeft)} detik` : `Ketemu ${round} dari ${p.rounds}` });
  }

  renderRound();
  return { destroy() { done = killed = true; clearInterval(iv); } };
}
