// Masak Bareng ala Overcooked: dapur dilihat dari atas, koki (kepala foto + topi koki) jalan pakai joystick.
// ✋ ambil/taruh barang di meja depan koki · 🔪 tahan buat motong di talenan.
// Alur: ambil bahan dari peti → potong di talenan / masak di kompor → taruh di piring → antar ke jendela saji 🛎️.
// Pesanan datang terus & makin cepat; 3 pelanggan kabur = selesai. Skor = pesanan yang kesaji.
// Berdua (p.duel): dua koki di dapur yang sama. HP "pasangan" yang ngatur isi dapur & pesanan (host),
// HP satunya ngirim posisi & aksi kokinya, lalu nerima keadaan dapur ±10x per detik.
import { drawEmoji, drawFace, loadImage } from '../util.js';

const MAP = [
  '#TLDRN#',
  'E.....O',
  'B.....S',
  'B.....S',
  '#..#..#',
  '#..#..#',
  '#.....X',
  'P.....W',
  '#.....#',
  '#######',
];
const COLS = MAP[0].length, ROWS = MAP.length;
const CRATE = { T: 'tomat', L: 'selada', D: 'daging', R: 'roti', N: 'nasi', E: 'telur', O: 'bawang' };
const E = { roti: '🍞', daging: '🥩', selada: '🥬', tomat: '🍅', nasi: '🍚', telur: '🥚', bawang: '🧅' };
const CHOP = ['selada', 'tomat', 'bawang'], COOK = ['daging', 'nasi', 'telur'];
const RECIPES = {
  salad: { name: 'Salad', em: '🥗', need: ['selada:potong', 'tomat:potong'] },
  burger: { name: 'Burger', em: '🍔', need: ['roti:raw', 'daging:masak', 'selada:potong'] },
  nasgor: { name: 'Nasi Goreng', em: '🍛', need: ['nasi:masak', 'telur:masak', 'bawang:potong'] },
  steak: { name: 'Steak', em: '🍖', need: ['daging:masak', 'tomat:potong'] },
};
const LABEL = { potong: 'potong', masak: 'matang', gosong: 'gosong' };
const CHOP_N = 6, COOK_T = 5, BURN_T = 7, MAX_MISS = 3, SPEED = 3.3, CR = 0.32;
const seeded = (s) => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const final = (it) => it && it.k !== 'plate' && it.s !== 'gosong' && (it.k === 'roti' || (CHOP.includes(it.k) && it.s === 'potong') || (COOK.includes(it.k) && it.s === 'masak'));
const sameDish = (items, need) => items.length === need.length && items.map((i) => `${i.k}:${i.s}`).sort().join() === [...need].sort().join();
const kindAt = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? '#' : MAP[y][x]);
const walkable = (x, y) => kindAt(x, y) === '.';

export function startCook(stage, p, api) {
  const duel = p.duel || null;
  const myId = duel ? (duel.role === 'pasangan' ? 'f' : 'm') : 'f';
  const otherId = myId === 'f' ? 'm' : 'f';
  const host = !duel || myId === 'f';
  const rng = seeded(p.seed || 4242);

  // ---- Tampilan: kanvas + joystick + 2 tombol ----
  const wrap = document.createElement('div');
  wrap.className = 'fight-wrap';
  stage.appendChild(wrap);
  const view = document.createElement('div');
  view.className = 'fight-view';
  wrap.appendChild(view);
  const canvas = document.createElement('canvas');
  canvas.className = 'catch-canvas';
  view.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const pad = document.createElement('div');
  pad.className = 'fight-pad pw-pad';
  pad.innerHTML = `<div class="pw-stick"><span></span></div><button data-k="book" data-label="Resep" class="ck-book" aria-label="Buku resep">📖</button><div class="fp-act"><button data-k="chop" data-label="Potong" class="ck-chop" aria-label="Potong">🔪</button><button data-k="use" data-label="Ambil/Taruh" class="ck-use" aria-label="Ambil / taruh">✋</button></div>`;
  wrap.appendChild(pad);
  const knob = pad.querySelector('.pw-stick span');

  let W = 0, H = 0, T = 40, ox = 0, oy = 0;
  const ORD_H = 78;
  function resize() {
    const r = view.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    T = Math.floor(Math.min((W - 8) / COLS, (H - ORD_H - 8) / ROWS));
    ox = (W - T * COLS) / 2; oy = ORD_H + (H - ORD_H - T * ROWS) / 2;
  }
  resize();

  // ---- Dunia ----
  const tiles = MAP.map((row) => [...row].map(() => ({ obj: null, n: 0 }))); // n = progres potong / waktu masak
  const chefs = {
    f: { x: 2.5, y: 7.5, fx: 0, fy: -1, hold: null, img: loadImage(myId === 'f' ? p.face : p.oppFace), emoji: myId === 'f' ? (p.emoji || '😊') : (p.oppEmoji || '😊'), name: myId === 'f' ? (p.name || 'Kamu') : (p.oppName || '') },
    m: { x: 4.5, y: 7.5, fx: 0, fy: -1, hold: null, img: loadImage(myId === 'm' ? p.face : p.oppFace), emoji: myId === 'm' ? (p.emoji || '😊') : (p.oppEmoji || '😊'), name: myId === 'm' ? (p.name || 'Kamu') : (p.oppName || '') },
  };
  if (!duel) { chefs.f.x = 3.5; chefs.f.y = 7.5; }
  const me = chefs[myId], other = chefs[otherId];
  let orders = [], served = 0, miss = 0, nextId = 1, clock = 0, nextOrder = 2, over = false, done = false;
  let floats = [], lastStats = '', raf = 0, last = performance.now(), lastPos = 0, lastSnap = 0;
  const offs = [];

  function say(t, color = '#c2306f') { floats.push({ x: me.x, y: me.y - 0.6, t, color, life: 1.4 }); }

  // ---- Aturan dapur (dijalankan di host / main sendiri) ----
  function use(id, tx, ty) {
    const c = chefs[id], kind = kindAt(tx, ty);
    if (kind === '.') return;
    const tl = tiles[ty][tx], h = c.hold;
    const fb = (t) => { if (id === myId) say(t); else if (duel) duel.send('ckmsg', { m: t }); };
    if (CRATE[kind]) { if (!h) { c.hold = { k: CRATE[kind], s: 'raw' }; api.sfx('click'); } return; }
    if (kind === 'P') { if (!h) { c.hold = { k: 'plate', items: [] }; api.sfx('click'); } return; }
    if (kind === 'X') { if (h?.k === 'plate') h.items = []; else c.hold = null; api.sfx('bad'); return; }
    if (kind === 'W') {
      if (h?.k !== 'plate' || !h.items.length) { fb('Antar pakai piring yang udah keisi 🍽️'); return; }
      const o = [...orders].sort((a, b) => a.left - b.left).find((x) => sameDish(h.items, RECIPES[x.r].need));
      if (!o) { fb('Nggak ada pesanan kayak gini 🤔'); api.sfx('bad'); return; }
      orders = orders.filter((x) => x !== o); served++; c.hold = null;
      api.sfx('win'); api.streak(true);
      floats.push({ x: tx + 0.5, y: ty, t: `${RECIPES[o.r].em} +1`, color: '#2fbf71', life: 1.6 });
      return;
    }
    // meja biasa, talenan (B), kompor (S)
    if (!h) { if (tl.obj) { c.hold = tl.obj; tl.obj = null; tl.n = 0; api.sfx('click'); } return; }
    if (!tl.obj) {
      if (kind === 'B' && (h.k === 'plate' || h.s !== 'raw' || !CHOP.includes(h.k))) { fb(h.k === 'plate' ? 'Talenan buat motong sayur 🔪' : `${E[h.k] || ''} nggak perlu dipotong`); return; }
      if (kind === 'S' && (h.k === 'plate' || h.s !== 'raw' || !COOK.includes(h.k))) { fb(h.k === 'plate' ? 'Kompor buat masak 🔥' : `${E[h.k] || ''} nggak dimasak`); return; }
      tl.obj = h; tl.n = 0; c.hold = null; api.sfx('pop'); return;
    }
    // tuker isi piring
    if (h.k === 'plate' && tl.obj.k !== 'plate') {
      if (!final(tl.obj)) { fb(tl.obj.s === 'gosong' ? 'Gosong 🔥 buang aja' : 'Belum siap, potong / masak dulu'); return; }
      if (h.items.length >= 3) { fb('Piringnya penuh'); return; }
      h.items.push(tl.obj); tl.obj = null; tl.n = 0; api.sfx('pop'); return;
    }
    if (tl.obj.k === 'plate' && h.k !== 'plate') {
      if (!final(h)) { fb(h.s === 'gosong' ? 'Gosong 🔥 buang aja' : 'Belum siap, potong / masak dulu'); return; }
      if (tl.obj.items.length >= 3) { fb('Piringnya penuh'); return; }
      tl.obj.items.push(h); c.hold = null; api.sfx('pop'); return;
    }
    fb('Mejanya udah ada isinya');
  }
  function chop(id, tx, ty) {
    if (kindAt(tx, ty) !== 'B') return;
    const tl = tiles[ty][tx];
    if (!tl.obj || tl.obj.s !== 'raw' || !CHOP.includes(tl.obj.k) || chefs[id].hold) return;
    tl.n++;
    api.sfx('flip');
    if (tl.n >= CHOP_N) { tl.obj.s = 'potong'; tl.n = 0; api.sfx('good'); }
  }
  function tickWorld(dt) {
    clock += dt;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (MAP[y][x] !== 'S') continue;
      const tl = tiles[y][x]; if (!tl.obj) continue;
      tl.n += dt;
      if (tl.obj.s === 'raw' && tl.n >= COOK_T) { tl.obj.s = 'masak'; api.sfx('good'); }
      if (tl.obj.s === 'masak' && tl.n >= COOK_T + BURN_T) { tl.obj.s = 'gosong'; api.sfx('bad'); floats.push({ x: x + 0.5, y, t: 'Gosong! 🔥', color: '#444', life: 1.6 }); }
    }
    for (const o of orders) o.left -= dt;
    const gone = orders.filter((o) => o.left <= 0);
    if (gone.length) { orders = orders.filter((o) => o.left > 0); miss += gone.length; api.sfx('bad'); api.streak(false); floats.push({ x: 3.5, y: 1, t: 'Pelanggan kabur 🥲', color: '#ff4d6d', life: 1.8 }); }
    if (clock >= nextOrder && orders.length < 4) {
      const keys = Object.keys(RECIPES);
      const r = keys[Math.floor(rng() * keys.length)];
      orders.push({ id: nextId++, r, left: duel ? 75 : 65, max: duel ? 75 : 65 });
      nextOrder = clock + Math.max(duel ? 9 : 11, (duel ? 17 : 21) - served * 0.7);
      api.sfx('msg');
    }
    if (miss >= MAX_MISS && !over) { over = true; setTimeout(end, 1200); }
    if (p.goal && !duel && served >= p.goal && !over) { over = true; api.sfx('win'); setTimeout(end, 1000); }
  }

  // ---- Online ----
  const pack = () => {
    const tl = [];
    tiles.forEach((row, y) => row.forEach((t, x) => { if (t.obj || t.n) tl.push([y * COLS + x, t.obj, +t.n.toFixed(2)]); }));
    return { tl, hf: chefs.f.hold, hm: chefs.m.hold, o: orders.map((o) => [o.id, o.r, Math.round(o.left), o.max]), sv: served, ms: miss, ov: over ? 1 : 0 };
  };
  function snap(force) {
    if (!duel || !host) return;
    const now = performance.now();
    if (!force && now - lastSnap < 150) return;
    lastSnap = now;
    duel.send('cks', pack());
  }
  if (duel) {
    offs.push(duel.on('ckp', (d) => { other.tx = d.x; other.ty = d.y; other.fx = d.fx; other.fy = d.fy; }));
    if (host) offs.push(duel.on('cki', (d) => { if (over) return; if (d.a === 'use') use(otherId, d.x, d.y); else chop(otherId, d.x, d.y); snap(true); }));
    else {
      offs.push(duel.on('cks', (d) => {
        tiles.forEach((row) => row.forEach((t) => { t.obj = null; t.n = 0; }));
        for (const [i, obj, n] of d.tl) { const t = tiles[Math.floor(i / COLS)][i % COLS]; t.obj = obj; t.n = n; }
        chefs.f.hold = d.hf; chefs.m.hold = d.hm;
        if (d.sv > served) { api.sfx('win'); floats.push({ x: 6, y: 7, t: 'Kesaji! +1', color: '#2fbf71', life: 1.6 }); }
        if (d.ms > miss) api.sfx('bad');
        orders = d.o.map(([id, r, left, max]) => ({ id, r, left, max })); served = d.sv; miss = d.ms;
        if (d.ov && !over) { over = true; setTimeout(end, 1200); }
      }));
      offs.push(duel.on('ckmsg', (d) => say(d.m)));
    }
  }

  // ---- Input ----
  const stick = { x: 0, y: 0, id: null };
  const stickEl = pad.querySelector('.pw-stick');
  function stickAt(e) {
    const r = stickEl.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    stick.x = dx; stick.y = dy;
    knob.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`;
  }
  stickEl.addEventListener('pointerdown', (e) => { e.preventDefault(); stick.id = e.pointerId; try { stickEl.setPointerCapture(e.pointerId); } catch {} stickAt(e); });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) stickAt(e); });
  const release = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  stickEl.addEventListener('pointerup', release);
  stickEl.addEventListener('pointercancel', release);
  let chopping = false, chopT = 0;
  pad.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    e.preventDefault(); b.classList.add('on');
    if (b.dataset.k === 'book') { openBook(); return; }
    if (b.dataset.k === 'use') act('use'); else { chopping = true; chopT = 0; act('chop'); }
  });
  const upBtn = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; b.classList.remove('on'); if (b.dataset.k === 'chop') chopping = false; };
  pad.addEventListener('pointerup', upBtn);
  pad.addEventListener('pointercancel', upBtn);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  const keys = {};
  const onKey = (e) => {
    const down = e.type === 'keydown';
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(e.key)) { e.preventDefault(); keys[e.key] = down; }
    if (down && !e.repeat && (e.key === ' ' || e.key === 'j')) { e.preventDefault(); act('use'); }
    if (e.key === 'k') { chopping = down; if (down && !e.repeat) act('chop'); }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('resize', resize);

  // ---- Buku resep (muncul di awal & bisa dibuka lagi lewat 📖) ----
  const STEP = { potong: '🔪 potong', masak: '🔥 masak', raw: 'langsung' };
  let bookOpen = false;
  const book = document.createElement('div');
  book.className = 'ck-bookview';
  book.innerHTML = `<div class="ck-bookcard"><h3>📖 Cara Masak</h3>
    <ol class="ck-how">
      <li><b>Ambil bahan</b> dari peti (kotak kayu) pakai ✋</li>
      <li><b>Olah bahannya:</b> sayur ditaruh di <b>talenan</b> lalu tahan 🔪 <b>Potong</b>. Daging, nasi &amp; telur ditaruh di <b>kompor</b>, tunggu sampai <b>matang</b> (jangan kelamaan, nanti gosong!)</li>
      <li><b>Ambil piring</b> 🍽️, taruh di meja, terus masukin bahan yang udah jadi satu-satu</li>
      <li><b>Antar piringnya</b> ke 🛎️ <b>SAJI</b></li>
    </ol>
    <div class="ck-recipes">${Object.values(RECIPES).map((R) => `<div class="ck-rec"><span class="ck-dish">${R.em}</span><div><b>${R.name}</b><div class="ck-ing">${R.need.map((n) => { const [k, st] = n.split(':'); return `<span>${E[k]} ${k} <i class="st-${st}">${STEP[st]}</i></span>`; }).join('')}</div></div></div>`).join('')}</div>
    <p class="ck-tipline">Bingung? Ikutin <b>panah 👇</b> & petunjuk di bawah dapur, nanti dikasih tau langkah berikutnya.</p>
    <button class="btn btn-primary ck-go">Siap masak! 👩‍🍳</button></div>`;
  view.appendChild(book);
  function openBook() { bookOpen = true; book.classList.add('show'); }
  book.querySelector('.ck-go').addEventListener('click', () => { bookOpen = false; book.classList.remove('show'); api.sfx('go'); });
  openBook();

  // Petunjuk langkah berikutnya buat koki kita: { text, tile }
  function nearest(pred) {
    let best = null, bd = 1e9;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!pred(MAP[y][x], tiles[y][x], x, y)) continue;
      // meja harus bisa dicapai (ada lantai di sebelahnya)
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => walkable(x + dx, y + dy))) continue;
      const d = Math.hypot(x + 0.5 - me.x, y + 0.5 - me.y);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  const emptyCounter = () => nearest((k, t) => k === '#' && !t.obj);
  const plateTile = () => nearest((k, t) => t.obj?.k === 'plate');
  function guide() {
    const h = me.hold;
    if (h?.k === 'plate') {
      if (h.items.length && orders.some((o) => sameDish(h.items, RECIPES[o.r].need))) return { text: 'Piringnya udah lengkap! Antar ke 🛎️ SAJI', tile: nearest((k) => k === 'W') };
      return { text: 'Taruh piringnya di meja kosong, terus isi bahan yang udah jadi', tile: emptyCounter() };
    }
    if (h) {
      if (h.s === 'gosong') return { text: 'Yahh gosong 🔥 buang ke tempat sampah 🗑️', tile: nearest((k) => k === 'X') };
      if (h.s === 'raw' && CHOP.includes(h.k)) return { text: `Taruh ${E[h.k]} di talenan, lalu tahan 🔪 Potong`, tile: nearest((k, t) => k === 'B' && !t.obj) };
      if (h.s === 'raw' && COOK.includes(h.k)) return { text: `Taruh ${E[h.k]} di kompor 🔥, tunggu sampai matang`, tile: nearest((k, t) => k === 'S' && !t.obj) };
      const pl = plateTile();
      if (pl) return { text: `${E[h.k]} udah siap! Masukin ke piring 🍽️`, tile: pl };
      return { text: `Taruh ${E[h.k]} di meja dulu, terus ambil piring 🍽️`, tile: emptyCounter() };
    }
    // tangan kosong
    const chopIt = nearest((k, t) => k === 'B' && t.obj && t.obj.s === 'raw');
    if (chopIt) return { text: 'Tahan 🔪 Potong di talenan sampai kepotong', tile: chopIt, chop: true };
    const burnt = nearest((k, t) => t.obj && t.obj.s === 'gosong');
    if (burnt) return { text: 'Ada yang gosong 🔥 ambil & buang ke 🗑️', tile: burnt };
    const cooked = nearest((k, t) => k === 'S' && t.obj && t.obj.s === 'masak');
    if (cooked) return { text: 'Udah matang! Ambil dari kompor sebelum gosong ⚠️', tile: cooked };
    if (!orders.length) return { text: 'Tunggu pesanan dateng ya 👀', tile: null };
    const full = nearest((k, t) => t.obj?.k === 'plate' && t.obj.items.length && orders.some((o) => sameDish(t.obj.items, RECIPES[o.r].need)));
    if (full) return { text: 'Piringnya lengkap! Ambil lalu antar ke 🛎️', tile: full };
    // bahan apa yang masih kurang buat pesanan paling mepet?
    const o = [...orders].sort((a, b) => a.left - b.left)[0], R = RECIPES[o.r];
    const have = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const ob = tiles[y][x].obj; if (!ob) continue; if (ob.k === 'plate') have.push(...ob.items.map((i) => i.k)); else if (ob.s !== 'gosong') have.push(ob.k); }
    if (duel && other.hold) { if (other.hold.k === 'plate') have.push(...other.hold.items.map((i) => i.k)); else have.push(other.hold.k); }
    const missing = R.need.map((n) => n.split(':')[0]).filter((k) => { const i = have.indexOf(k); if (i < 0) return true; have.splice(i, 1); return false; });
    if (missing.length) { const k = missing[0], crate = Object.keys(CRATE).find((c) => CRATE[c] === k); return { text: `Buat ${R.em} ${R.name}: ambil ${E[k]} dari peti`, tile: nearest((kk) => kk === crate) }; }
    if (!plateTile()) return { text: 'Ambil piring 🍽️ terus taruh di meja', tile: nearest((k) => k === 'P') };
    const ready = nearest((k, t) => t.obj && t.obj.k !== 'plate' && final(t.obj) && k !== 'S');
    if (ready) return { text: `Ambil ${E[ready && tiles[ready[1]][ready[0]].obj.k]} terus masukin ke piring 🍽️`, tile: ready };
    return { text: 'Tunggu masakannya matang 🔥 sambil siapin yang lain', tile: null };
  }
  let tip = { text: '', tile: null }, tipT = 0;

  // Meja yang lagi dihadap koki (selangkah di depannya)
  function target(c) {
    const cand = [[Math.floor(c.x + c.fx * 0.75), Math.floor(c.y + c.fy * 0.75)]];
    if (Math.abs(c.fx) > Math.abs(c.fy)) cand.push([Math.floor(c.x + Math.sign(c.fx) * 0.75), Math.floor(c.y)]);
    else cand.push([Math.floor(c.x), Math.floor(c.y + Math.sign(c.fy || -1) * 0.75)]);
    return cand.find(([x, y]) => !walkable(x, y)) || null;
  }
  function act(a) {
    if (over) return;
    const tg = target(me); if (!tg) return;
    if (!duel || host) { a === 'use' ? use(myId, tg[0], tg[1]) : chop(myId, tg[0], tg[1]); snap(true); }
    else duel.send('cki', { a, x: tg[0], y: tg[1] });
  }

  // ---- Gerak ----
  function free(x, y) {
    return [[-CR, -CR], [CR, -CR], [-CR, CR], [CR, CR]].every(([dx, dy]) => walkable(Math.floor(x + dx), Math.floor(y + dy)));
  }
  function moveMe(dt) {
    let mx = stick.x + ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
    let my = stick.y + ((keys.ArrowDown || keys.s) ? 1 : 0) - ((keys.ArrowUp || keys.w) ? 1 : 0);
    const m = Math.hypot(mx, my);
    if (m < 0.15) return;
    if (m > 1) { mx /= m; my /= m; }
    me.fx = mx / Math.max(m, 1e-3); me.fy = my / Math.max(m, 1e-3);
    const nx = me.x + mx * SPEED * dt, ny = me.y + my * SPEED * dt;
    if (free(nx, me.y)) me.x = nx;
    if (free(me.x, ny)) me.y = ny;
    if (duel) { const d = Math.hypot(me.x - other.x, me.y - other.y); if (d < 0.62 && d > 0) { const k = (0.62 - d) / d; const px = me.x + (me.x - other.x) * k, py = me.y + (me.y - other.y) * k; if (free(px, py)) { me.x = px; me.y = py; } } }
  }

  // ---- Gambar ----
  const X = (x) => ox + x * T, Y = (y) => oy + y * T;
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function drawItem(it, cx, cy, size) {
    if (!it) return;
    if (it.k === 'plate') {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e3d6dc'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, size * 0.5, size * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      it.items.forEach((x, i) => drawEmoji(ctx, E[x.k], cx + (i - (it.items.length - 1) / 2) * size * 0.3, cy - (i % 2) * size * 0.08, size * 0.45));
      return;
    }
    ctx.save();
    if (it.s === 'gosong') ctx.filter = 'brightness(.35) saturate(.4)';
    drawEmoji(ctx, E[it.k], cx, cy, size * (it.s === 'potong' ? 0.72 : 0.8));
    ctx.restore();
    if (it.s === 'potong') drawEmoji(ctx, E[it.k], cx + size * 0.18, cy + size * 0.12, size * 0.5);
    if (LABEL[it.s]) {
      ctx.font = `700 ${Math.max(8, Math.round(size * 0.22))}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(LABEL[it.s]).width + 8;
      ctx.fillStyle = it.s === 'gosong' ? '#444' : it.s === 'masak' ? '#ff8a3d' : '#2fbf71';
      rr(cx - w / 2, cy + size * 0.32, w, size * 0.3, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(LABEL[it.s], cx, cy + size * 0.47);
    }
  }
  function bar(x, y, w, v, c1, c2) {
    ctx.fillStyle = 'rgba(255,255,255,.9)'; rr(x, y, w, 6, 3); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; rr(x, y, Math.max(3, w * Math.max(0, Math.min(1, v))), 6, 3); ctx.fill();
  }
  function drawTile(x, y) {
    const kind = MAP[y][x], px = X(x), py = Y(y), tl = tiles[y][x];
    if (kind === '.') { ctx.fillStyle = (x + y) % 2 ? '#fff6fa' : '#ffeaf3'; ctx.fillRect(px, py, T, T); return; }
    // meja: bagian atas + sisi depan
    ctx.fillStyle = '#c98b5e'; rr(px + 1, py + 3, T - 2, T - 2, 6); ctx.fill();
    ctx.fillStyle = kind === 'S' ? '#5b5566' : kind === 'W' ? '#ffd36e' : '#f3cfa6'; rr(px + 1, py + 1, T - 2, T - 6, 6); ctx.fill();
    const cx = px + T / 2, cy = py + T / 2 - 2;
    if (CRATE[kind]) {
      ctx.fillStyle = '#e0a868'; rr(px + 5, py + 5, T - 10, T - 14, 4); ctx.fill();
      ctx.strokeStyle = '#b97c45'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + 5, cy); ctx.lineTo(px + T - 5, cy); ctx.stroke();
      drawEmoji(ctx, E[CRATE[kind]], cx, cy - 1, T * 0.62);
      return;
    }
    if (kind === 'B') { ctx.fillStyle = '#fbe7c9'; rr(px + 4, py + 6, T - 8, T - 16, 5); ctx.fill(); if (!tl.obj) drawEmoji(ctx, '🔪', cx, cy, T * 0.45); }
    if (kind === 'S') {
      ctx.fillStyle = '#2f2b36'; ctx.beginPath(); ctx.arc(cx, cy, T * 0.34, 0, Math.PI * 2); ctx.fill();
      if (tl.obj && tl.obj.s !== 'gosong') drawEmoji(ctx, '🔥', cx, cy + T * 0.22, T * 0.36);
      drawEmoji(ctx, '🍳', cx, cy, T * 0.62);
    }
    if (kind === 'P') { for (let i = 0; i < 3; i++) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e3d6dc'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy + 4 - i * 4, T * 0.32, T * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } }
    if (kind === 'X') drawEmoji(ctx, '🗑️', cx, cy, T * 0.62);
    if (kind === 'W') { drawEmoji(ctx, '🛎️', cx, cy - 2, T * 0.55); ctx.fillStyle = '#c2306f'; ctx.font = `700 ${Math.round(T * 0.2)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('SAJI', cx, py + T - 6); }
    if (tl.obj) drawItem(tl.obj, cx, cy, T * 0.86);
    if (kind === 'B' && tl.obj && tl.obj.s === 'raw' && tl.n > 0) bar(px + 4, py + T - 12, T - 8, tl.n / CHOP_N, '#2fbf71', '#9be15d');
    if (kind === 'S' && tl.obj) {
      if (tl.obj.s === 'raw') bar(px + 4, py + T - 12, T - 8, tl.n / COOK_T, '#ffb020', '#ff6f3c');
      else if (tl.obj.s === 'masak') { bar(px + 4, py + T - 12, T - 8, 1 - (tl.n - COOK_T) / BURN_T, '#ff4d6d', '#ffb020'); if (tl.n - COOK_T > BURN_T * 0.55 && Math.floor(clock * 4) % 2) drawEmoji(ctx, '⚠️', px + T - 8, py + 8, T * 0.32); }
    }
  }
  function drawChef(c, isMe) {
    const cx = X(c.x), cy = Y(c.y), r = T * 0.36;
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.9, r * 1.05, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    // badan (baju koki)
    ctx.fillStyle = '#fff'; ctx.strokeStyle = isMe ? '#ff8fb7' : '#9fb4ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.45, r * 0.95, r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawFace(ctx, c.img, cx, cy - r * 0.15, r * 0.82, c.emoji, isMe ? '#ff8fb7' : '#9fb4ff');
    // topi koki
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e8e0e6'; ctx.lineWidth = 1.5;
    for (const [dx, dy, rr2] of [[-0.42, -1.12, 0.36], [0, -1.28, 0.42], [0.42, -1.12, 0.36]]) { ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, rr2 * r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.fillRect(cx - r * 0.62, cy - r * 1.02, r * 1.24, r * 0.3);
    // yang dipegang
    if (c.hold) drawItem(c.hold, cx + c.fx * r * 1.05, cy + c.fy * r * 0.8 + r * 0.25, T * 0.7);
    if (duel && !isMe) { ctx.fillStyle = '#6a2c52'; ctx.font = `600 ${Math.round(T * 0.24)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(c.name, cx, cy + r * 1.55); }
  }
  function drawOrders() {
    ctx.fillStyle = 'rgba(255,255,255,.6)'; rr(4, 4, W - 8, ORD_H - 8, 14); ctx.fill();
    if (!orders.length) { ctx.fillStyle = '#8a3f6e'; ctx.font = '600 15px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Nunggu pesanan… 👀', W / 2, ORD_H / 2); return; }
    const cw = Math.min(118, (W - 16) / 4 - 6);
    orders.forEach((o, i) => {
      const R = RECIPES[o.r], x = 10 + i * (cw + 6), y = 9, h = ORD_H - 18;
      const late = o.left < 15;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = late ? '#ff4d6d' : '#ffd3e4'; ctx.lineWidth = 2;
      rr(x + (late ? Math.sin(clock * 30) * 1.5 : 0), y, cw, h, 12); ctx.fill(); ctx.stroke();
      drawEmoji(ctx, R.em, x + 18, y + 18, 26);
      ctx.fillStyle = '#5a2a52'; ctx.font = `700 ${cw < 100 ? 11 : 12}px Fredoka, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(R.name, x + 34, y + 18, cw - 38);
      // tiap bahan + cara olahnya (🔪 dipotong, 🔥 dimasak)
      R.need.forEach((n, j) => { const [k, s] = n.split(':'); const ix = x + 12 + j * Math.min(30, (cw - 16) / 3); drawEmoji(ctx, E[k], ix + 6, y + 39, 19); if (s !== 'raw') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ix + 15, y + 47, 7, 0, Math.PI * 2); ctx.fill(); drawEmoji(ctx, s === 'masak' ? '🔥' : '🔪', ix + 15, y + 47, 11); } });
      bar(x + 6, y + h - 10, cw - 12, o.left / (o.max || 60), '#ff6f9f', '#ffb020');
    });
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fbe3ee'; ctx.fillRect(0, 0, W, H);
    drawOrders();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawTile(x, y);
    const tg = target(me);
    if (tg && !over) { ctx.strokeStyle = `rgba(255,111,159,${0.6 + Math.sin(clock * 8) * 0.3})`; ctx.lineWidth = 3; rr(X(tg[0]) + 1, Y(tg[1]) + 1, T - 2, T - 4, 7); ctx.stroke(); }
    if (!over && tip.tile) { // kotak hijau + panah mantul di meja tujuan
      const [gx, gy] = tip.tile, bob = Math.sin(clock * 6) * 4;
      ctx.strokeStyle = 'rgba(47,191,113,.95)'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); rr(X(gx) + 2, Y(gy) + 2, T - 4, T - 6, 8); ctx.stroke(); ctx.setLineDash([]);
      drawEmoji(ctx, '👇', X(gx) + T / 2, Y(gy) - T * 0.28 + bob, T * 0.5);
    }
    const list = duel ? [other, me] : [me];
    list.sort((a, b) => a.y - b.y).forEach((c) => drawChef(c, c === me));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.font = '700 15px Fredoka, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff';
      ctx.strokeText(f.t, X(f.x), Y(f.y)); ctx.fillStyle = f.color; ctx.fillText(f.t, X(f.x), Y(f.y));
    }
    ctx.globalAlpha = 1;
    if (!over && tip.text) { // pita petunjuk di bawah dapur
      ctx.font = `600 ${Math.max(12, Math.round(T * 0.3))}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = Math.min(W - 12, ctx.measureText(tip.text).width + 44), ty = Math.min(H - 20, Y(ROWS) - T * 0.45);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#2fbf71'; ctx.lineWidth = 2; rr(W / 2 - tw / 2, ty - 16, tw, 32, 16); ctx.fill(); ctx.stroke();
      drawEmoji(ctx, '💡', W / 2 - tw / 2 + 17, ty, 18);
      ctx.fillStyle = '#25734a'; ctx.fillText(tip.text, W / 2 + 10, ty + 1, tw - 40);
    }
    pad.querySelector('.ck-chop').style.opacity = tg && MAP[tg[1]][tg[0]] === 'B' ? 1 : 0.5;
    const s = `🍳 Kesaji ${served}${p.goal && !duel ? `/${p.goal}` : ''} · ${'❤️'.repeat(Math.max(0, MAX_MISS - miss))}${'🤍'.repeat(Math.min(MAX_MISS, miss))}${!duel && !p.goal ? ` · 🏆 ${Math.max(p.best || 0, served)}` : ''}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const paused = bookOpen && !duel;
    if (!over && !bookOpen) moveMe(dt);
    tipT -= dt; if (tipT <= 0) { tipT = 0.25; tip = guide(); }
    if (duel && other.tx != null) { other.x += (other.tx - other.x) * Math.min(1, dt * 12); other.y += (other.ty - other.y) * Math.min(1, dt * 12); }
    if (chopping) { chopT += dt; if (chopT > 0.14) { chopT = 0; act('chop'); } }
    if (paused) clock += 0; else if (host && !over) tickWorld(dt); else clock += dt;
    if (!host) for (const o of orders) o.left -= dt;
    for (const f of floats) { f.y -= dt * 0.6; f.life -= dt; }
    floats = floats.filter((f) => f.life > 0);
    if (duel && now - lastPos > 110) { lastPos = now; duel.send('ckp', { x: +me.x.toFixed(2), y: +me.y.toFixed(2), fx: +me.fx.toFixed(2), fy: +me.fy.toFixed(2) }); }
    snap(false);
    draw();
  }
  if (window.__lqTest) window.__cook = { chefs, tiles, me, act, guide, closeBook: () => book.querySelector('.ck-go').click(), get orders() { return orders; }, get served() { return served; } };
  raf = requestAnimationFrame(loop);
  api.say(duel
    ? `Masak bareng ${p.oppName}! Ikutin panah 👇 & petunjuk hijau di bawah dapur. 📖 buat lihat resep.`
    : 'Ikutin panah 👇 & petunjuk hijau di bawah dapur ya! 📖 buat lihat resep lagi.', 'happy');

  function end() {
    if (done) return;
    done = true;
    if (p.goal && !duel) { const win = served >= p.goal; api.finish({ win, stars: win ? [3, 2, 1][Math.min(2, miss)] : 0, detail: win ? `Nyajiin ${served} pesanan${miss ? `, ${miss} pelanggan kabur` : ' tanpa ada yang kabur 🌟'}` : `Baru ${served} dari ${p.goal} pesanan` }); return; }
    api.finish(duel ? { win: served > 0, served } : { win: true, score: served, detail: `Nyajiin ${served} pesanan 🍳` });
  }

  return {
    destroy() {
      done = true; over = true;
      cancelAnimationFrame(raf);
      offs.forEach((f) => f());
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('resize', resize);
    },
  };
}
