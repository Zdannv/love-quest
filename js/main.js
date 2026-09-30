import { CONFIG } from './config.js';
import { getNames, setNames, fill, getLook, setLook, getChars, getFace, saveFace, clearFace } from './personal.js';
import { THEMES, CHARACTERS, applyTheme } from './themes.js';
import { SHOWCASES } from './showcase.js';
import { initTalk } from './talk.js';
import { mountOnline, enterLobby, refreshLobby, inviteGame, on as onNet, send as sendNet, me as meNet, peer as peerNet, playerLook } from './online.js';
import { ONLINE_GAMES, LEVEL_GAMES } from './online-games.js';
import { DUO_NAMES, recordDuo, duoUnlocked, getDuoLevel, nextDuoLevel, duoLabel } from './duo-levels.js';
import { askProfile, forget as forgetProfile } from './profile.js';
import { LEVEL_MAP, PATTERN, EXTRA_SLOTS, TYPE_NAME, typeOf } from './level-map.js';
import { sfx, toggleMute, isMuted, toggleMusic, isMusicOff, holdMusic } from './audio.js';
import { confetti } from './confetti.js';
import { esc, pick, shuffle } from './util.js';
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
  if (L.endless) return `Main terus sampai nyawa habis, makin lama makin susah! Rekor kamu: ${L.params.best || 0} ${SCORE_UNIT[L.type]} 🏆`;
  const p = levelParams(L); // sudah berisi karakter & nama pilihan
  const c = getChars();
  const n = getNames();
  switch (L.type) {
    case 'memory': return `Cari ${p.pairs} pasang kartu kembar dalam ${p.time} detik!`;
    case 'catch': return `Geser ${c.pengirim.emoji} buat nangkep ${p.good.join('')}, hindari ${p.bad.join('')}! Target ${p.target}. Ada bonus jatuh? Tangkep! +10`;
    case 'pop': return p.faces?.length
      ? `Tap muka ${p.faces.length > 1 ? `${n.pasangan} & ${n.pengirim}` : 'yang muncul'} secepatnya (${p.gold} = +3), jangan tap ${p.bad[0]}! Target ${p.target}.`
      : `Tap ${p.good.join('')} secepatnya (${p.gold} = +3), jangan tap ${p.bad[0]}! Target ${p.target}.`;
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

// ---------- Main Sendiri: Pilih game (tiap jenis game punya level sendiri, makin susah) ----------
const SOLO_TYPES = ['fly', 'runner', 'stack', 'catch', 'timing', 'simon', 'memory', 'pop', 'puzzle', 'odd', 'throw', 'maze', 'quiz'];
const trackLen = (t) => (t === 'quiz' ? Math.min(5, CONFIG.quiz.length) : 10);
const worldParams = (wi, type) => [wi, wi - 1, wi + 1, wi - 2, 0].map((x) => LEVELS.find((L) => L.world === x && L.type === type && !L.bonus)?.params).find(Boolean);
// k = level 0..9 → setelan game (dipakai juga buat Main Berdua yang skornya dijumlah). Karakter & muka diisi levelParams().
function trackParams(type, k) {
  const wi = Math.min(4, Math.floor(k / 2));
  const w = WORLDS[wi];
  const d = k * 0.4; // 0 … 3.6
  const odd = k % 2; // level ganjil di dunia yang sama sedikit lebih susah
  switch (type) {
    case 'memory': { const pairs = [3, 4, 4, 5, 6, 6, 8, 8, 10, 10][k]; return { pairs, emojis: w.memory, time: Math.round(pairs * (7 - Math.min(wi, 3) * 0.6) + 12) }; }
    case 'catch': return catchParams(w, d);
    case 'pop': return popParams(wi, d);
    case 'quiz': return { questions: CONFIG.quiz[k] || CONFIG.quiz[0] };
    case 'puzzle': return PUZZLE(k < 3 ? 3 : k < 7 ? 4 : 5, 90 + k * 15);
    case 'odd': return G.odd(5 + k, k < 4 ? 5 : 6, 38 + k * 3);
    case 'simon': return G.simon(4 + Math.ceil(k / 2), Math.round(700 - k * 25));
    case 'fly': return G.fly(5 + k, Math.round(230 - k * 5), 135 + k * 5, Math.round(245 - k * 3));
    case 'stack': return { type: 'stack', target: 6 + Math.floor(k / 2), speed: 160 + k * 14, speedUp: 6, lives: 3 };
    case 'runner': { const b = worldParams(wi, 'runner'); return { ...b, time: b.time + odd * 2, speed: b.speed + odd * 12 }; }
    case 'throw': { const b = G.throw(wi); return { ...b, speed: b.speed + odd * 12 }; }
    case 'maze': { const b = G.maze(wi); return { ...b, time: b.time - odd * 5 }; }
    case 'timing': { const b = G.timing(wi); return { ...b, speed: +(b.speed + odd * 0.08).toFixed(2) }; }
    default: return {};
  }
}
function soloTrack(type, k) {
  if (!SOLO_TYPES.includes(type) || k < 0 || k >= trackLen(type)) return null;
  // Puzzle per game: fotonya gantian pakai foto puzzle tiap dunia
  const world = type === 'puzzle' ? k % 5 : Math.min(4, Math.floor(k / 2));
  return { id: `s-${type}-${k}`, track: type, k, num: k + 1, type, world, params: trackParams(type, k) };
}
// Mode skor: game yang bisa dimainin terus → nggak ada level, main sampai nyawa habis, simpan rekor
const ENDLESS = ['fly', 'runner', 'stack', 'catch', 'timing', 'simon'];
const BEST_KEY = () => `lq-best-${CONFIG.slug || CONFIG.showcase || 'demo'}`;
const bestScores = () => { try { return JSON.parse(localStorage.getItem(BEST_KEY()) || '{}'); } catch { return {}; } };
function saveBest(type, score) {
  const all = bestScores();
  if (score <= (all[type] || 0)) return false;
  all[type] = score;
  try { localStorage.setItem(BEST_KEY(), JSON.stringify(all)); } catch {}
  return true;
}
const SCORE_UNIT = { fly: 'tiang', runner: 'detik', stack: 'tingkat', catch: 'poin', timing: 'kena', simon: 'urutan' };
function endlessLevel(type) {
  const inf = Number.POSITIVE_INFINITY;
  const params = { ...trackParams(type, 1), endless: true, best: bestScores()[type] || 0, ...(type === 'runner' || type === 'catch' ? { time: inf } : { target: inf }) };
  return { id: `e-${type}`, track: type, endless: true, num: 0, k: 0, type, world: 0, params };
}
const trackOpen = (L) => TEST_MODE || CONFIG.showcase || L.k === 0 || (progress.stars[`s-${L.track}-${L.k - 1}`] || 0) > 0;

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
const screens = { home: $('#screen-home'), map: $('#screen-map'), game: $('#screen-game'), letter: $('#screen-letter'), talk: $('#screen-talk'), online: $('#screen-online') };
const talk = initTalk({ sfx }); // Kartu Deep Talk
const stageEl = $('#stage');
const modal = $('#modal');

function show(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
  document.body.classList.toggle('playing', name === 'game');
  if (name === 'map') renderMap();
  if (name === 'home' || name === 'map') refreshStreak();
  if (name === 'letter') renderLetter();
  if (name === 'talk') talk.reset();
  else talk.setSync(false);
  if (name === 'online') enterLobby();
  window.scrollTo(0, 0);
}

// ---------- Kartu Deep Talk ----------
$('#btn-talk').addEventListener('click', () => { sfx('click'); show('talk'); });

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
  document.title = CONFIG.demo ? 'Love Quest 💖 Game couple buat pasanganmu' : `${pasangan}'s Love Quest 💖`;
}
applyNames();
if (!CONFIG.demo) document.querySelectorAll('[data-demo-only]').forEach((el) => (el.hidden = true));
document.body.classList.toggle('is-demo', Boolean(CONFIG.demo)); // tata letak desktop halaman depan
document.body.classList.remove('booting'); // nama & tema udah kepasang, tampilan boleh muncul

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

// ---------- Video tutorial: lagu latar diem dulu selama videonya diputar ----------
document.querySelectorAll('.tutorial video').forEach((v) => {
  v.addEventListener('play', () => holdMusic(true));
  v.addEventListener('pause', () => holdMusic(false));
  v.addEventListener('ended', () => holdMusic(false));
});

// ---------- Paket ----------
function showPackages() {
  modal.querySelector('.modal-card').innerHTML = `
    <div class="owl-react happy"><span class="owl">${getChars().pasangan.emoji}</span><span class="owl-extra">💌</span></div>
    <h2>Bikin versi kalian!</h2>
    <p class="detail">Kamu dapat akun CMS buat ngelola isi game-nya sendiri, jadi semuanya bisa diganti sesuai cerita kalian berdua</p>
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
// Demo: nyobanya langsung di contoh versi jadi (Kirana & Arga)
if (CONFIG.demo) $('#btn-play').textContent = '🎮 Coba main gratis';
// Main yuk → pilih mode: sendiri (peta level) atau berdua (online)
$('#btn-play').addEventListener('click', () => {
  sfx('click');
  if (CONFIG.demo) { location.href = '/?lihat=kirana-arga'; return; }
  modal.querySelector('.modal-card').innerHTML = `
    <h2>Mau main gimana?</h2>
    <div class="mode-pick">
      <button class="mode-card" type="button" data-mode="solo"><span>🎮</span><b>Main Sendiri</b><small>${MAIN.length} level + bonus puzzle foto</small></button>
      <button class="mode-card duo" type="button" data-mode="duo"><span>💞</span><b>Main Berdua</b><small>Online bareng pasangan / temen dari HP masing-masing</small></button>
    </div>
    <button class="link-btn" type="button" data-act="close">batal</button>`;
  modal.classList.remove('hidden');
});
modal.addEventListener('click', (e) => {
  const mode = e.target.closest('[data-mode]')?.dataset.mode;
  if (!mode) return;
  sfx('click');
  closeModal();
  show(mode === 'solo' ? 'map' : 'online');
});
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

let soloTab = 'adv', soloTrackType = '';
function renderMap() {
  $('#solo-tabs').innerHTML = [['adv', '🗺️ Petualangan'], ['per', '🎯 Pilih game']].map(([id, t]) => `<button type="button" role="tab" data-solo-tab="${id}" aria-selected="${soloTab === id}">${t}</button>`).join('');
  if (soloTab === 'per') return renderTracks();
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

function renderTracks() {
  const st = (id) => progress.stars[id] || 0;
  if (soloTrackType) {
    const t = soloTrackType;
    const levels = [...Array(trackLen(t))].map((_, k) => soloTrack(t, k));
    const got = levels.reduce((a, L) => a + st(L.id), 0);
    const cur = levels.find((L) => trackOpen(L) && !st(L.id));
    worldsEl.innerHTML = `
      <button type="button" class="link-btn ol-back" data-solo-track="">← semua game</button>
      <section class="world w-flower track-card">
        <header class="world-head">
          <span class="world-icon">${TYPE_ICON[t]}</span>
          <div><small>Makin tinggi levelnya, makin susah</small><h2>${TYPE_NAME[t]}</h2></div>
          <span class="world-stars">⭐ ${got}/${levels.length * 3}</span>
        </header>
        <div class="levels">${levels.map((L) => {
          const s = st(L.id), ok = trackOpen(L);
          return `<button class="lvl ${!ok ? 'locked' : L === cur ? 'current' : s ? 'done' : ''}" data-track-lvl="${L.k}" ${ok ? '' : 'disabled'}>
            <span class="lvl-type">${ok ? TYPE_ICON[t] : '🔒'}</span><span class="lvl-num">${L.num}</span>
            <span class="lvl-stars">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span></button>`;
        }).join('')}</div>
      </section>`;
    $('#star-count').textContent = `${got}/${levels.length * 3}`;
    return;
  }
  let all = 0;
  const card = (t) => {
    if (ENDLESS.includes(t)) {
      return `<button type="button" class="ol-game" data-endless="${t}">
        <span class="ol-game-icon">${TYPE_ICON[t]}</span>
        <span><b>${TYPE_NAME[t]}</b><small>Main terus sampai nyawa habis</small></span>
        <span class="track-prog">🏆 ${bestScores()[t] || 0}<small>rekor</small></span>
      </button>`;
    }
    const n = trackLen(t);
    const got = [...Array(n)].reduce((a, _, k) => a + st(`s-${t}-${k}`), 0);
    const done = [...Array(n)].filter((_, k) => st(`s-${t}-${k}`)).length;
    all += got;
    return `<button type="button" class="ol-game" data-solo-track="${t}">
      <span class="ol-game-icon">${TYPE_ICON[t]}</span>
      <span><b>${TYPE_NAME[t]}</b><small>${n} level</small></span>
      <span class="track-prog">${done}/${n}<small>⭐ ${got}</small></span>
    </button>`;
  };
  worldsEl.innerHTML = `<p class="ol-section">🏆 Mode skor: main terus, kejar rekor</p><div class="track-list">${SOLO_TYPES.filter((t) => ENDLESS.includes(t)).map(card).join('')}</div>`
    + `<p class="ol-section" style="margin-top:18px">⭐ Pakai level: makin tinggi makin susah</p><div class="track-list">${SOLO_TYPES.filter((t) => !ENDLESS.includes(t)).map(card).join('')}</div>`;
  $('#star-count').textContent = `${all}`;
}
$('#solo-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-solo-tab]');
  if (!b) return;
  sfx('click');
  soloTab = b.dataset.soloTab;
  soloTrackType = '';
  renderMap();
});

worldsEl.addEventListener('click', (e) => {
  const en = e.target.closest('[data-endless]');
  if (en) { sfx('click'); startLevel(endlessLevel(en.dataset.endless)); return; }
  const tr = e.target.closest('[data-solo-track]');
  if (tr) { sfx('click'); soloTrackType = tr.dataset.soloTrack; renderMap(); window.scrollTo(0, 0); return; }
  const tl = e.target.closest('[data-track-lvl]');
  if (tl && !tl.disabled) { sfx('click'); startLevel(soloTrack(soloTrackType, +tl.dataset.trackLvl)); return; }
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
  const L = typeof i === 'object' ? i : LEVELS[i]; // angka = level peta, objek = level per game / mode skor
  show('game');
  screens.game.dataset.theme = WORLDS[L.world].theme;
  stageEl.innerHTML = '';
  $('#hud-title').textContent = L.endless ? `${TYPE_NAME[L.type]} · Mode skor 🏆` : L.track ? `${TYPE_NAME[L.type]} · Level ${L.num}` : `${levelLabel(L)} · ${TYPE_NAME[L.type]}`;
  hintText = hintFor(L);
  $('#hud-stats').textContent = '';

  const token = {};
  let combo = 0;
  current = { i, L, token, game: null };
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
// Foto yang beneran diupload (bukan foto contoh)
function userPhotos() {
  if (CONFIG.demo) return [];
  const p = CONFIG.photos || {};
  return [p.letter, ...(p.bonus || [])];
}

function photoFor(L) {
  if (CONFIG.demo) return SAMPLE_PHOTO;
  const p = CONFIG.photos || {};
  return (L && (L.bonus || L.track === 'puzzle') && p.bonus?.[L.world]) || p.letter || SAMPLE_PHOTO;
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
  if (L.type === 'catch') return { ...L.params, bonusImage: faceB || null, carrier: c.pengirim.emoji };
  if (L.type === 'pop') {
    // Kalau ada foto muka (Premium), yang muncul dari lubang muka kalian
    const faces = [faceA, faceB].filter(Boolean);
    return { ...L.params, good: [c.pasangan.emoji, c.pengirim.emoji], faces };
  }
  if (L.type === 'memory') {
    // Sebagian kartu pakai foto kalian (muka, foto utama, foto puzzle), sisanya emoji
    const photos = [...new Set([faceA, faceB, ...userPhotos()].filter(Boolean))];
    const n = Math.min(photos.length, Math.ceil(L.params.pairs / 2));
    return { ...L.params, photos: shuffle(photos).slice(0, n) };
  }
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

$('#btn-quit').addEventListener('click', () => {
  sfx('click');
  const wasOnline = current?.online;
  stopGame();
  closeModal();
  if (wasOnline) { sendNet('quit'); show('online'); } else show('map');
});

// ---------- Main Bareng (online) ----------
mountOnline({
  sfx, toast, closeModal,
  modal: (html) => { modal.querySelector('.modal-card').innerHTML = html; modal.classList.remove('hidden'); },
  startGame: (game, seed, extra) => startOnline(game, seed, null, extra),
  startLevel: (id, seed, extra) => startOnline('level', seed, id, extra),
  openTalk: () => { show('talk'); talk.setSync(true); },
});

function onlineParams(game, L) {
  // Game "skor dijumlah": pakai setelan game sendirian di level yang sama (lengkap sama karakter & muka)
  const SUM_BASE = { popco: 'pop', catchco: 'catch', stackco: 'stack', throwco: 'throw' };
  if (SUM_BASE[game]) {
    const k = L?.params.k ?? 0;
    return levelParams({ type: SUM_BASE[game], world: Math.min(4, Math.floor(k / 2)), params: trackParams(SUM_BASE[game], k) });
  }
  if (game === 'flyco') game = 'fly';
  if (game === 'memoryco') game = 'memory';
  if (game === 'fly') return { ...LEVELS.find((L) => L.type === 'fly').params };
  if (game === 'puzzle') return { image: photoFor(null), aspect: '3 / 4' };
  if (game === 'memory') {
    const photos = [...new Set([getFace('pasangan'), getFace('pengirim'), ...userPhotos()].filter(Boolean))];
    return { emojis: WORLDS[0].memory, photos };
  }
  return {};
}

function startOnline(game, seed, levelId = null, extra = {}) {
  stopGame();
  closeModal();
  const L = getDuoLevel(levelId);
  const G = L ? LEVEL_GAMES[L.type] : ONLINE_GAMES[game];
  const m = meNet(), p = peerNet();
  if (!G || !p) { show('online'); return; }
  show('game');
  screens.game.dataset.theme = WORLDS[L ? L.world : 0].theme;
  stageEl.innerHTML = '';
  $('#hud-title').textContent = L ? `Berdua · ${duoLabel(L)}${L.track ? '' : ' · ' + DUO_NAMES[L.type]}` : `Main Bareng · ${G.name}`;
  $('#hud-stats').textContent = '';
  hintText = L ? `Level ${L.num}: ${DUO_NAMES[L.type]} bareng ${p.name} 💞` : G.desc;
  const token = {};
  current = { i: -1, token, game: null, online: game };
  const live = () => current?.token === token;
  const ctx = {
    seed, send: sendNet, on: onNet, params: onlineParams(L ? L.type : game, L), level: L, extra,
    me: { ...playerLook(m.role, m.name), role: m.role },
    peer: { ...playerLook(p.role, p.name), role: p.role },
  };
  const api = {
    setStats: (s) => { if (live()) $('#hud-stats').textContent = s; },
    sfx,
    say: (text, mood) => { if (live()) owlSay(fill(text), mood); },
    streak: () => 0,
    finish: (r) => onlineFinish(token, game, r, L),
  };
  const begin = () => { if (!live()) return; owlHint(); current.game = G.start(stageEl, api, ctx); };
  if (G.countdown) { owlSay('Siap-siap! 💞', 'happy', 0); countdown(token, begin); }
  else begin();
}

function onlineFinish(token, game, r, L) {
  if (current?.token !== token) return;
  if (r.win) { sfx('win'); confetti(); } else sfx('lose');
  if (L && r.stars) recordDuo(L.id, r.stars);
  if (L) recordPlay().then((isNew) => { if (isNew) { refreshStreak(true); if (!pendingPlays()) notifyPlayed(); } }).catch(() => {});
  setTimeout(() => {
    if (current?.token !== token) return;
    stopGame();
    const next = L && r.win ? nextDuoLevel(L) : null;
    const stars = L && r.win ? `<div class="stars">${[0, 1, 2].map((k) => `<span class="star ${k < r.stars ? 'on' : ''}" style="animation-delay:${0.25 + k * 0.25}s">★</span>`).join('')}</div>` : '';
    modal.querySelector('.modal-card').innerHTML = `
      <div class="modal-emoji bounce">${r.icon || '💞'}</div>
      ${L ? `<p class="detail">${esc(duoLabel(L))}${L.track ? '' : ' · ' + DUO_NAMES[L.type]}</p>` : ''}
      <h2>${esc(r.title)}</h2>
      ${stars}
      <p class="detail">${esc(r.detail)}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-go="online">${L ? '🗺️ Peta' : '🎮 Lobby'}</button>
        ${L ? `<button class="btn ${next ? 'ghost' : ''}" data-ol-level="${L.id}">🔁 Ulangi</button>` : `<button class="btn" data-ol-again="${game}">Main lagi 🔁</button>`}
        ${next && duoUnlocked(next) ? `<button class="btn" data-ol-level="${next.id}">Lanjut ▶</button>` : ''}
      </div>`;
    modal.classList.remove('hidden');
    refreshLobby();
  }, 700);
}
modal.addEventListener('click', (e) => {
  const again = e.target.closest('[data-ol-again]');
  const lvl = e.target.closest('[data-ol-level]');
  if (!again && !lvl) return;
  sfx('click');
  closeModal();
  show('online');
  if (lvl) inviteGame('level', lvl.dataset.olLevel);
  else inviteGame(again.dataset.olAgain);
});
const peerGone = (text) => {
  if (!current?.online) return;
  stopGame();
  closeModal();
  show('online');
  toast(text);
};
onNet('quit', () => peerGone(`${peerNet()?.name || 'Dia'} keluar dari game 🥺`));
onNet('peer-left', () => peerGone('Yahh, koneksinya putus 🥺'));

const LOSE_LINES = [
  'Hampir! Coba sekali lagi ya sayang 🥺',
  'Nggak apa-apa, {pengirim} tetep bangga sama {pasangan} 💪',
  'Sedikit lagi! {pengirim} percaya {pasangan} bisa 💕',
  'Kalah di game boleh, tapi di hati {pengirim} kamu selalu juara 🏆',
];

function onFinish(token, r) {
  if (current?.token !== token) return;
  const L = current.L;
  if (L.endless) return endlessFinish(token, L, r);
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

function endlessFinish(token, L, r) {
  recordPlay().then((isNew) => { if (isNew) { refreshStreak(true); if (!pendingPlays()) notifyPlayed(); } }).catch(() => {});
  const old = bestScores()[L.type] || 0;
  const record = saveBest(L.type, r.score || 0);
  if (record) { sfx('win'); confetti(); owlSay(fill('{suara}!! Rekor baru! 🏆'), 'happy', 0); } else { sfx('lose'); owlSay(fill(pick(OWL_LOSE)), 'sad', 0); }
  setTimeout(() => {
    if (current?.token !== token) return;
    stopGame();
    resultL = L;
    const unit = SCORE_UNIT[L.type];
    modal.querySelector('.modal-card').innerHTML = `
      <div class="owl-react ${record ? 'happy' : 'sad'}"><span class="owl">${getChars().pasangan.emoji}</span><span class="owl-extra">${record ? '🏆' : '💪'}</span></div>
      <p class="detail">${TYPE_NAME[L.type]} · Mode skor</p>
      <div class="score-big">${r.score || 0}<small>${unit}</small></div>
      <h2>${record ? 'Rekor baru! 🎉' : `Rekor kamu ${old} ${unit}`}</h2>
      <p class="detail">${esc(r.detail || '')}${record && old ? ` · rekor lama ${old}` : ''}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-go="map">🎯 Pilih game</button>
        <button class="btn" data-act="retry">Main lagi 🔁</button>
      </div>`;
    modal.classList.remove('hidden');
  }, 700);
}

let resultL = null;
function showTrackResult(L, r) {
  const next = r.win ? soloTrack(L.track, L.k + 1) : null;
  const stars = [0, 1, 2].map((k) => `<span class="star ${k < r.stars ? 'on' : ''}" style="animation-delay:${0.25 + k * 0.25}s">★</span>`).join('');
  modal.querySelector('.modal-card').innerHTML = `
    <div class="owl-react ${r.win ? 'happy' : 'sad'}"><span class="owl">${getChars().pasangan.emoji}</span><span class="owl-extra">${r.win ? (next ? '🎉' : '👑') : '💧'}</span></div>
    <p class="owl-line">${esc(fill(pick(r.win ? OWL_WIN : OWL_LOSE)))}</p>
    <h2>${r.win ? `${TYPE_NAME[L.type]} level ${L.num} beres!` : 'Yahh, belum berhasil'}</h2>
    ${r.win ? `<div class="stars">${stars}</div>` : ''}
    <p class="detail">${esc(r.detail)}${r.win && !next ? ' · Semua level game ini udah tamat! 🏆' : ''}</p>
    <div class="modal-actions">
      <button class="btn ghost" data-go="map">🎯 Pilih game</button>
      <button class="btn ${next ? 'ghost' : ''}" data-act="retry">🔁 Ulangi</button>
      ${next ? '<button class="btn" data-act="next">Lanjut ▶</button>' : ''}
    </div>`;
  modal.classList.remove('hidden');
}

function showResult(L, r) {
  resultL = L;
  if (L.track) return showTrackResult(L, r);
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
  if (resultL?.endless && act === 'retry') { startLevel(endlessLevel(resultL.type)); return; }
  if (resultL?.track && (act === 'retry' || act === 'next')) {
    const L = act === 'retry' ? resultL : soloTrack(resultL.track, resultL.k + 1);
    if (L) startLevel(L); else show('map');
    return;
  }
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
// Halaman depan demo nggak pakai contoh streak (udah ada di peta & contoh versi jadi)
const streakSlots = [CONFIG.demo ? null : $('#streak-home'), $('#streak-map')].filter(Boolean);
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
      <p class="streak-msg">Masuk ke profilmu biar streak berdua kalian kecatet 🔥</p>
      <div class="who-pick"><button class="btn ghost" data-profile>Masuk ke profil</button></div>
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
      ? '<p class="push-note">✨ Ini contoh streak. Di versi kalian, streak nyambung ke HP kalian berdua + ada notifikasi pengingat.</p>'
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
  if (e.target.closest('[data-profile]')) {
    sfx('click');
    askProfile({ sfx }).then((role) => { if (role) { streakData = null; refreshStreak(); } });
    return;
  }
  if (e.target.closest('[data-who-reset]')) {
    sfx('click');
    clearPlayer();
    forgetProfile();
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
// Halaman demo bukan game pembeli: tombol pasang ke home screen nggak ditampilin
if (CONFIG.demo) installBtn.remove();
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
