// Kartu Deep Talk: tarik kartu acak buat mancing obrolan berdua.
// Kartu bawaan (talk-cards.js) + pertanyaan tambahan dari CMS (CONFIG.talkCustom).
import { CONFIG } from './config.js';
import { TALK_CARDS, TALK_CATS } from './talk-cards.js';
import { fill } from './personal.js';
import { esc, shuffle } from './util.js';
import { on as onNet, send as sendNet, peer as peerNet } from './online.js';

const $ = (s) => document.querySelector(s);

function allCards() {
  const cards = [];
  for (const [cat, list] of Object.entries(TALK_CARDS)) list.forEach((q) => cards.push({ cat, q }));
  (CONFIG.talkCustom || []).filter((q) => q && q.trim()).forEach((q) => cards.push({ cat: 'custom', q: q.trim() }));
  return cards;
}

export function initTalk({ sfx }) {
  const cards = allCards();
  const cats = ['semua', ...Object.keys(TALK_CATS).filter((c) => cards.some((x) => x.cat === c))];
  let cat = 'semua';
  let deck = [];
  let drawn = 0;
  let busy = false;
  let sync = false; // Deep Talk Bareng: kartu yang ditarik dikirim ke HP pasangan juga

  const catName = (c) => (c === 'semua' ? 'Semua' : fill(TALK_CATS[c].name));

  function renderCats() {
    $('#talk-cats').innerHTML = cats.map((c) => `
      <button type="button" class="talk-cat ${c === cat ? 'on' : ''}" data-cat="${c}">${c === 'semua' ? '🃏' : TALK_CATS[c].icon} ${esc(catName(c))}</button>`).join('');
  }
  function newDeck() {
    deck = shuffle(cards.filter((x) => cat === 'semua' || x.cat === cat));
    drawn = 0;
  }
  function draw() {
    if (busy) return;
    if (!deck.length) newDeck();
    const card = deck.pop();
    show(card);
    if (sync) sendNet('talk', { card });
  }
  function show(card) {
    busy = true;
    drawn++;
    const el = $('#talk-card');
    sfx('flip');
    el.classList.remove('flipped');
    setTimeout(() => {
      const info = TALK_CATS[card.cat];
      el.style.setProperty('--talk', info.color);
      $('#talk-cat').textContent = `${info.icon} ${fill(info.name)}`;
      $('#talk-q').textContent = fill(card.q);
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
    },
  };
}
