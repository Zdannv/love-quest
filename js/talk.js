// Kartu Deep Talk: tarik kartu acak buat mancing obrolan berdua.
// Kartu bawaan (talk-cards.js) + pertanyaan tambahan dari CMS (CONFIG.talkCustom).
import { CONFIG } from './config.js';
import { TALK_CARDS, TALK_CATS } from './talk-cards.js';
import { fill } from './personal.js';
import { esc, shuffle } from './util.js';
import { bump } from './stats.js';
import { track as trackDaily } from './daily.js';
import { on as onNet, send as sendNet, peer as peerNet } from './online.js';

const $ = (s) => document.querySelector(s);

// Coba gratis: cuma beberapa kartu tiap topik yang kebuka, sisanya ada di versi lengkap
const TRIAL_PER_CAT = 4;
const trial = () => Boolean(CONFIG.showcase);
function allCards() {
  const cards = [];
  for (const [cat, list] of Object.entries(TALK_CARDS)) list.slice(0, trial() ? TRIAL_PER_CAT : list.length).forEach((q) => cards.push({ cat, q }));
  (CONFIG.talkCustom || []).filter((q) => q && q.trim()).forEach((q) => cards.push({ cat: 'custom', q: q.trim() }));
  return cards;
}

export function initTalk({ sfx }) {
  const cards = allCards();
  const fullCount = (c) => (c === 'semua' ? Object.values(TALK_CARDS).reduce((a, l) => a + l.length, 0) + cards.filter((x) => x.cat === 'custom').length : c === 'custom' ? cards.filter((x) => x.cat === 'custom').length : TALK_CARDS[c]?.length || 0);
  const cats = ['semua', ...Object.keys(TALK_CATS).filter((c) => cards.some((x) => x.cat === c))];
  let cat = 'semua';
  let deck = [];
  let drawn = 0;
  let busy = false;
  let sync = false; // Deep Talk Bareng: kartu yang ditarik dikirim ke HP pasangan juga

  const catName = (c) => (c === 'semua' ? 'Semua' : fill(TALK_CATS[c].name));

  function renderCats() {
    $('#talk-cats').innerHTML = cats.map((c) => `
      <button type="button" class="talk-cat ${c === cat ? 'on' : ''}" data-cat="${c}" style="--tc:${c === 'semua' ? 'var(--pink)' : TALK_CATS[c].color}"><span class="tc-ic">${c === 'semua' ? '🃏' : TALK_CATS[c].icon}</span><b>${esc(catName(c))}</b><small>${trial() ? `${cards.filter((x) => c === 'semua' || x.cat === c).length}/${fullCount(c)} 🔓` : cards.filter((x) => c === 'semua' || x.cat === c).length}</small></button>`).join('');
  }
  function newDeck() {
    deck = shuffle(cards.filter((x) => cat === 'semua' || x.cat === cat));
    drawn = 0;
  }
  // Tulisan pertanyaan nyesuaiin ukuran kartu: mulai dari lebar kartu, dikecilin sampai semuanya muat (nggak kepotong)
  function fitQ() {
    const p = $('#talk-q'), front = p?.parentElement;
    if (!p || !front || !front.clientWidth) return;
    let size = Math.min(28, Math.max(16, front.clientWidth * 0.085));
    p.style.fontSize = `${size}px`;
    for (let i = 0; i < 24 && front.scrollHeight > front.clientHeight + 1 && size > 13; i++) { size -= 1; p.style.fontSize = `${size}px`; }
  }
  window.addEventListener('resize', () => fitQ());
  function draw() {
    if (busy) return;
    if (!deck.length && trial() && drawn > 0 && !locked) { showLocked(); return; }
    locked = false;
    if (!deck.length) newDeck();
    const card = deck.pop();
    show(card);
    if (sync) sendNet('talk', { card });
  }
  // Coba gratis: kartu yang kebuka udah habis → kartu "kebuka di versi kalian"
  let locked = false;
  function showLocked() {
    locked = true;
    const el = $('#talk-card'), more = fullCount(cat) - cards.filter((x) => cat === 'semua' || x.cat === cat).length;
    sfx('flip');
    el.classList.remove('flipped');
    setTimeout(() => {
      el.style.setProperty('--talk', 'var(--pink)');
      $('#talk-cat').textContent = '🔒 Versi lengkap';
      $('#talk-q').textContent = `Masih ada ${more} kartu lagi di topik ini 💌 Kebuka semua (100+ kartu) di versi kalian, plus kartu yang kamu tulis sendiri.`;
      fitQ();
      $('#talk-turn').innerHTML = '<span class="talk-buy" data-paket>💖 Bikin versi kalian</span>';
      el.classList.add('flipped');
      $('#talk-next').textContent = 'Ulangi kartu gratis 🔁';
    }, el.classList.contains('flipped') ? 260 : 0);
  }
  function show(card) {
    busy = true;
    drawn++;
    bump('talkCards'); trackDaily('talk');
    const el = $('#talk-card');
    sfx('flip');
    el.classList.remove('flipped');
    setTimeout(() => {
      const info = TALK_CATS[card.cat];
      el.style.setProperty('--talk', info.color);
      $('#talk-cat').textContent = `${info.icon} ${fill(info.name)}`;
      $('#talk-q').textContent = fill(card.q);
      fitQ();
      // gantian siapa yang jawab duluan + sisa kartu di tumpukan
      $('#talk-turn').textContent = drawn % 2 ? '🎤 Yang megang HP jawab duluan' : '🎤 Kasih HP-nya, dia jawab duluan';
      const total = cards.filter((x) => cat === 'semua' || x.cat === cat).length;
      $('#talk-prog').style.width = `${((total - deck.length) / total) * 100}%`;
      $('#talk-left').textContent = `${deck.length} kartu lagi`;
      el.classList.remove('deal'); void el.offsetWidth; el.classList.add('deal');
      el.classList.add('flipped');
      $('#talk-count').textContent = sync ? `💞 Bareng ${peerNet()?.name || ''}` : `Kartu ke-${drawn}`;
      $('#talk-next').textContent = 'Kartu berikutnya 🃏';
      busy = false;
    }, el.classList.contains('flipped') ? 260 : 0);
  }

  $('#talk-cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    sfx('click');
    cat = b.dataset.cat;
    renderCats();
    newDeck();
    draw();
  });
  $('#talk-card').addEventListener('click', draw);
  $('#talk-next').addEventListener('click', draw);

  onNet('talk', (d) => { if (sync && d.card && TALK_CATS[d.card.cat]) show(d.card); });

  renderCats();
  newDeck();
  return {
    setSync(v) {
      sync = v;
      $('#screen-talk').classList.toggle('synced', v);
      if (v) $('#talk-count').textContent = `💞 Bareng ${peerNet()?.name || ''}`;
    },
    // Tiap buka layar ini: kartunya ketutup lagi
    reset() {
      $('#talk-card').classList.remove('flipped');
      $('#talk-count').textContent = `${cards.length} kartu`;
      $('#talk-next').textContent = 'Tarik kartu 🃏';
      $('#talk-prog').style.width = '0%';
      $('#talk-left').textContent = 'Pilih topik dulu';
    },
  };
}
