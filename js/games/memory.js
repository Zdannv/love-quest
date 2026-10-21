// Kartu Kembar: buka dua kartu, cari pasangan yang sama sebelum waktu habis.
// Level tinggi (p.swap): tiap salah tebak, dua kartu tertutup tukeran tempat diam-diam 🔀.
// Mode skor (p.endless): papan selesai → ronde berikutnya kartunya nambah & waktunya makin ketat,
// mulai ronde 4 ada kartu nakal yang tukeran tempat. Main terus sampai waktu habis. Skor = pasangan ketemu.
import { shuffle } from '../util.js';

export function startMemory(stage, p, api) {
  const photos = (p.photos || []).map((src) => `img:${src}`);
  let round = 1, pairs = p.pairs, swap = Boolean(p.swap), score = 0;
  let grid = null, first = null, second = null, lock = false, matched = 0, moves = 0, done = false;
  let timeLeft = p.time, t0 = performance.now(), budget = p.time;

  // Mode skor: ronde 1 = 3 pasang, nambah 1 tiap ronde (maks 10). Waktu per pasang makin dikit.
  const roundSetup = (r) => {
    const n = Math.min(10, 2 + r);
    return { pairs: n, time: Math.round(n * Math.max(3.4, 6.5 - r * 0.35) + 8), swap: r >= 4 };
  };

  function deal() {
    grid?.remove();
    const icons = [...photos.slice(0, Math.ceil(pairs / 2)), ...shuffle([...p.emojis])].slice(0, pairs);
    const deck = shuffle([...icons, ...icons]);
    const cols = deck.length === 6 ? 3 : deck.length > 16 ? 5 : 4;
    const rows = Math.ceil(deck.length / cols);
    grid = document.createElement('div');
    grid.className = 'memory-grid';
    grid.style.setProperty('--cols', cols);
    grid.style.setProperty('--ratio', (rows * 1.2) / cols);
    deck.forEach((em, i) => {
      const card = document.createElement('button');
      card.className = 'card';
      card.dataset.em = em;
      card.setAttribute('aria-label', 'Kartu tertutup');
      card.style.animationDelay = `${i * 35}ms`;
      card.innerHTML = `<span class="card-inner"><span class="face back">💗</span><span class="face front">${em.startsWith('img:') ? `<img class="card-photo" src="${em.slice(4)}" alt="">` : em}</span></span>`;
      card.addEventListener('click', () => flip(card));
      grid.appendChild(card);
    });
    stage.appendChild(grid);
    first = second = null; lock = false; matched = 0;
  }

  function stats() {
    const extra = p.endless ? ` · 🏆 ${score + matched}` : '';
    api.setStats(`⏱ ${Math.ceil(timeLeft)}s · 🃏 ${matched}/${pairs}${p.endless ? ` · R${round}` : ` · 👆 ${moves}`}${extra}`);
  }

  // Kartu nakal: dua kartu tertutup (bukan yang lagi kebuka / udah ketemu) tukeran tempat
  function sneakySwap() {
    const closed = [...grid.children].filter((c) => !c.classList.contains('matched') && !c.classList.contains('flipped'));
    if (closed.length < 4) return;
    const [a, b] = shuffle(closed).slice(0, 2);
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const mark = document.createComment('');
    a.replaceWith(mark); b.replaceWith(a); mark.replaceWith(b);
    for (const [el, from] of [[a, ra], [b, rb]]) { // animasi geser ke tempat barunya
      const to = el.getBoundingClientRect();
      el.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3,1.3,.5,1)' });
      el.classList.add('swapped'); setTimeout(() => el.classList.remove('swapped'), 700);
    }
    api.sfx('pop');
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
      if (matched === pairs) cleared();
    } else {
      api.streak(false);
      lock = true;
      const a = first, b = second;
      setTimeout(() => {
        a.classList.remove('flipped');
        b.classList.remove('flipped');
        first = second = null;
        lock = false;
        if (swap && !done) sneakySwap();
      }, 650);
      stats();
    }
  }

  function cleared() {
    if (!p.endless) { end(true); return; }
    // ronde berikutnya: sisa waktu kebawa sebagian biar main cepet ada untungnya
    score += pairs;
    const carry = Math.min(10, Math.floor(timeLeft / 2));
    round++;
    const s = roundSetup(round);
    pairs = s.pairs; swap = s.swap;
    lock = true;
    api.sfx('win');
    api.say(`Ronde ${round}: ${pairs} pasang${s.swap ? ', ada kartu nakal yang tukeran tempat 🔀' : ''}${carry ? ` · bonus waktu +${carry}s` : ''}`, 'happy');
    setTimeout(() => { if (done) return; budget = s.time + carry; t0 = performance.now(); deal(); stats(); }, 900);
  }

  if (p.endless) { const s = roundSetup(1); pairs = s.pairs; swap = s.swap; budget = timeLeft = s.time; }
  deal();
  if (swap && !p.endless) api.say('Awas, kartu nakal! Tiap salah tebak, 2 kartu tukeran tempat 🔀', 'happy');

  const iv = setInterval(() => {
    if (lock && matched === pairs) return; // jeda ganti ronde
    timeLeft = Math.max(0, budget - (performance.now() - t0) / 1000);
    stats();
    if (timeLeft <= 0) end(false);
  }, 200);

  function end(win) {
    if (done) return;
    done = true;
    clearInterval(iv);
    if (p.endless) { const total = score + matched; api.finish({ win: true, score: total, detail: `Nemu ${total} pasang, sampai ronde ${round} 🃏` }); return; }
    let stars = 0;
    if (win) {
      stars = moves <= Math.ceil(pairs * 1.8) + 1 ? 3 : moves <= Math.ceil(pairs * 2.6) + 1 ? 2 : 1;
    }
    api.finish({ win, stars, detail: win ? `Selesai dalam ${moves} langkah` : 'Waktunya habis ⏰' });
  }

  stats();
  if (window.__lqTest) window.__memory = { get round() { return round; }, get pairs() { return pairs; }, get grid() { return grid; }, get swap() { return swap; } };
  return { destroy() { done = true; clearInterval(iv); grid?.remove(); } };
}
