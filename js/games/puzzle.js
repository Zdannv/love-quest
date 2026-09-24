// Puzzle Foto: tap dua kepingan untuk menukar posisinya sampai fotonya utuh lagi.
import { shuffle } from '../util.js';

export function startPuzzle(stage, p, api) {
  const n = p.size;
  const total = n * n;

  // order[pos] = nomor kepingan yang sedang ada di posisi itu
  let order;
  do { order = shuffle([...Array(total).keys()]); } while (order.every((v, i) => v === i));

  const wrap = document.createElement('div');
  wrap.className = 'puzzle-wrap';
  wrap.style.setProperty('--ar', p.aspect);
  wrap.innerHTML = `
    <div class="puzzle-board" style="--n:${n}"><span class="puzzle-caption">${p.caption || ''}</span></div>
    <img class="puzzle-peek" src="${p.image}" alt="">
    <button class="btn ghost puzzle-peek-btn">👀 Intip foto</button>`;
  stage.appendChild(wrap);
  const board = wrap.querySelector('.puzzle-board');
  const peekImg = wrap.querySelector('.puzzle-peek');
  const peekBtn = wrap.querySelector('.puzzle-peek-btn');

  // Kotak-kotak papan dibuat sekali & nggak pernah dipindah.
  // Tukar kepingan = cukup tukar posisi gambar di dua kotak (jauh lebih enteng, bisa tap cepat).
  const bgPos = (piece) => {
    const r = Math.floor(piece / n), c = piece % n;
    return `${(c / (n - 1)) * 100}% ${(r / (n - 1)) * 100}%`;
  };
  const slots = [];
  for (let pos = 0; pos < total; pos++) {
    const t = document.createElement('button');
    t.className = 'tile';
    t.style.backgroundImage = `url("${p.image}")`;
    t.style.backgroundSize = `${n * 100}% ${n * 100}%`;
    t.dataset.pos = pos;
    slots.push(t);
    board.appendChild(t);
  }

  let selected = -1, moves = 0, done = false, placedBefore = 0;

  function paint(pos) {
    const t = slots[pos];
    t.style.backgroundPosition = bgPos(order[pos]);
    t.classList.toggle('ok', order[pos] === pos);
    t.classList.toggle('sel', pos === selected);
  }

  function select(pos) {
    const prev = selected;
    selected = pos;
    if (prev >= 0) paint(prev);
    if (pos >= 0) paint(pos);
  }

  board.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.tile');
    if (!t || done) return;
    e.preventDefault();
    const pos = +t.dataset.pos;
    if (selected === -1) {
      select(pos);
      api.sfx('flip');
    } else if (selected === pos) {
      select(-1);
    } else {
      const a = selected;
      [order[a], order[pos]] = [order[pos], order[a]];
      selected = -1;
      paint(a);
      paint(pos);
      moves++;
      const placed = order.filter((v, i) => v === i).length;
      if (placed > placedBefore) {
        api.sfx('good');
        api.streak(true);
      } else {
        api.sfx('pop');
        api.streak(false);
      }
      placedBefore = placed;
      if (placed === total) win();
    }
    stats();
  });

  const togglePeek = (on) => { peekImg.classList.toggle('show', on); };
  peekBtn.addEventListener('pointerdown', () => togglePeek(true));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => peekBtn.addEventListener(ev, () => togglePeek(false)));

  const t0 = performance.now();
  let timeLeft = p.time;
  function stats() {
    const placed = order.filter((v, i) => v === i).length;
    api.setStats(`⏱ ${Math.ceil(timeLeft)}s · 🧩 ${placed}/${total} · 👆 ${moves}`);
  }
  const iv = setInterval(() => {
    timeLeft = Math.max(0, p.time - (performance.now() - t0) / 1000);
    stats();
    if (timeLeft <= 0) end(false);
  }, 200);

  function win() {
    done = true;
    clearInterval(iv);
    board.classList.add('solved');
    setTimeout(() => end(true), 1300);
  }

  function end(ok) {
    if (ok === false && done) return;
    done = true;
    clearInterval(iv);
    const stars = !ok ? 0 : moves <= total + 2 ? 3 : moves <= Math.ceil(total * 1.6) ? 2 : 1;
    api.finish({ win: ok, stars, detail: ok ? `Selesai dalam ${moves} tukaran` : 'Waktunya habis ⏰' });
  }

  slots.forEach((_, pos) => paint(pos));
  stats();
  return { destroy() { done = true; clearInterval(iv); } };
}
