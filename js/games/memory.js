// Kartu Kembar: buka dua kartu, cari pasangan yang sama sebelum waktu habis.
import { shuffle } from '../util.js';

export function startMemory(stage, p, api) {
  const icons = shuffle([...p.emojis]).slice(0, p.pairs);
  const deck = shuffle([...icons, ...icons]);
  const cols = deck.length === 6 ? 3 : 4;
  const rows = Math.ceil(deck.length / cols);

  const grid = document.createElement('div');
  grid.className = 'memory-grid';
  grid.style.setProperty('--cols', cols);
  grid.style.setProperty('--ratio', (rows * 1.2) / cols);

  let first = null, second = null, lock = false, matched = 0, moves = 0, done = false;
  let timeLeft = p.time;

  deck.forEach((em, i) => {
    const card = document.createElement('button');
    card.className = 'card';
    card.dataset.em = em;
    card.setAttribute('aria-label', 'Kartu tertutup');
    card.style.animationDelay = `${i * 35}ms`;
    card.innerHTML = `<span class="card-inner"><span class="face back">💗</span><span class="face front">${em}</span></span>`;
    card.addEventListener('click', () => flip(card));
    grid.appendChild(card);
  });
  stage.appendChild(grid);

  function stats() {
    api.setStats(`⏱ ${Math.ceil(timeLeft)}s · 🃏 ${matched}/${p.pairs} · 👆 ${moves}`);
  }

  function flip(card) {
    if (done || lock || card === first || card.classList.contains('matched')) return;
    card.classList.add('flipped');
    api.sfx('flip');
    if (!first) { first = card; return; }
    second = card;
    moves++;
    if (first.dataset.em === second.dataset.em) {
      first.classList.add('matched');
      second.classList.add('matched');
      first = second = null;
      matched++;
      api.sfx('good');
      api.streak(true);
      stats();
      if (matched === p.pairs) end(true);
    } else {
      api.streak(false);
      lock = true;
      const a = first, b = second;
      setTimeout(() => {
        a.classList.remove('flipped');
        b.classList.remove('flipped');
        first = second = null;
        lock = false;
      }, 650);
      stats();
    }
  }

  const t0 = performance.now();
  const iv = setInterval(() => {
    timeLeft = Math.max(0, p.time - (performance.now() - t0) / 1000);
    stats();
    if (timeLeft <= 0) end(false);
  }, 200);

  function end(win) {
    if (done) return;
    done = true;
    clearInterval(iv);
    let stars = 0;
    if (win) {
      stars = moves <= Math.ceil(p.pairs * 1.8) + 1 ? 3 : moves <= Math.ceil(p.pairs * 2.6) + 1 ? 2 : 1;
    }
    api.finish({ win, stars, detail: win ? `Selesai dalam ${moves} langkah` : 'Waktunya habis ⏰' });
  }

  stats();
  return { destroy() { done = true; clearInterval(iv); } };
}
