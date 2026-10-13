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
    <div class="puzzle-frame">
      <div class="puzzle-board" style="--n:${n}"><span class="puzzle-caption">${p.caption || ''}</span></div>
      <div class="puzzle-prog"><i></i></div>
    </div>
    <div class="puzzle-tip">Tap 2 kepingan buat nukar, atau <b>geser</b> kepingan ke tempatnya</div>
    <img class="puzzle-peek" src="${p.image}" alt="">
    <button class="btn ghost puzzle-peek-btn">👀 Intip foto</button>`;
  stage.appendChild(wrap);
  const board = wrap.querySelector('.puzzle-board');
  const peekImg = wrap.querySelector('.puzzle-peek');
  const peekBtn = wrap.querySelector('.puzzle-peek-btn');
  const bar = wrap.querySelector('.puzzle-prog i');

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

  function swap(a, b) {
    [order[a], order[b]] = [order[b], order[a]];
    selected = -1;
    paint(a);
    paint(b);
    for (const q of [a, b]) { slots[q].classList.remove('pop'); void slots[q].offsetWidth; slots[q].classList.add('pop'); }
    moves++;
    const placed = order.filter((v, i) => v === i).length;
    if (placed > placedBefore) { api.sfx('good'); api.streak(true); }
    else { api.sfx('pop'); api.streak(false); }
    placedBefore = placed;
    bar.style.width = `${(placed / total) * 100}%`;
    if (placed === total) win();
  }

  // Dua cara main: tap kepingan lalu tap tujuannya, ATAU tahan & geser kepingan ke tempat tujuannya.
  let drag = null; // { pos, id, x0, y0, moved, ghost, wasSel }
  const tileAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.tile');
  board.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.tile');
    if (!t || done || drag) return;
    e.preventDefault();
    const pos = +t.dataset.pos;
    if (selected !== -1 && selected !== pos) { swap(selected, pos); stats(); return; }
    drag = { pos, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, wasSel: selected === pos };
    if (!drag.wasSel) { select(pos); api.sfx('flip'); }
  });
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 10) return;
    if (!drag.moved) {
      drag.moved = true;
      const src = slots[drag.pos], r = src.getBoundingClientRect(), g = src.cloneNode();
      g.className = 'tile puzzle-ghost';
      Object.assign(g.style, { width: `${r.width}px`, height: `${r.height}px` });
      document.body.appendChild(g);
      drag.ghost = g; drag.w = r.width; drag.h = r.height;
      src.classList.add('lifted');
    }
    drag.ghost.style.transform = `translate(${e.clientX - drag.w / 2}px, ${e.clientY - drag.h * 0.62}px) scale(1.08) rotate(-3deg)`;
    const over = tileAt(e.clientX, e.clientY);
    slots.forEach((sl) => sl.classList.toggle('drop', sl === over && +sl.dataset.pos !== drag.pos));
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    slots.forEach((sl) => sl.classList.remove('drop', 'lifted'));
    if (d.ghost) {
      d.ghost.remove();
      const over = tileAt(e.clientX, e.clientY);
      if (over && +over.dataset.pos !== d.pos && !done) swap(d.pos, +over.dataset.pos); else select(-1);
    } else if (d.wasSel) select(-1); // tap lagi kepingan yang sama = batal pilih
    stats();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

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
  bar.style.width = `${(order.filter((v, i) => v === i).length / total) * 100}%`;
  return { destroy() { done = true; clearInterval(iv); drag?.ghost?.remove(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); } };
}
