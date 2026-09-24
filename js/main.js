import { CONFIG } from './config.js';
import { getNames, setNames, fill, getPhoto, savePhoto, clearPhoto, getLook, setLook, getChars, getFace, saveFace, clearFace } from './personal.js';
import { THEMES, CHARACTERS, applyTheme } from './themes.js';
import { SHOWCASES } from './showcase.js';
import { LEVEL_MAP, PATTERN, EXTRA_SLOTS, TYPE_NAME, typeOf } from './level-map.js';
import { sfx, toggleMute, isMuted, toggleMusic, isMusicOff } from './audio.js';
import { confetti } from './confetti.js';
import { esc, pick } from './util.js';
import { startMemory } from './games/memory.js';
import { startCatch } from './games/catch.js';
import { startPop } from './games/pop.js';
import { startQuiz } from './games/quiz.js';
import { startPuzzle } from './games/puzzle.js';
import { startOdd } from './games/odd.js';
import { startSimon } from './games/simon.js';
import { startFly } from './games/fly.js';
import { startStack } from './games/stack.js';
import { startRunner } from './games/runner.js';
import { startThrow } from './games/throw.js';
import { startMaze } from './games/maze.js';
import { startTiming } from './games/timing.js';
import { streakEnabled, getPlayer, setPlayer, clearPlayer, recordPlay, flushPlays, pendingPlays, loadStreak, notifyPlayed, pushState, enablePush, setBadge } from './streak.js';

// ---------- Dunia & level ----------
// Di demo semua puzzle pakai foto yang diupload pengunjung (atau gambar contoh).
const SAMPLE_PHOTO = '/img/contoh-foto.jpg';
const PUZZLE = (size, time, aspect = '3 / 4') => ({ image: SAMPLE_PHOTO, aspect, caption: '{pasangan} & {pengirim} 💖', size, time });

// Parameter game baru per tingkat (wi = dunia 0–4). Muka & karakter diisi di levelParams().
const G = {
  stack: (wi) => ({ type: 'stack', target: [6, 8, 9, 10, 10][wi], speed: 170 + wi * 25, speedUp: 6, lives: 3 }),
  runner: (wi, obstacles) => ({ type: 'runner', time: [20, 24, 26, 28, 28][wi], speed: 230 + wi * 20, gapMin: 1.05 - wi * 0.07, gapMax: 1.8 - wi * 0.1, lives: 3, obstacles }),
  throw: (wi) => ({ type: 'throw', target: [5, 6, 7, 7, 7][wi], throws: [10, 11, 11, 11, 11][wi], speed: 120 + wi * 25, speedUp: 10, jitter: 0.2 + wi * 0.1 }),
  maze: (wi) => ({ type: 'maze', cols: [5, 6, 7, 7, 8][wi], rows: [7, 8, 9, 10, 11][wi], time: [45, 50, 55, 60, 60][wi] }),
  // Panah Cinta sengaja dibuat santai: zona nggak pernah lebih kecil dari 20% bar
  timing: (wi) => ({ type: 'timing', target: [5, 5, 6, 6, 6][wi], lives: 3, zone: [0.3, 0.29, 0.27, 0.25, 0.24][wi], minZone: 0.2, shrink: 0.01, speed: [1.9, 2, 2.1, 2.2, 2.3][wi], speedUp: 0.05 }),
  simon: (target, speed) => ({ type: 'simon', target, speed, lives: 3 }),
  fly: (target, gap, speed, spacing) => ({ type: 'fly', target, gap, speed, spacing, lives: 3 }),
  odd: (rounds, maxSize, time) => ({ type: 'odd', rounds, maxSize, time }),
};

// Tiap dunia 12 level, semuanya jenis game beda (susunannya di js/level-map.js).
const WORLDS = [
  { name: 'Taman Bunga', icon: '🌸', theme: 'w-flower', player: '🧺',
    memory: ['🌸', '🌷', '🌻', '🌼', '🍓', '🌺', '🦋', '🐞', '🌈', '🍀', '🐰', '🍄'],
    catchGood: ['🌸', '🌷', '💖'],
    slots: { 3: G.simon(5, 660), 4: G.runner(0, ['🌷', '🍄', '🪨']) },
    a: G.odd(6, 5, 40), b: G.maze(0), c: G.fly(6, 225, 140, 240), d: G.timing(0), e: G.stack(0), f: G.throw(0),
    bonus: PUZZLE(3, 90) },
  { name: 'Kota Permen', icon: '🍭', theme: 'w-candy', player: '🧺',
    memory: ['🍭', '🍬', '🧁', '🍩', '🍰', '🍪', '🍫', '🍦', '🍡', '🍮', '🎂', '🍒'],
    catchGood: ['🍬', '🍭', '🧁'],
    slots: { 3: G.stack(1), 4: G.runner(1, ['🍬', '🧁', '🍩']) },
    a: G.fly(8, 210, 150, 230), b: G.odd(8, 6, 50), c: G.simon(5, 620), d: G.throw(1), e: G.timing(1), f: G.maze(1),
    bonus: PUZZLE(3, 90) },
  { name: 'Pantai Cinta', icon: '🏖️', theme: 'w-beach', player: '🪣',
    memory: ['🐚', '🦀', '🐠', '🐬', '🌴', '🍉', '🍍', '🥥', '🐳', '⛱️', '🦩', '🐙'],
    catchGood: ['🐚', '🍉', '🐠'],
    slots: { 3: G.runner(2, ['🦀', '🐚', '🪨']), 4: G.stack(2) },
    a: G.simon(6, 560), b: G.fly(10, 195, 165, 220), c: G.odd(8, 6, 50), d: G.maze(2), e: G.throw(2), f: G.timing(2),
    bonus: PUZZLE(4, 150) },
  { name: 'Langit Bintang', icon: '🌙', theme: 'w-night', player: '🧺',
    memory: ['🌙', '⭐', '🪐', '☁️', '🦄', '🌠', '🔭', '🚀', '🌈', '💫', '🛸', '🎈'],
    catchGood: ['⭐', '🌙', '💫'],
    slots: { 3: G.stack(3), 4: G.runner(3, ['🪐', '☄️', '🌵']) },
    a: { type: 'puzzle', ...PUZZLE(3, 150) }, b: G.simon(7, 500), c: G.fly(10, 195, 165, 220),
    d: G.odd(9, 6, 55), e: G.throw(3), f: G.timing(3),
    bonus: PUZZLE(4, 180) },
  { name: 'Rumah Kita', icon: '🏡', theme: 'w-home', player: '🧺',
    memory: ['🦉', '🐱', '🏡', '☕', '🧸', '🎀', '🍪', '🐾', '🕯️', '🌙', '💌', '🧶'],
    catchGood: ['🐾', '🧶', '💌'],
    slots: { 3: G.runner(4, ['🧸', '🪴', '📦']), 4: G.simon(7, 520) },
    a: G.stack(4), b: G.maze(4), c: G.throw(4), d: G.fly(10, 195, 165, 220), e: G.odd(9, 6, 55), f: G.timing(4),
    bonus: PUZZLE(4, 150) },
];
// Pastikan jenis game di sini sama dengan js/level-map.js (dipakai CMS buat label)
WORLDS.forEach((w, wi) => {
  for (const slot of [3, 4, ...EXTRA_SLOTS]) {
    const here = typeof slot === 'number' ? w.slots[slot]?.type : w[slot].type;
    if (here !== typeOf(wi, slot)) console.warn(`level-map.js beda dengan main.js: dunia ${wi + 1} slot ${slot}`);
  }
});
const TYPE_ICON = {
  memory: '🃏', catch: '🧺', pop: '👆', quiz: '💌', puzzle: '🧩', odd: '🔍', simon: '🎵', fly: '🦉',
  stack: '🎂', runner: '🏃', throw: '🎯', maze: '🧭', timing: '💘',
};
const STARTERS = {
  memory: startMemory, catch: startCatch, pop: startPop, quiz: startQuiz,
  puzzle: startPuzzle, odd: startOdd, simon: startSimon, fly: startFly,
  stack: startStack, runner: startRunner, throw: startThrow, maze: startMaze, timing: startTiming,
};
const NO_COUNTDOWN = ['quiz', 'puzzle'];
// Surat kebuka setelah game tamat sekali (kuis terakhir), habis itu bisa dibuka kapan aja.
const LETTER_LEVEL = CONFIG.demo ? 'w0-5' : 'w4-5';

const catchParams = (w, d) => ({
  time: 30, lives: 3, target: Math.round(14 + d * 4),
  speed: 160 + d * 45, spawn: Math.max(0.36, 0.8 - d * 0.12), badRate: 0.15 + d * 0.05,
  good: w.catchGood, bad: ['💔', '🌶️'], gold: '💎', player: w.player,
});
const popParams = (wi, d) => ({
  time: 30, cols: wi < 3 ? 3 : 4, rows: wi < 2 ? 3 : 4, target: Math.round(14 + d * 4),
  interval: Math.max(420, 900 - d * 130), stay: Math.max(650, 1300 - d * 170),
  badRate: 0.15 + d * 0.04, multi: d * 0.12, good: ['🦉', '🐱'], bad: ['🐝'], gold: '💖', // good diganti karakter di levelParams
});

function originalParams(w, wi, k) {
  const type = PATTERN[k];
  const d = Math.min(wi, 3) + (k >= 3 ? 0.5 : 0); // tingkat kesulitan 0 … 3.5 (dunia 5 setara dunia 4)
  if (type === 'memory') {
    const pairs = [[3, 4], [4, 6], [6, 8], [8, 10], [8, 10]][wi][k >= 3 ? 1 : 0];
    return { pairs, emojis: w.memory, time: Math.round(pairs * (7 - Math.min(wi, 3) * 0.6) + 12) };
  }
  if (type === 'catch') return catchParams(w, d);
  if (type === 'pop') return popParams(wi, d);
  return { questions: CONFIG.quiz[wi] || [] };
}

function extraParams(w, wi, { type, d, ...params }) {
  if (type === 'catch') return catchParams(w, d);
  if (type === 'pop') return popParams(wi, d);
  if (type === 'memory') return { emojis: w.memory, ...params };
  return params;
}

const LEVELS = [];
WORLDS.forEach((w, wi) => {
  LEVEL_MAP[wi].layout.forEach((slot) => {
    if (typeof slot === 'number') {
      const custom = w.slots?.[slot];
      LEVELS.push({ id: `w${wi}-${slot}`, world: wi,
        type: custom ? custom.type : PATTERN[slot],
        params: custom ? extraParams(w, wi, custom) : originalParams(w, wi, slot),
        msg: CONFIG.messages[wi * 6 + slot] });
    } else {
      LEVELS.push({ id: `w${wi}-${slot}`, world: wi, type: w[slot].type, params: extraParams(w, wi, w[slot]),
        msg: CONFIG.stageMessages?.[wi * 6 + EXTRA_SLOTS.indexOf(slot)] });
    }
  });
  LEVELS.push({ id: `w${wi}-bonus`, world: wi, type: 'puzzle', params: w.bonus, bonus: true,
    msg: CONFIG.bonusMessages?.[wi] });
});
let num = 0;
LEVELS.forEach((L, i) => { L.idx = i; if (!L.bonus) L.num = ++num; });
const MAX_STARS = LEVELS.length * 3;
const MAIN = LEVELS.filter((L) => !L.bonus);

function hintFor(L) {
  const p = levelParams(L); // sudah berisi karakter & nama pilihan
  const c = getChars();
  const n = getNames();
  switch (L.type) {
    case 'memory': return `Cari ${p.pairs} pasang kartu kembar dalam ${p.time} detik!`;
    case 'catch': return `Geser ${c.pengirim.emoji} buat nangkep ${p.good.join('')}, hindari ${p.bad.join('')}! Target ${p.target}. Ada bonus jatuh? Tangkep! +10`;
    case 'pop': return `Tap ${p.good.join('')} secepatnya (${p.gold} = +3), jangan tap ${p.bad[0]}! Target ${p.target}.`;
    case 'puzzle': return 'Tap 2 kepingan buat tukar posisi sampai fotonya utuh! Tahan 👀 buat intip.';
    case 'odd': return `Cari 1 emoji yang beda dari yang lain! ${p.rounds} ronde, salah tap -3 detik.`;
    case 'simon': return `Perhatiin urutan ${c.pasangan.emoji}${c.pengirim.emoji}💖⭐ yang nyala, terus ulangi! Target ${p.target} urutan.`;
    case 'fly': return `Tap buat bikin ${n.pasangan} terbang, lewati ${p.target} tiang bunga & ambil 💖!`;
    case 'stack': return `Tap pas lapisan kuenya di atas kue sebelumnya! Susun ${p.target} tingkat. Pas banget = Perfect ✨`;
    case 'runner': return `${n.pengirim} lari! Tap buat lompat (bisa 2x), hindari ${p.obstacles.join('')} selama ${p.time} detik.`;
    case 'throw': return `Lempar 💖 ke ${n.pengirim} yang gerak-gerak! Kena ${p.target} kali, lemparan cuma ${p.throws}.`;
    case 'maze': return `Tarik garis dari ${n.pasangan} lewat jalan labirin sampai ketemu ${n.pengirim}! Waktunya ${p.time} detik.`;
    case 'timing': return `Tap pas jarumnya di zona 💖! Kena ${p.target} kali, zonanya makin kecil.`;
    default: return 'Jawab pertanyaan dari hatiku 💌 (minimal benar 2)';
  }
}
const levelLabel = (L) => (L.bonus ? 'Bonus ⭐' : `Level ${L.num}`);

// ---------- Progres (disimpan di browser) ----------
const SAVE_KEY = CONFIG.demo ? 'lq-demo-progress' : `lq-progress-${CONFIG.slug}`;
let progress = loadProgress();

function loadProgress() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.stars && typeof s.stars === 'object') return s;
  } catch {}
  return { stars: {} };
}
function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch {}
}
// Mode tes: buka link dengan ?bukasemua supaya semua level & surat terbuka (progress asli nggak berubah)
const TEST_MODE = new URLSearchParams(location.search).has('bukasemua');

const starsOf = (L) => progress.stars[L.id] || 0;
const cleared = (L) => starsOf(L) > 0;
function unlocked(L) {
  if (TEST_MODE || CONFIG.showcase) return true; // contoh versi jadi: semua level kebuka
  if (CONFIG.demo) return L.world === 0; // demo: semua level Dunia 1 langsung kebuka, dunia lain terkunci
  if (cleared(L)) return true;
  if (L.bonus) return MAIN.filter((M) => M.world === L.world).every(cleared);
  return L.num === 1 || cleared(MAIN[L.num - 2]);
}
// Demo: surat selalu kebuka. Versi pasangan: kebuka setelah tamat sekali.
const letterOpen = () => TEST_MODE || CONFIG.demo || CONFIG.showcase || cleared(LEVELS.find((L) => L.id === LETTER_LEVEL));

// ---------- Layar ----------
const $ = (s) => document.querySelector(s);
const screens = { home: $('#screen-home'), map: $('#screen-map'), game: $('#screen-game'), letter: $('#screen-letter') };
const stageEl = $('#stage');
const modal = $('#modal');

function show(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
  document.body.classList.toggle('playing', name === 'game');
  if (name === 'map') renderMap();
  if (name === 'home' || name === 'map') refreshStreak();
  if (name === 'letter') renderLetter();
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { sfx('click'); closeModal(); stopGame(); show(go.dataset.go); }
});

// ---------- Home ----------
function applyLook() {
  applyTheme(getLook().theme);
  const c = getChars();
  const mascots = document.querySelectorAll('.mascots span');
  if (mascots.length === 3) { mascots[0].textContent = c.pasangan.emoji; mascots[2].textContent = c.pengirim.emoji; }
  $('#guide-owl').textContent = c.pasangan.emoji;
}

function applyNames() {
  applyLook();
  const { pasangan } = getNames();
  document.querySelectorAll('.nm').forEach((el) => (el.textContent = pasangan));
  document.title = `${pasangan}'s Love Quest 💖`;
}
applyNames();
if (!CONFIG.demo) document.querySelectorAll('[data-demo-only]').forEach((el) => (el.hidden = true));

// ---------- Contoh versi jadi ----------
// Galeri di halaman depan demo
if (CONFIG.demo) {
  $('#showcase-list').innerHTML = Object.entries(SHOWCASES).map(([id, s]) => {
    const v = THEMES[s.theme].vars;
    return `
      <a class="showcase-card" href="/?lihat=${id}" style="--c1:${v['--bg1']};--c2:${v['--bg3']};--ink:${v['--ink']};--accent:${v['--pink-deep']}">
        <span class="sc-faces">
          <img src="/img/contoh/${s.faces.pasangan}" alt=""><img src="/img/contoh/${s.faces.pengirim}" alt="">
        </span>
        <span class="sc-text">
          <b>${esc(s.names.pasangan)} & ${esc(s.names.pengirim)}</b>
          <small>${esc(s.tagline)}</small>
        </span>
        <span class="sc-go">Main ▶</span>
      </a>`;
  }).join('');
}
// Bar di atas pas lagi lihat contoh
if (CONFIG.showcase) {
  const bar = document.createElement('div');
  bar.className = 'showcase-bar';
  bar.innerHTML = `
    <span>👀 Contoh versi jadi: <b>${esc(CONFIG.names.pasangan)} & ${esc(CONFIG.names.pengirim)}</b></span>
    <span class="sb-actions"><a href="/" class="sb-back">← Demo</a><button class="btn small" data-paket>💌 Bikin versi kalian</button></span>`;
  document.body.prepend(bar);
  document.body.classList.add('has-showcase-bar');
}

// ---------- Coba versi kalian (nama & foto) ----------
const inPasangan = $('#in-pasangan');
const inPengirim = $('#in-pengirim');
const inFoto = $('#in-foto');
const fotoPreview = $('#foto-preview');
const syncFoto = () => {
  const photo = getPhoto();
  fotoPreview.hidden = !photo;
  if (photo) fotoPreview.querySelector('img').src = photo;
};
inPasangan.value = getNames().raw.pasangan || '';
inPengirim.value = getNames().raw.pengirim || '';
[inPasangan, inPengirim].forEach((el) => el.addEventListener('input', () => {
  setNames(inPasangan.value, inPengirim.value);
  applyNames();
  renderStreak();
}));
inFoto.addEventListener('change', async () => {
  const file = inFoto.files?.[0];
  if (!file) return;
  try {
    await savePhoto(file);
    toast('📸 Foto kepasang! Nanti muncul di puzzle & surat');
  } catch {
    toast('Yahh fotonya kegedean, coba foto lain yaa 🥺');
  }
  inFoto.value = '';
  syncFoto();
});
$('#foto-hapus').addEventListener('click', () => { clearPhoto(); syncFoto(); });

// Foto muka (demo): tap kotaknya buat pilih foto, tap lagi yang sudah ada buat ganti
function syncFaces() {
  document.querySelectorAll('.face-pick').forEach((el) => {
    const src = getFace(el.dataset.face);
    const thumb = el.querySelector('.face-thumb');
    thumb.style.backgroundImage = src ? `url("${src}")` : '';
    thumb.textContent = src ? '' : getChars()[el.dataset.face].emoji;
  });
}
document.querySelectorAll('.face-pick input').forEach((input) => input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;
  try {
    await saveFace(input.closest('.face-pick').dataset.face, file);
    toast('😊 Mukanya kepasang! Coba main Terbang Tinggi / Lari Lompat');
  } catch {
    toast('Yahh fotonya kegedean, coba foto lain yaa 🥺');
  }
  input.value = '';
  syncFaces();
}));
if (CONFIG.demo) syncFaces();

// Tema & karakter (demo: disimpan di browser)
function renderLookPicker() {
  const look = getLook();
  $('#theme-chips').innerHTML = Object.entries(THEMES).map(([id, t]) => `
    <button type="button" class="theme-chip ${look.theme === id ? 'on' : ''}" data-theme-id="${id}" title="${esc(t.name)}" style="--c:${t.swatch}"></button>`).join('');
  const opts = (sel) => Object.entries(CHARACTERS).map(([id, ch]) => `<option value="${id}" ${sel === id ? 'selected' : ''}>${ch.emoji} ${esc(ch.name)}</option>`).join('');
  $('#in-char1').innerHTML = opts(look.characters.pasangan);
  $('#in-char2').innerHTML = opts(look.characters.pengirim);
}
function updateLook(patch) {
  const look = getLook();
  setLook({ ...look, ...patch, characters: { ...look.characters, ...(patch.characters || {}) } });
  applyNames();
  renderLookPicker();
  renderStreak();
  syncFaces();
}
if (CONFIG.demo) {
  renderLookPicker();
  $('#theme-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-id]');
    if (b) { sfx('click'); updateLook({ theme: b.dataset.themeId }); }
  });
  $('#in-char1').addEventListener('change', (e) => updateLook({ characters: { pasangan: e.target.value } }));
  $('#in-char2').addEventListener('change', (e) => updateLook({ characters: { pengirim: e.target.value } }));
}
syncFoto();

// ---------- Paket ----------
function showPackages() {
  modal.querySelector('.modal-card').innerHTML = `
    <div class="owl-react happy"><span class="owl">${getChars().pasangan.emoji}</span><span class="owl-extra">💌</span></div>
    <h2>Bikin versi kalian!</h2>
    <p class="detail">Semua isinya bisa diganti sesuai cerita kalian berdua</p>
    <div class="packages">
      ${CONFIG.packages.map((pk) => `
        <div class="package">
          <div class="pk-tag">${esc(pk.tag)}</div>
          <div class="pk-name">${esc(pk.name)}</div>
          <div class="pk-price">${esc(pk.price)} <small>${esc(pk.per)}</small></div>
          ${pk.note ? `<div class="pk-note">${esc(pk.note)}</div>` : ''}
          <ul>${pk.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn ghost" data-act="close">Nanti dulu</button>
      ${CONFIG.orderUrl ? `<a class="btn" href="${esc(CONFIG.orderUrl)}" target="_blank" rel="noopener">💌 Pesan sekarang</a>` : ''}
    </div>
    ${CONFIG.orderUrl ? '' : '<p class="detail">Info pemesanan segera hadir ✨</p>'}`;
  modal.classList.remove('hidden');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-paket]')) return;
  sfx('click');
  stopGame();
  showPackages();
});
$('#btn-play').addEventListener('click', () => { sfx('click'); show('map'); });
$('#btn-reset').addEventListener('click', () => {
  if (confirm('Yakin mau reset semua progress? Semua bintang bakal hilang 🥺')) {
    progress = { stars: {} };
    saveProgress();
    sfx('click');
  }
});

const soundBtn = $('#btn-sound');
const syncSound = () => (soundBtn.textContent = isMuted() ? '🔇' : '🔊');
syncSound();
soundBtn.addEventListener('click', () => { toggleMute(); syncSound(); sfx('click'); });

const musicBtn = $('#btn-music');
const syncMusicBtn = () => musicBtn.classList.toggle('off', isMusicOff());
syncMusicBtn();
musicBtn.addEventListener('click', () => { toggleMusic(); syncMusicBtn(); sfx('click'); });

// ---------- Peta ----------
function letterText() {
  if (CONFIG.demo || CONFIG.showcase) return 'Di versi kalian, surat kebuka setelah game-nya tamat. Di sini boleh langsung dibaca 🥰';
  return letterOpen() ? 'Udah kebuka karena game-nya udah tamat 🥰' : '🔒 Bisa dibuka kalau udah namatin game-nya';
}

const worldsEl = $('#worlds');

function renderMap() {
  const total = LEVELS.reduce((a, L) => a + starsOf(L), 0);
  $('#star-count').textContent = TEST_MODE ? '🔓 Mode tes' : `${total}/${MAX_STARS}`;
  const next = LEVELS.find((L) => unlocked(L) && !cleared(L));

  const letterBtn = `
    <button class="letter-btn ${letterOpen() ? '' : 'locked'}" id="btn-letter" ${letterOpen() ? '' : 'disabled'}>
      <span>💌</span>
      <div><b>Surat untuk ${esc(getNames().pasangan)}</b><small>${letterText()}</small></div>
    </button>`;

  worldsEl.innerHTML = WORLDS.map((w, wi) => {
    const lv = LEVELS.filter((L) => L.world === wi);
    const open = unlocked(lv[0]);
    const got = lv.reduce((a, L) => a + starsOf(L), 0);
    const html = `
      <section class="world ${w.theme} ${open ? '' : 'locked'}">
        <header class="world-head">
          <span class="world-icon">${w.icon}</span>
          <div><small>Dunia ${wi + 1}</small><h2>${w.name}</h2></div>
          <span class="world-stars">⭐ ${got}/${lv.length * 3}</span>
        </header>
        <div class="levels">
          ${lv.map((L) => {
            const s = starsOf(L);
            const ok = unlocked(L);
            const cls = [!ok ? 'locked' : L === next ? 'current' : cleared(L) ? 'done' : '', L.bonus ? 'bonus' : ''].join(' ');
            return `<button class="lvl ${cls}" data-i="${L.idx}" ${ok ? '' : 'disabled'} aria-label="${levelLabel(L)}">
              <span class="lvl-type">${ok ? (L.type === 'fly' ? getChars().pasangan.emoji : TYPE_ICON[L.type]) : '🔒'}</span>
              <span class="lvl-num">${L.bonus ? 'Bonus' : L.num}</span>
              <span class="lvl-stars">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span>
            </button>`;
          }).join('')}
        </div>
      </section>`;
    const lockNote = CONFIG.demo && !TEST_MODE && wi === 1 ? `
      <div class="demo-lock">
        <b>🔒 Dunia 2–5 kebuka di versi kalian</b>
        <span>48 level lagi, puzzle foto kalian, kuis tentang kalian berdua, sampai muka kalian jadi karakter game (paket Premium)</span>
        <button class="btn" data-paket>💌 Lihat paket</button>
      </div>` : '';
    return lockNote + html;
  }).join('') + letterBtn;

  const cur = worldsEl.querySelector('.lvl.current');
  if (cur) requestAnimationFrame(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

worldsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.lvl');
  if (b && !b.disabled) { sfx('click'); startLevel(+b.dataset.i); return; }
  if (e.target.closest('#btn-letter:not([disabled])')) { sfx('click'); show('letter'); }
});

// ---------- Owl pemandu ----------
const owlEl = $('#guide-owl');
const bubbleEl = $('#hud-hint');
let hintText = '';
let sayTimer = 0;

const OWL_START = ['{suara}! Semangat {pasangan}! 💪', '{suara}! {pasangan} pasti bisa!', '{karakter} dukung dari sini yaa', 'Siap-siap {pasangan}! {suara}!'];
const OWL_WIN = ['{suara}! {pasangan} hebat banget! 🥳', '{karakter} bangga sama {pasangan}! 💖', '{suara}! Keren parah sih ini!'];
const OWL_LOSE = ['{suara}… nggak papa, coba lagi yuk 🥺', '{karakter} yakin next pasti bisa! 💪', '{suara}… hampir banget tadi!'];

function owlSay(text, mood = 'happy', ms = 2400) {
  clearTimeout(sayTimer);
  bubbleEl.textContent = fill(text);
  bubbleEl.classList.add('talk');
  owlEl.className = `guide-owl ${mood}`;
  void owlEl.offsetWidth;
  owlEl.classList.add('bump');
  if (ms) sayTimer = setTimeout(() => owlHint(), ms);
}
function owlHint() {
  clearTimeout(sayTimer);
  bubbleEl.textContent = hintText;
  bubbleEl.classList.remove('talk');
  owlEl.className = 'guide-owl';
}

function showCombo(n) {
  const el = document.createElement('div');
  el.className = `combo-pop ${n % 5 === 0 ? 'big' : ''}`;
  el.textContent = n % 5 === 0 ? `Combo x${n}! 🔥` : `Combo x${n}!`;
  stageEl.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ---------- Main game ----------
let current = null; // { i, token, game }

function startLevel(i) {
  stopGame();
  closeModal();
  const L = LEVELS[i];
  show('game');
  screens.game.dataset.theme = WORLDS[L.world].theme;
  stageEl.innerHTML = '';
  $('#hud-title').textContent = `${levelLabel(L)} · ${TYPE_NAME[L.type]}`;
  hintText = hintFor(L);
  $('#hud-stats').textContent = '';

  const token = {};
  let combo = 0;
  current = { i, token, game: null };
  const live = () => current?.token === token;
  const api = {
    setStats: (s) => { if (live()) $('#hud-stats').textContent = s; },
    sfx,
    say: (text, mood) => { if (live()) owlSay(fill(text), mood); },
    streak: (ok) => {
      if (!live()) return 0;
      if (!ok) { combo = 0; return 0; }
      combo++;
      if (combo >= 3) {
        showCombo(combo);
        if (combo % 5 === 0) {
          sfx('gold');
          owlSay(`{suara}!! Combo x${combo}! 🔥`, 'happy', 1600);
        }
      }
      return combo;
    },
    finish: (r) => onFinish(token, r),
  };
  const begin = () => {
    if (!live()) return;
    owlHint();
    current.game = STARTERS[L.type](stageEl, levelParams(L), api);
  };
  if (NO_COUNTDOWN.includes(L.type)) {
    owlHint();
    begin();
  } else {
    owlSay(pick(OWL_START), 'happy', 0);
    countdown(token, begin);
  }
}

// Foto untuk puzzle/bonus: demo pakai foto upload lokal, game pasangan pakai foto dari CMS
function photoFor(L) {
  if (CONFIG.demo) return getPhoto() || SAMPLE_PHOTO;
  const p = CONFIG.photos || {};
  return (L && L.bonus && p.bonus?.[L.world]) || p.letter || SAMPLE_PHOTO;
}

function levelParams(L) {
  if (L.type === 'quiz') {
    return {
      questions: L.params.questions.map((q) => ({
        ...q, q: fill(q.q), options: q.options.map(fill), yes: fill(q.yes || ''), no: q.no && fill(q.no),
      })),
    };
  }
  if (L.type === 'puzzle') return { ...L.params, image: photoFor(L), caption: fill(L.params.caption) };
  const c = getChars();
  const n = getNames();
  // Yang main (pasangan) = terbang & jalan di labirin; yang ngasih (pengirim) = lari & jadi target lempar
  const faceA = getFace('pasangan');
  const faceB = getFace('pengirim');
  if (L.type === 'catch') return { ...L.params, bonusImage: faceB || (CONFIG.demo ? getPhoto() : null), carrier: c.pengirim.emoji };
  if (L.type === 'pop') return { ...L.params, good: [c.pasangan.emoji, c.pengirim.emoji] };
  if (L.type === 'fly') return { ...L.params, flyer: c.pasangan.emoji, face: faceA };
  if (L.type === 'simon') return { ...L.params, pads: [c.pasangan.emoji, c.pengirim.emoji, '💖', '⭐'] };
  if (L.type === 'runner') return { ...L.params, face: faceB, emoji: c.pengirim.emoji };
  if (L.type === 'throw') return { ...L.params, face: faceB, emoji: c.pengirim.emoji };
  if (L.type === 'maze') {
    return { ...L.params, startFace: faceA, startEmoji: c.pasangan.emoji, startName: n.pasangan,
      endFace: faceB, endEmoji: c.pengirim.emoji, endName: n.pengirim };
  }
  return L.params;
}

function countdown(token, cb) {
  const el = document.createElement('div');
  el.className = 'countdown';
  stageEl.appendChild(el);
  let n = 3;
  const step = () => {
    if (current?.token !== token) { el.remove(); return; }
    el.classList.remove('tick');
    void el.offsetWidth;
    el.classList.add('tick');
    if (n > 0) {
      el.textContent = n--;
      sfx('tick');
      setTimeout(step, 650);
    } else {
      el.textContent = 'Mulai! 💖';
      sfx('go');
      setTimeout(() => { el.remove(); cb(); }, 550);
    }
  };
  step();
}

function stopGame() {
  if (!current) return;
  current.game?.destroy();
  current = null;
  clearTimeout(sayTimer);
}

$('#btn-quit').addEventListener('click', () => { sfx('click'); stopGame(); closeModal(); show('map'); });

const LOSE_LINES = [
  'Hampir! Coba sekali lagi ya sayang 🥺',
  'Nggak apa-apa, {pengirim} tetep bangga sama {pasangan} 💪',
  'Sedikit lagi! {pengirim} percaya {pasangan} bisa 💕',
  'Kalah di game boleh, tapi di hati {pengirim} kamu selalu juara 🏆',
];

function onFinish(token, r) {
  if (current?.token !== token) return;
  const L = LEVELS[current.i];
  recordPlay()
    .then((isNew) => { if (isNew) { refreshStreak(true); if (!pendingPlays()) notifyPlayed(); } })
    .catch(() => {});
  if (r.win) {
    progress.stars[L.id] = Math.max(starsOf(L), r.stars);
    saveProgress();
    sfx('win');
    confetti();
    owlSay(pick(OWL_WIN), 'happy', 0);
  } else {
    sfx('lose');
    owlSay(pick(OWL_LOSE), 'sad', 0);
  }
  setTimeout(() => {
    if (current?.token !== token) return;
    stopGame();
    showResult(L, r);
  }, 700);
}

function showResult(L, r) {
  const i = L.idx;
  const isLast = i === LEVELS.length - 1;
  const opensLetter = L.id === LETTER_LEVEL;
  const msg = fill(L.msg);
  const stars = [0, 1, 2].map((k) =>
    `<span class="star ${k < r.stars ? 'on' : ''}" style="animation-delay:${0.25 + k * 0.25}s">★</span>`).join('');

  const hasNext = LEVELS.slice(i + 1).some(unlocked);
  const nextBtn = CONFIG.demo && !hasNext
    ? `<button class="btn" data-paket>💌 Buka semua</button>`
    : isLast
    ? `<button class="btn" data-go="map">Selesai 🏆</button>`
    : opensLetter
      ? `<button class="btn" data-act="letter">Buka surat 💌</button>`
      : `<button class="btn" data-act="next">Lanjut ▶</button>`;

  modal.querySelector('.modal-card').innerHTML = r.win ? `
      <div class="owl-react happy"><span class="owl">${getChars().pasangan.emoji}</span><span class="owl-extra">${isLast ? '👑' : '🎉'}</span></div>
      <p class="owl-line">${esc(fill(pick(OWL_WIN)))}</p>
      <h2>${levelLabel(L)} selesai!</h2>
      <div class="stars">${stars}</div>
      <p class="detail">${esc(r.detail)}</p>
      ${msg ? `<div class="love-note"><span class="from">💌 dari ${esc(getNames().pengirim)}</span>${esc(msg)}</div>` : ''}
      <div class="modal-actions">
        <button class="btn ghost" data-go="map">🗺️ Peta</button>
        <button class="btn ghost" data-act="retry">🔁 Ulangi</button>
        ${nextBtn}
      </div>` : `
      <div class="owl-react sad"><span class="owl">${getChars().pasangan.emoji}</span><span class="owl-extra">💧</span></div>
      <p class="owl-line">${esc(fill(pick(OWL_LOSE)))}</p>
      <h2>Yahh, belum berhasil</h2>
      <p class="detail">${esc(r.detail)}</p>
      <div class="love-note">${esc(fill(pick(LOSE_LINES)))}</div>
      <div class="modal-actions">
        <button class="btn ghost" data-go="map">🗺️ Peta</button>
        <button class="btn" data-act="retry">Coba lagi 🔁</button>
      </div>`;

  modal.classList.remove('hidden');
  modal.dataset.level = i;
}

modal.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  sfx('click');
  const i = +modal.dataset.level;
  closeModal();
  if (act === 'retry') startLevel(i);
  else if (act === 'next') {
    const next = LEVELS.slice(i + 1).find(unlocked);
    if (next) startLevel(next.idx);
    else show('map');
  }
  else if (act === 'letter') show('letter');
  // act 'close' cukup menutup modal
});

function closeModal() { modal.classList.add('hidden'); }

// ---------- Surat ----------
function renderLetter() {
  $('#letter-body').innerHTML = fill(CONFIG.finalLetter)
    .split(/\n\s*\n/)
    .map((para, k) => `<p style="animation-delay:${0.3 + k * 0.45}s">${esc(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
  $('#letter-from').textContent = getNames().pengirim;
  $('#letter-photo').src = photoFor(null);
  $('#letter-caption').textContent = fill('{pasangan} & {pengirim} 💖');
  setTimeout(() => { confetti(140); sfx('win'); }, 300);
}

// ---------- Streak couple ----------
// 'pasangan' = yang main, 'pengirim' = yang ngasih game
const NAME = {
  get pasangan() { return getNames().pasangan; },
  get pengirim() { return getNames().pengirim; },
};
const ICON = {
  get pasangan() { return getChars().pasangan.emoji; },
  get pengirim() { return getChars().pengirim.emoji; },
};
const streakSlots = [$('#streak-home'), $('#streak-map')];
let streakData = null;
let streakError = false;

function streakMessage(me, d) {
  const other = me === 'pasangan' ? 'pengirim' : 'pasangan';
  if (d.litToday) return `Streak hari ini udah nyala! Besok main lagi yaa 💖`;
  if (d.today[me]) return `${NAME[me]} udah main hari ini ✓ tinggal nunggu ${NAME[other]} 🥺`;
  if (d.today[other]) return `${NAME[other]} udah main hari ini, sekarang giliran ${NAME[me]}! 💪`;
  if (d.count) return `Main hari ini yaa, biar streak ${d.count} hari nggak putus! 🔥`;
  return 'Main berdua tiap hari buat nyalain streak 🔥';
}

function streakCard() {
  const me = getPlayer();
  if (!me) {
    return `<div class="streak-card">
      <div class="who-pick">
        <button class="btn ghost" data-who="pasangan">${ICON.pasangan} ${esc(NAME.pasangan)}</button>
        <button class="btn ghost" data-who="pengirim">${ICON.pengirim} ${esc(NAME.pengirim)}</button>
      </div>
    </div>`;
  }
  if (!streakData) {
    return `<div class="streak-card">
      <p class="streak-msg">${streakError ? 'Streak lagi nggak bisa dimuat, cek internet yaa 🥺' : 'Lagi ngecek streak…'}</p></div>`;
  }
  const d = streakData;
  const dayName = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'UTC' });
  const dot = (w) => (w.pasangan && w.pengirim ? '🔥' : w.pasangan ? ICON.pasangan : w.pengirim ? ICON.pengirim : '');
  return `<div class="streak-card ${d.litToday ? 'lit' : ''}">
    <div class="streak-top">
      <span class="streak-flame">🔥</span>
      <div class="streak-count"><b>${d.count}</b><small>hari streak</small></div>
      <div class="streak-who">
        ${['pasangan', 'pengirim'].map((p) => `<span class="who ${d.today[p] ? 'ok' : ''}">${ICON[p]} ${NAME[p]} ${d.today[p] ? '✓' : '⏳'}</span>`).join('')}
      </div>
    </div>
    <p class="streak-msg">${streakMessage(me, d)}</p>
    ${!CONFIG.demo && (d.offline || pendingPlays()) ? '<p class="push-note">📴 Lagi offline: main hari ini udah kecatat di HP, nanti otomatis kekirim pas online lagi</p>' : ''}
    <div class="streak-week">
      ${d.week.map((w, i) => `<div class="wk ${w.pasangan && w.pengirim ? 'both' : ''} ${i === 6 ? 'today' : ''}"><span>${dot(w)}</span><small>${i === 6 ? 'Hari ini' : dayName(w.day)}</small></div>`).join('')}
    </div>
    ${pushRow()}
    ${CONFIG.demo || CONFIG.showcase
      ? '<p class="push-note">✨ Ini contoh streak. Di versi kalian, streak nyambung ke HP kalian berdua + ada notif pengingat jam 7 malam.</p>'
      : `<button class="link-btn" data-who-reset>bukan ${esc(NAME[me])}? ganti</button>`}
  </div>`;
}

function renderStreak() {
  for (const slot of streakSlots) {
    slot.hidden = !streakEnabled;
    if (streakEnabled) slot.innerHTML = streakCard();
  }
}

let toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

async function refreshStreak(justPlayed = false) {
  if (!streakEnabled) return;
  renderStreak();
  if (!getPlayer()) return;
  const before = streakData;
  try {
    streakData = await loadStreak();
    streakError = false;
  } catch {
    streakError = true;
  }
  renderStreak();
  if (streakData) setBadge(streakData.count);
  if (justPlayed && streakData) {
    if (streakData.litToday && !before?.litToday) {
      toast(`🔥 Streak nyala! ${streakData.count} hari berturut-turut 💖`);
      confetti(120);
    } else if (!streakData.litToday) {
      const other = getPlayer() === 'pasangan' ? 'pengirim' : 'pasangan';
      toast(`✓ Hari ini udah kecatat! Tinggal nunggu ${NAME[other]} 🥺`);
    }
  }
}

document.addEventListener('click', (e) => {
  const pick = e.target.closest('[data-who]');
  if (pick) {
    sfx('click');
    setPlayer(pick.dataset.who);
    streakData = null;
    refreshStreak();
    return;
  }
  if (e.target.closest('[data-who-reset]')) {
    sfx('click');
    clearPlayer();
    renderStreak();
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshStreak(); });
// Balik online: kirim catatan main yang tertunda, kabari pasangan, lalu segarkan streak
window.addEventListener('online', async () => {
  const sent = await flushPlays();
  if (sent) {
    notifyPlayed();
    toast('📶 Online lagi! Main tadi udah kecatat di streak 💖');
  }
  refreshStreak();
});

// ---------- Notifikasi & pasang ke home screen ----------
let push = 'unsupported';

function pushRow() {
  switch (push) {
    case 'ok': return `<button class="btn ghost push-btn" data-push-on>🔔 Ingetin aku jam 7 malem</button>`;
    case 'on': return `<p class="push-note">🔔 Pengingat jam 7 malem aktif</p>`;
    case 'denied': return `<p class="push-note">🔕 Notif diblokir. Nyalain lagi di pengaturan HP buat game ini yaa</p>`;
    case 'ios-install': return `<p class="push-note">📲 Mau diingetin jam 7 malem? Pasang game ini dulu: tap <b>Share</b> → <b>Add to Home Screen</b>, terus buka dari ikonnya</p>`;
    default: return '';
  }
}

async function refreshPush() {
  try { push = await pushState(); } catch { push = 'unsupported'; }
  renderStreak();
}

document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-push-on]')) return;
  sfx('click');
  try {
    push = await enablePush();
    if (push === 'on') toast('🔔 Sip! Nanti diingetin jam 7 malem kalau belum main');
  } catch {
    toast('Yahh notif gagal diaktifin, coba lagi nanti 🥺');
  }
  renderStreak();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(refreshPush).catch(() => {});
}

let installPrompt = null;
const installBtn = $('#btn-install');
const isStandaloneApp = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
if (/Android/i.test(navigator.userAgent) && !isStandaloneApp) {
  // Chrome kadang nggak langsung nawarin install; tombolnya tetap muncul, isinya petunjuk manual
  installBtn.hidden = false;
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  sfx('click');
  if (!installPrompt) {
    toast('Buka menu ⋮ di pojok kanan atas Chrome, terus pilih "Instal aplikasi" / "Tambahkan ke Layar utama" 📲');
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

refreshStreak();

// ---------- Hati melayang di background ----------
const bg = $('#bg-hearts');
const BG_EMOJI = ['💗', '💕', '🌸', '✨', '💖', '🤍'];
for (let i = 0; i < 16; i++) {
  const s = document.createElement('span');
  s.textContent = BG_EMOJI[i % BG_EMOJI.length];
  s.style.left = `${Math.random() * 100}%`;
  s.style.fontSize = `${14 + Math.random() * 18}px`;
  s.style.animationDuration = `${12 + Math.random() * 12}s`;
  s.style.animationDelay = `${-Math.random() * 20}s`;
  bg.appendChild(s);
}
