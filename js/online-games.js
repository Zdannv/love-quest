// Game-game Main Bareng. Tiap game dapet `ctx` dari main.js:
//   ctx.seed, ctx.me {role, name, face, emoji}, ctx.peer {role, name, face, emoji},
//   ctx.send(type, data), ctx.on(type, fn) → fungsi buat berhenti dengerin, ctx.params (isi dari game biasa)
// Dua HP pakai seed yang sama, jadi urutan soal / kartu / kepingan sama persis.
import { startFly } from './games/fly.js';
import { esc } from './util.js';

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleWith(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const ava = (p) => (p.face ? `<img src="${esc(p.face)}" alt="">` : `<span>${p.emoji}</span>`);

// ---------- Terbang Balapan ----------
function startFlyRace(stage, api, ctx) {
  let peerState = { y: 0.45, passed: 0, alive: true };
  let mine = null, lastSent = 0, shown = false;
  const offs = [ctx.on('fly', (d) => { peerState = d; check(); })];
  function check() {
    if (shown || !mine || peerState.alive) return;
    shown = true;
    const a = mine.passed, b = peerState.passed;
    api.finish({
      win: a >= b,
      icon: a > b ? '🏆' : a === b ? '🤝' : '🥈',
      title: a > b ? 'Kamu menang!' : a === b ? 'Seri, kompak banget!' : `${ctx.peer.name} menang!`,
      detail: `Kamu lewat ${a} tiang · ${ctx.peer.name} lewat ${b} tiang`,
    });
  }
  const game = startFly(stage, {
    ...ctx.params, target: 999, rng: seeded(ctx.seed), face: ctx.me.face, flyer: ctx.me.emoji,
    race: {
      name: ctx.peer.name, face: ctx.peer.face, emoji: ctx.peer.emoji,
      ghost: () => peerState,
      tick(state, force) {
        const now = performance.now();
        if (!force && now - lastSent < 120) return;
        lastSent = now;
        ctx.send('fly', state);
      },
    },
  }, {
    ...api,
    finish: (r) => {
      mine = r;
      api.say(peerState.alive ? `Nunggu ${ctx.peer.name} selesai terbang… 👀` : 'Yuk liat hasilnya!', 'happy');
      check();
    },
  });
  return { destroy() { offs.forEach((f) => f()); game.destroy(); } };
}

// ---------- Tebak Pasangan ----------
const TEBAK = [
  ['Liburan impian', ['Pantai 🏖️', 'Gunung ⛰️', 'Kota 🏙️', 'Rebahan di rumah 🛋️']],
  ['Makanan kalau lagi bad mood', ['Mie instan 🍜', 'Martabak 🥞', 'Es krim 🍦', 'Seblak 🌶️']],
  ['Kencan paling asik', ['Nonton film 🎬', 'Kulineran 🍢', 'Jalan-jalan sore 🌇', 'Ngobrol di rumah 🏠']],
  ['Minuman favorit', ['Kopi ☕', 'Teh 🍵', 'Boba 🧋', 'Air putih aja 💧']],
  ['Kalau lagi capek, pengennya', ['Tidur 😴', 'Dipeluk 🤗', 'Makan enak 🍱', 'Nonton 📺']],
  ['Genre film favorit', ['Horor 👻', 'Romantis 💕', 'Komedi 😂', 'Action 💥']],
  ['Waktu paling semangat', ['Pagi 🌅', 'Siang ☀️', 'Sore 🌇', 'Tengah malem 🌙']],
  ['Hewan favorit', ['Kucing 🐱', 'Anjing 🐶', 'Kelinci 🐰', 'Panda 🐼']],
  ['Cara nunjukin sayang', ['Kata-kata 💬', 'Pelukan 🤗', 'Hadiah 🎁', 'Nemenin 🫶']],
  ['Cuaca favorit', ['Hujan 🌧️', 'Cerah ☀️', 'Mendung ☁️', 'Malem dingin 🌙']],
  ['Kalau lagi kesel, biasanya', ['Diem dulu 🤐', 'Langsung ngomong 🗣️', 'Nangis 🥲', 'Ngambek 😤']],
  ['Jajanan favorit', ['Cilok 🍡', 'Batagor 🥟', 'Gorengan 🍤', 'Roti bakar 🍞']],
  ['Warna favorit', ['Pink 🩷', 'Biru 💙', 'Hijau 💚', 'Hitam 🖤']],
  ['Hal yang paling bikin bete', ['Nunggu lama ⏳', 'Dicuekin 😶', 'Laper 😫', 'Macet 🚗']],
  ['Negara yang pengen didatengin', ['Jepang 🗾', 'Korea 🇰🇷', 'Turki 🕌', 'Eropa 🏰']],
  ['Kebiasaan sebelum tidur', ['Main HP 📱', 'Dengerin lagu 🎧', 'Nonton 📺', 'Langsung tidur 😴']],
  ['Superpower pilihan', ['Teleport ✨', 'Baca pikiran 🧠', 'Menghilang 👻', 'Terbang 🕊️']],
  ['Sarapan favorit', ['Nasi uduk 🍚', 'Roti 🍞', 'Bubur 🥣', 'Skip sarapan 🙈']],
  ['Paling nggak bisa hidup tanpa', ['HP 📱', 'Musik 🎵', 'Kopi ☕', 'Kasur 🛏️']],
  ['Gaya liburan', ['Full itinerary 🗺️', 'Santai aja 🌿', 'Kulineran 🍜', 'Belanja 🛍️']],
];

const starsBy = (ratio, pass, two, three) => (ratio >= three ? 3 : ratio >= two ? 2 : ratio >= pass ? 1 : 0);

function startTebak(stage, api, ctx) {
  const lv = ctx.level?.params;
  const samaan = ctx.level?.type === 'samaan';
  const ROUNDS = lv?.rounds || 8;
  const rng = seeded(ctx.seed);
  const qs = shuffleWith(rng, [...TEBAK]).slice(0, ROUNDS);
  const answers = {}; // answers[r] = { pasangan: k, pengirim: k }
  let r = 0, score = 0, done = false, timer = 0;
  const box = document.createElement('div');
  box.className = 'quiz ol-tebak';
  stage.appendChild(box);
  const off = ctx.on('tebak', (d) => { (answers[d.r] ||= {})[ctx.peer.role] = d.k; if (d.r === r) maybeReveal(); });

  const subjectRole = (i) => (i % 2 === 0 ? 'pasangan' : 'pengirim');
  const person = (role) => (role === ctx.me.role ? ctx.me : ctx.peer);

  function render() {
    const [q, opts] = qs[r];
    const subj = person(subjectRole(r));
    const iAmSubject = subj === ctx.me;
    api.setStats(`❓ ${r + 1}/${ROUNDS} · 💞 Kompak ${score}`);
    const who = samaan
      ? `<span class="ol-mini">${ava(ctx.me)}</span>Tanpa ngobrol, pilih yang sama!<span class="ol-mini">${ava(ctx.peer)}</span>`
      : `<span class="ol-mini">${ava(subj)}</span>${iAmSubject ? 'Jawab tentang kamu' : `Tebak jawaban ${esc(subj.name)}`}`;
    box.innerHTML = `
      <div class="quiz-card">
        <div class="ol-tebak-who">${who}</div>
        <div class="quiz-q">${esc(q)}?</div>
        <div class="quiz-opts">${opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>
        <div class="quiz-fb" aria-live="polite"></div>
      </div>`;
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.opt');
    if (!b || done || answers[r]?.[ctx.me.role] != null) return;
    const k = +b.dataset.k;
    (answers[r] ||= {})[ctx.me.role] = k;
    b.classList.add('picked');
    box.querySelectorAll('.opt').forEach((x) => (x.disabled = true));
    api.sfx('click');
    ctx.send('tebak', { r, k });
    box.querySelector('.quiz-fb').textContent = `Nunggu ${ctx.peer.name} jawab… 👀`;
    maybeReveal();
  });
  function maybeReveal() {
    const a = answers[r];
    if (!a || a.pasangan == null || a.pengirim == null) return;
    const subjRole = subjectRole(r);
    const truth = samaan ? a[ctx.peer.role] : a[subjRole];
    const guess = samaan ? a[ctx.me.role] : a[subjRole === 'pasangan' ? 'pengirim' : 'pasangan'];
    const ok = truth === guess;
    if (ok) score++;
    const btns = box.querySelectorAll('.opt');
    btns[truth]?.classList.add('right');
    if (!ok) btns[guess]?.classList.add('wrong');
    const fb = box.querySelector('.quiz-fb');
    fb.textContent = samaan
      ? (ok ? 'Samaan! Sehati banget 💞' : `Beda! ${ctx.peer.name} milih ${qs[r][1][truth]}`)
      : (ok ? 'Kompak! Tebakannya bener 💞' : `Meleset! Jawaban ${person(subjRole).name}: ${qs[r][1][truth]}`);
    fb.className = `quiz-fb ${ok ? 'ok' : 'nope'}`;
    api.sfx(ok ? 'good' : 'bad');
    api.setStats(`❓ ${r + 1}/${ROUNDS} · 💞 Kompak ${score}`);
    timer = setTimeout(() => {
      r++;
      if (r < ROUNDS) render();
      else finish();
    }, 2300);
  }
  function finish() {
    done = true;
    if (lv) {
      const ratio = score / ROUNDS;
      const stars = starsBy(ratio, lv.pass, lv.pass + 0.2, lv.pass + 0.4);
      api.finish({ win: stars > 0, stars, icon: stars ? '💞' : '🤭', title: `${samaan ? 'Samaan' : 'Kompak'} ${score}/${ROUNDS}`,
        detail: stars ? (stars === 3 ? 'Sehati parah! 💍' : 'Kompak! Lanjut ke level berikutnya 💞') : `Butuh minimal ${Math.ceil(ROUNDS * lv.pass)} yang cocok, coba lagi yuk 🤭` });
      return;
    }
    const label = score >= 7 ? 'Jodoh banget ini mah 💍' : score >= 5 ? 'Kompak parah! 💞' : score >= 3 ? 'Lumayan kenal lah ya 😆' : 'Kayaknya perlu lebih sering ngobrol nih 🤭';
    api.finish({ win: true, icon: score >= 5 ? '💞' : '🤭', title: `Kompak ${score}/${ROUNDS}`, detail: label });
  }
  render();
  return { destroy() { done = true; off(); clearTimeout(timer); } };
}

// ---------- Puzzle Bareng ----------
function startPuzzleTogether(stage, api, ctx) {
  const lv = ctx.level?.params;
  const n = lv?.size || 3, total = n * n;
  const rng = seeded(ctx.seed);
  let order;
  do { order = shuffleWith(rng, [...Array(total).keys()]); } while (order.every((v, i) => v === i));
  const p = ctx.params;
  const wrap = document.createElement('div');
  wrap.className = 'puzzle-wrap';
  wrap.style.setProperty('--ar', p.aspect || '3 / 4');
  wrap.innerHTML = `<div class="puzzle-board" style="--n:${n}"></div>`;
  stage.appendChild(wrap);
  const board = wrap.querySelector('.puzzle-board');
  const bgPos = (piece) => `${((piece % n) / (n - 1)) * 100}% ${(Math.floor(piece / n) / (n - 1)) * 100}%`;
  const slots = [...Array(total)].map((_, pos) => {
    const t = document.createElement('button');
    t.className = 'tile';
    t.style.backgroundImage = `url("${p.image}")`;
    t.style.backgroundSize = `${n * 100}% ${n * 100}%`;
    t.dataset.pos = pos;
    board.appendChild(t);
    return t;
  });
  let sel = -1, peerSel = -1, moves = 0, done = false;
  const t0 = performance.now();
  let tick = 0;
  if (lv) {
    tick = setInterval(() => {
      if (done) return;
      const left = lv.time - (performance.now() - t0) / 1000;
      if (left <= 0) {
        done = true;
        clearInterval(tick);
        api.finish({ win: false, stars: 0, icon: '⏰', title: 'Waktunya habis', detail: 'Hampir! Coba lagi, bagi tugas biar cepet 💪' });
      }
      paint();
    }, 500);
  }
  function paint() {
    slots.forEach((t, pos) => {
      t.style.backgroundPosition = bgPos(order[pos]);
      t.classList.toggle('ok', order[pos] === pos);
      t.classList.toggle('sel', pos === sel);
      t.classList.toggle('peer-sel', pos === peerSel);
    });
    const left = lv ? ` · ⏱ ${Math.max(0, Math.ceil(lv.time - (performance.now() - t0) / 1000))}s` : '';
    api.setStats(`🧩 ${order.filter((v, i) => v === i).length}/${total} pas · 👆 ${moves}${left}`);
  }
  function check() {
    if (done || !order.every((v, i) => v === i)) return;
    done = true;
    board.classList.add('solved');
    clearInterval(tick);
    const secs = Math.round((performance.now() - t0) / 1000);
    const stars = lv ? starsBy(1 - secs / lv.time, 0, 0.3, 0.6) || 1 : undefined;
    setTimeout(() => api.finish({ win: true, stars, icon: '🧩', title: 'Fotonya utuh lagi!', detail: `Kalian beresin bareng dalam ${secs} detik, ${moves} langkah 💞` }), 600);
  }
  board.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.tile');
    if (!t || done) return;
    e.preventDefault();
    const pos = +t.dataset.pos;
    if (sel < 0) { sel = pos; api.sfx('flip'); ctx.send('pz-sel', { pos }); paint(); return; }
    if (sel === pos) { sel = -1; ctx.send('pz-sel', { pos: -1 }); paint(); return; }
    [order[sel], order[pos]] = [order[pos], order[sel]];
    moves++;
    api.sfx(order[pos] === pos || order[sel] === sel ? 'good' : 'pop');
    sel = -1;
    ctx.send('pz-state', { order, moves });
    paint();
    check();
  });
  const offs = [
    ctx.on('pz-sel', (d) => { peerSel = d.pos; paint(); }),
    ctx.on('pz-state', (d) => { order = d.order; moves = Math.max(moves, d.moves); peerSel = -1; if (sel >= 0 && order[sel] == null) sel = -1; api.sfx('pop'); paint(); check(); }),
  ];
  api.say(`Susun fotonya bareng ${ctx.peer.name}! Kepingan yang lagi dia pilih warnanya ungu 💜`, 'happy');
  paint();
  return { destroy() { done = true; clearInterval(tick); offs.forEach((f) => f()); } };
}

// Banner giliran buat game kartu gantian: jelas siapa yang lagi jalan
function turnBanner(stage, grid) {
  const el = document.createElement('div');
  el.className = 'ol-turn';
  const wrap = document.createElement('div');
  wrap.className = 'ol-cardwrap';
  stage.insertBefore(wrap, grid);
  wrap.append(el, grid);
  return (mine, peerName, extra = '') => {
    el.classList.toggle('mine', mine);
    el.innerHTML = mine
      ? `<b>Giliran kamu!</b><span>Buka 2 kartu 👆${extra}</span>`
      : `<b>Giliran ${esc(peerName)}</b><span>Tunggu dia buka 2 kartu dulu yaa ⏳${extra}</span>`;
  };
}

// ---------- Kartu Kembar Gantian ----------
function startMemoryTurns(stage, api, ctx) {
  const pairs = 6;
  const rng = seeded(ctx.seed);
  const photos = (ctx.params.photos || []).slice(0, 3).map((s) => `img:${s}`);
  const icons = [...photos, ...shuffleWith(rng, [...ctx.params.emojis]).slice(0, pairs - photos.length)];
  const deck = shuffleWith(rng, [...icons, ...icons]);
  const grid = document.createElement('div');
  grid.className = 'memory-grid';
  grid.style.setProperty('--cols', 4);
  grid.style.setProperty('--ratio', (3 * 1.2) / 4);
  deck.forEach((em, i) => {
    const card = document.createElement('button');
    card.className = 'card';
    card.dataset.i = i;
    card.innerHTML = `<span class="card-inner"><span class="face back">💗</span><span class="face front">${em.startsWith('img:') ? `<img class="card-photo" src="${esc(em.slice(4))}" alt="">` : em}</span></span>`;
    grid.appendChild(card);
  });
  stage.appendChild(grid);
  const banner = turnBanner(stage, grid);
  const cards = [...grid.children];
  const score = { pasangan: 0, pengirim: 0 };
  let turn = 'pasangan', open = [], lock = false, matched = 0, done = false, timer = 0;
  const person = (role) => (role === ctx.me.role ? ctx.me : ctx.peer);
  function stats() {
    api.setStats(`Kamu ${score[ctx.me.role]} · ${ctx.peer.name} ${score[ctx.peer.role]}`);
    grid.classList.toggle('not-my-turn', turn !== ctx.me.role);
    banner(turn === ctx.me.role, ctx.peer.name);
  }
  function flip(i) {
    const c = cards[i];
    if (done || lock || open.includes(i) || c.classList.contains('matched')) return false;
    c.classList.add('flipped');
    api.sfx('flip');
    open.push(i);
    if (open.length === 2) {
      const [a, b] = open;
      if (deck[a] === deck[b]) {
        cards[a].classList.add('matched');
        cards[b].classList.add('matched');
        score[turn]++;
        matched++;
        open = [];
        api.sfx('good');
        if (matched === pairs) end();
      } else {
        lock = true;
        timer = setTimeout(() => {
          cards[a].classList.remove('flipped');
          cards[b].classList.remove('flipped');
          open = [];
          lock = false;
          turn = turn === 'pasangan' ? 'pengirim' : 'pasangan';
          if (turn === ctx.me.role) api.say('Giliran kamu! 👆', 'happy');
          stats();
        }, 900);
      }
    }
    stats();
    return true;
  }
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (!c) return;
    if (turn !== ctx.me.role) { nudge(); return; }
    const i = +c.dataset.i;
    if (flip(i)) ctx.send('mm-flip', { i });
  });
  const off = ctx.on('mm-flip', (d) => flip(d.i));
  let nudgeT = 0;
  function nudge() {
    if (performance.now() - nudgeT < 1200) return;
    nudgeT = performance.now();
    api.sfx('bad');
    api.say(`Sabar, sekarang giliran ${ctx.peer.name} 😆 nanti gantian`, 'happy');
  }
  function end() {
    done = true;
    const a = score[ctx.me.role], b = score[ctx.peer.role];
    setTimeout(() => api.finish({
      win: a >= b, icon: a > b ? '🏆' : a === b ? '🤝' : '🥈',
      title: a > b ? 'Kamu menang!' : a === b ? 'Seri!' : `${ctx.peer.name} menang!`,
      detail: `Kamu ${a} pasang · ${ctx.peer.name} ${b} pasang`,
    }), 500);
  }
  api.say(`Main gantian: buka 2 kartu. Kalau kembar, poin buat kamu & jalan lagi. Kalau beda, ganti giliran. ${turn === ctx.me.role ? 'Kamu duluan! 👆' : `${person(turn).name} duluan.`}`, 'happy');
  stats();
  return { destroy() { done = true; off(); clearTimeout(timer); } };
}

// ---------- Level: Terbang Berdua (tiang kalian dijumlah) ----------
function startFlyCoop(stage, api, ctx) {
  const lv = ctx.level.params;
  let peerState = { y: 0.45, passed: 0, alive: true };
  let mine = null, lastSent = 0, shown = false;
  const offs = [ctx.on('fly', (d) => { peerState = d; check(); })];
  function check() {
    if (shown || !mine || peerState.alive) return;
    shown = true;
    const total = mine.passed + peerState.passed;
    const stars = starsBy(total / lv.target, 1, 1.3, 1.6);
    api.finish({
      win: stars > 0, stars, icon: stars ? '🕊️' : '😵',
      title: stars ? `Berdua lewat ${total} tiang!` : `Baru ${total} dari ${lv.target} tiang`,
      detail: `Kamu ${mine.passed} · ${ctx.peer.name} ${peerState.passed}${stars ? '' : ' · coba lagi, pasti bisa!'}`,
    });
  }
  const game = startFly(stage, {
    ...ctx.params, ...lv, target: 999, rng: seeded(ctx.seed), face: ctx.me.face, flyer: ctx.me.emoji,
    race: {
      name: ctx.peer.name, face: ctx.peer.face, emoji: ctx.peer.emoji, coopTarget: lv.target,
      ghost: () => peerState,
      tick(state, force) {
        const now = performance.now();
        if (!force && now - lastSent < 120) return;
        lastSent = now;
        ctx.send('fly', state);
      },
    },
  }, {
    ...api,
    finish: (r) => {
      mine = r;
      api.say(peerState.alive ? `Semangatin ${ctx.peer.name}, dia masih terbang! 📣` : 'Yuk liat hasilnya!', 'happy');
      check();
    },
  });
  api.say(`Lewatin ${lv.target} tiang berdua! Tiang kalian dijumlah 💞`, 'happy');
  return { destroy() { offs.forEach((f) => f()); game.destroy(); } };
}

// ---------- Level: Cari yang Beda (siapa cepet dia dapet, skornya berdua) ----------
const ODD_PAIRS = [['🐱', '😺'], ['💗', '💖'], ['🌸', '🌺'], ['🍓', '🍒'], ['🐶', '🐕'], ['⭐', '🌟'], ['🍩', '🍪'], ['🐰', '🐇'], ['🌙', '🌛'], ['🧁', '🍰'], ['🐻', '🧸'], ['🍊', '🍑']];
function startOddCoop(stage, api, ctx) {
  const lv = ctx.level.params;
  const rng = seeded(ctx.seed);
  const rounds = [...Array(lv.rounds)].map(() => {
    const [a, b] = ODD_PAIRS[Math.floor(rng() * ODD_PAIRS.length)];
    const flip = rng() < 0.5;
    return { base: flip ? b : a, odd: flip ? a : b, at: Math.floor(rng() * lv.size * lv.size) };
  });
  const wrap = document.createElement('div');
  wrap.className = 'odd-wrap';
  wrap.innerHTML = `<div class="odd-grid" style="--n:${lv.size}"></div>`;
  stage.appendChild(wrap);
  const grid = wrap.querySelector('.odd-grid');
  let r = 0, penalty = 0, done = false, mineHits = 0;
  const t0 = performance.now();
  const left = () => lv.time - penalty - (performance.now() - t0) / 1000;
  function render() {
    const R = rounds[r];
    grid.innerHTML = [...Array(lv.size * lv.size)].map((_, i) => `<button class="odd-cell" data-i="${i}">${i === R.at ? R.odd : R.base}</button>`).join('');
  }
  function stats() { api.setStats(`🔍 ${r}/${lv.rounds} · ⏱ ${Math.max(0, Math.ceil(left()))}s`); }
  function next(byMe) {
    if (byMe) mineHits++;
    api.sfx('good');
    grid.querySelector(`[data-i="${rounds[r].at}"]`)?.classList.add('found');
    r++;
    stats();
    if (r >= lv.rounds) return end(true);
    setTimeout(() => { if (!done) render(); }, 250);
  }
  grid.addEventListener('pointerdown', (e) => {
    const c = e.target.closest('.odd-cell');
    if (!c || done) return;
    e.preventDefault();
    const i = +c.dataset.i;
    if (i === rounds[r].at) { ctx.send('odd-hit', { r }); next(true); }
    else { penalty += 2; api.sfx('bad'); c.classList.add('nope'); ctx.send('odd-miss', {}); stats(); }
  });
  const offs = [
    ctx.on('odd-hit', (d) => { if (!done && d.r === r) next(false); }),
    ctx.on('odd-miss', () => { penalty += 2; stats(); }),
  ];
  const iv = setInterval(() => { if (done) return; stats(); if (left() <= 0) end(false); }, 250);
  function end(win) {
    if (done) return;
    done = true;
    clearInterval(iv);
    const stars = win ? (left() / lv.time >= 0.5 ? 3 : left() / lv.time >= 0.25 ? 2 : 1) : 0;
    api.finish({
      win, stars, icon: win ? '🔍' : '⏰',
      title: win ? 'Ketemu semua!' : 'Waktunya habis',
      detail: win ? `Kamu nemu ${mineHits}, ${ctx.peer.name} nemu ${lv.rounds - mineHits} 💞` : `Baru ${r} dari ${lv.rounds}. Salah tap ngurangin 2 detik lho!`,
    });
  }
  api.say('Cari 1 yang beda! Siapa pun yang nemu, poinnya buat berdua 💞', 'happy');
  render();
  stats();
  return { destroy() { done = true; clearInterval(iv); offs.forEach((f) => f()); } };
}

// ---------- Level: Kartu Kembar Bareng (gantian, skornya berdua, gerakan terbatas) ----------
function startMemoryCoop(stage, api, ctx) {
  const lv = ctx.level.params;
  const pairs = lv.pairs;
  const limit = Math.round(pairs * 2.6);
  const rng = seeded(ctx.seed);
  const photos = (ctx.params.photos || []).slice(0, Math.ceil(pairs / 2)).map((s) => `img:${s}`);
  const icons = [...photos, ...shuffleWith(rng, [...ctx.params.emojis]).slice(0, pairs - photos.length)];
  const deck = shuffleWith(rng, [...icons, ...icons]);
  const grid = document.createElement('div');
  grid.className = 'memory-grid';
  const cols = 4;
  grid.style.setProperty('--cols', cols);
  grid.style.setProperty('--ratio', (Math.ceil(deck.length / cols) * 1.2) / cols);
  grid.innerHTML = deck.map((em, i) => `<button class="card" data-i="${i}"><span class="card-inner"><span class="face back">💗</span><span class="face front">${em.startsWith('img:') ? `<img class="card-photo" src="${esc(em.slice(4))}" alt="">` : em}</span></span></button>`).join('');
  stage.appendChild(grid);
  const banner = turnBanner(stage, grid);
  const cards = [...grid.children];
  let turn = 'pasangan', open = [], lock = false, matched = 0, moves = 0, done = false, timer = 0, nudgeT = 0;
  function stats() {
    api.setStats(`🃏 ${matched}/${pairs} · 👆 ${moves}/${limit} gerakan`);
    grid.classList.toggle('not-my-turn', turn !== ctx.me.role);
    banner(turn === ctx.me.role, ctx.peer.name);
  }
  function flip(i) {
    const c = cards[i];
    if (done || lock || open.includes(i) || c.classList.contains('matched')) return false;
    c.classList.add('flipped');
    api.sfx('flip');
    open.push(i);
    if (open.length === 2) {
      moves++;
      const [a, b] = open;
      const ok = deck[a] === deck[b];
      lock = true;
      timer = setTimeout(() => {
        if (ok) { cards[a].classList.add('matched'); cards[b].classList.add('matched'); matched++; api.sfx('good'); }
        else { cards[a].classList.remove('flipped'); cards[b].classList.remove('flipped'); }
        open = [];
        lock = false;
        turn = turn === 'pasangan' ? 'pengirim' : 'pasangan'; // gantian tiap 2 kartu
        stats();
        if (matched === pairs) end(true);
        else if (moves >= limit) end(false);
        else if (turn === ctx.me.role) api.say('Giliran kamu! 👆', 'happy');
      }, ok ? 350 : 850);
    }
    stats();
    return true;
  }
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (!c) return;
    if (turn !== ctx.me.role) {
      if (performance.now() - nudgeT > 1200) { nudgeT = performance.now(); api.sfx('bad'); api.say(`Sabar, sekarang giliran ${ctx.peer.name} 😆 kalian gantian tiap 2 kartu`, 'happy'); }
      return;
    }
    const i = +c.dataset.i;
    if (flip(i)) ctx.send('mm-flip', { i });
  });
  const off = ctx.on('mm-flip', (d) => flip(d.i));
  function end(win) {
    done = true;
    const stars = win ? (moves <= pairs * 1.6 ? 3 : moves <= pairs * 2.1 ? 2 : 1) : 0;
    setTimeout(() => api.finish({
      win, stars, icon: win ? '🃏' : '😵',
      title: win ? `Beres dalam ${moves} gerakan!` : 'Gerakannya habis',
      detail: win ? 'Gantian buka kartu, kompak! 💞' : `Baru ${matched} dari ${pairs} pasang. Inget-inget kartunya bareng yaa`,
    }), 400);
  }
  api.say(`Main gantian: tiap giliran buka 2 kartu, habis itu ganti. Kumpulin ${pairs} pasang berdua dalam ${limit} gerakan! ${turn === ctx.me.role ? 'Kamu duluan 👆' : `${ctx.peer.name} duluan.`}`, 'happy');
  stats();
  return { destroy() { done = true; off(); clearTimeout(timer); } };
}

// Game buat peta level Main Berdua
export const LEVEL_GAMES = {
  flyco: { start: startFlyCoop, countdown: true },
  tebak: { start: startTebak },
  samaan: { start: startTebak },
  odd: { start: startOddCoop, countdown: true },
  memoryco: { start: startMemoryCoop, countdown: true },
  puzzle: { start: startPuzzleTogether },
};

export const ONLINE_GAMES = {
  fly: { name: 'Terbang Balapan', icon: '🕊️', desc: 'Siapa yang paling jauh terbangnya', start: startFlyRace, countdown: true },
  tebak: { name: 'Tebak Pasangan', icon: '💞', desc: 'Seberapa kenal kamu sama dia?', start: startTebak },
  puzzle: { name: 'Puzzle Bareng', icon: '🧩', desc: 'Susun foto kalian berdua-duaan', start: startPuzzleTogether },
  memory: { name: 'Kartu Kembar Gantian', icon: '🃏', desc: 'Gantian buka kartu, kumpulin pasangan terbanyak', start: startMemoryTurns, countdown: true },
  talk: { name: 'Deep Talk Bareng', icon: '💬', desc: 'Kartu yang ditarik muncul di HP kalian berdua' },
};
