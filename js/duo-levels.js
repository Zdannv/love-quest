// Level Main Berdua (inti Love Quest sekarang: game couple yang dimainin berdua).
// - Petualangan: 10 dunia × 12 level = 120 level. Campuran game kerja sama ringan & game seru (duel / bareng).
//   Dunia 1–5 bawa pesan dari CMS + surat rahasia kebuka setelah level 60; dunia 6–10 = petualangan lanjutan.
// - Per game: tiap jenis game kerja sama punya 10 level sendiri yang makin susah.
// Progres (bintang) disimpan di HP masing-masing, lalu disamain tiap kalian nyambung.
import { CONFIG, DEFAULT_MSG } from './config.js';
import { LEVEL_MAP, levelList } from './level-map.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Dunia petualangan berdua. theme = kelas kartu peta, game = tema latar pas main (5 tema game yang udah ada)
export const DUO_WORLDS = [
  ...LEVEL_MAP.map((w, i) => ({ name: w.name, icon: w.icon, theme: ['w-flower', 'w-candy', 'w-beach', 'w-night', 'w-home'][i], game: ['w-flower', 'w-candy', 'w-beach', 'w-night', 'w-home'][i] })),
  { name: 'Hutan Peri', icon: '🍄', theme: 'w-forest', game: 'w-flower' },
  { name: 'Negeri Salju', icon: '❄️', theme: 'w-snow', game: 'w-beach' },
  { name: 'Taman Hiburan', icon: '🎡', theme: 'w-fair', game: 'w-candy' },
  { name: 'Luar Angkasa', icon: '🚀', theme: 'w-space', game: 'w-night' },
  { name: 'Hari Bahagia', icon: '💍', theme: 'w-wedding', game: 'w-home' },
];
export const PER_WORLD = 12;
export const LETTER_AFTER = 60; // surat rahasia kebuka setelah level ke-60 (akhir dunia 5)

// Game kerja sama ringan (L) & game seru (A). Tiap dunia: 7 ringan + 5 seru, game seru jadi "bos" di level terakhir.
const LIGHT = ['flyco', 'tebak', 'odd', 'memoryco', 'popco', 'samaan', 'catchco', 'puzzle', 'simonco', 'stackco', 'throwco'];
const ACTION = ['balloon', 'sumo', 'cook', 'math', 'pillow', 'coop', 'bomb', 'penalty', 'race', 'fight'];
const SLOTS = 'LLALALLALALA';
// Game seru: duel (siapa pun yang menang, levelnya beres) atau bareng (target skor)
export const DUEL_TYPES = ['sumo', 'math', 'bomb', 'pillow', 'penalty', 'race', 'fight'];
export const SCORE_TYPES = ['balloon', 'cook', 'coop'];
export const isAction = (t) => DUEL_TYPES.includes(t) || SCORE_TYPES.includes(t);

// d = tingkat kesulitan 0 … 4.5 (Petualangan: dunia 0–4; per game: level 1–10 → 0, 0.5, … 4.5)
export function duoParams(type, d) {
  switch (type) {
    case 'flyco': return { target: Math.round(6 + d * 3), gap: Math.round(225 - d * 8), speed: Math.round(140 + d * 8), spacing: Math.round(240 - d * 6), lives: 3 };
    case 'tebak': return { rounds: d < 2 ? 6 : 8, pass: 0.5 };
    case 'samaan': return { rounds: d < 2 ? 6 : 8, pass: clamp(0.4 + d * 0.02, 0.4, 0.5) };
    case 'odd': return { rounds: Math.round(8 + d * 2), size: d < 2 ? 4 : d < 4 ? 5 : 6, time: Math.round(40 + d * 5) };
    case 'memoryco': return { pairs: clamp(6 + Math.floor(d) * 1 + (d >= 2 ? 1 : 0), 6, 12) };
    case 'puzzle': return { size: d < 1.5 ? 3 : d < 3.5 ? 4 : 5, time: Math.round(90 + d * 25) };
    case 'simonco': return { target: Math.round(5 + d * 1.6), speed: Math.round(clamp(680 - d * 45, 420, 680)) };
    // Main barengan game sendiri-sendiri, skornya dijumlah: k = level buat ambil setelan game sendirian
    case 'popco': case 'catchco': case 'stackco': case 'throwco': return { k: Math.round(d * 2), mult: 1.6 };
    // Game seru: tier = tingkat dunia; game bareng punya target
    case 'balloon': return { tier: clamp(Math.round(d * 2), 0, 9), goal: Math.round(150 + d * 110) };
    case 'cook': return { tier: clamp(Math.round(d * 2), 0, 9), goal: Math.round(4 + d * 1.6) };
    case 'coop': return { tier: clamp(Math.round(d * 2), 0, 9), level: clamp(Math.round(d * 2), 0, 9) };
    default: return isAction(type) ? { tier: clamp(Math.round(d * 2), 0, 9) } : {};
  }
}

export const DUO_NAMES = {
  flyco: 'Terbang Berdua', tebak: 'Tebak Pasangan', samaan: 'Samaan Yuk', odd: 'Cari yang Beda',
  memoryco: 'Kartu Kembar Bareng', puzzle: 'Puzzle Bareng', simonco: 'Ingat Urutan Bareng',
  popco: 'Tap si Imut Berdua', catchco: 'Tangkap Cinta Berdua', stackco: 'Susun Kue Berdua', throwco: 'Lempar Hati Berdua',
};
export const DUO_ICONS = {
  flyco: '🕊️', tebak: '💞', samaan: '🤝', odd: '🔍', memoryco: '🃏', puzzle: '🧩', simonco: '🎵',
  popco: '👆', catchco: '🧺', stackco: '🎂', throwco: '🎯',
};
export const DUO_DESC = {
  flyco: 'Terbang barengan, tiang kalian dijumlah', tebak: 'Seberapa kenal kamu sama dia?', samaan: 'Tanpa ngobrol, pilih jawaban yang sama',
  odd: 'Siapa cepet dia dapet, poinnya buat berdua', memoryco: 'Gantian buka kartu, gerakannya terbatas', puzzle: 'Susun foto kalian berdua-duaan',
  simonco: 'Gantian ngulang urutan yang nyala', popco: 'Main barengan, skor kalian dijumlah', catchco: 'Tangkep barengan, skor kalian dijumlah',
  stackco: 'Susun kue masing-masing, tingkatnya dijumlah', throwco: 'Lempar barengan, yang kena dijumlah',
};
// Game seru yang ikut jadi level (nama & ikon sama kayak di Main bebas)
Object.assign(DUO_NAMES, { balloon: 'Balon Berdua', sumo: 'Sumo Gemoy', cook: 'Masak Bareng', math: 'Adu Hitung', pillow: 'Perang Bantal', coop: 'Jalan Pulang Berdua', bomb: 'Bom Cinta', penalty: 'Adu Penalti', race: 'Ngebut Pulang', fight: 'Gelut Sayang' });
Object.assign(DUO_ICONS, { balloon: '🎈', sumo: '🤼', cook: '🧑‍🍳', math: '🧮', pillow: '🛏️', coop: '🏠', bomb: '💣', penalty: '⚽', race: '🏍️', fight: '🥊' });
Object.assign(DUO_DESC, {
  balloon: 'Satu pegang 🔥 kiri, satu kanan. Terbang sampai target!', sumo: 'Duel seruduk! Siapa pun yang menang, levelnya beres',
  cook: 'Masak bareng, kejar target pesanan', math: 'Adu cepet ngitung, yang kalah tetep dapet bintang',
  pillow: 'Perang bantal! Yang menang dapet ⭐⭐⭐', coop: 'Api & air kerja sama sampai pintu rumah',
  bomb: 'Duel bom! Yang menang dapet ⭐⭐⭐', penalty: 'Gantian nendang & jaga gawang',
  race: 'Balapan motor ke finish', fight: 'Duel langsung, muka kalian jadi petarungnya',
});
// Urutan jenis game di menu "Per game"
export const DUO_TYPES = ['flyco', 'tebak', 'samaan', 'odd', 'memoryco', 'puzzle', 'simonco', 'popco', 'catchco', 'stackco', 'throwco'];
export const TRACK_LEN = 10;

export const DUO_LEVELS = DUO_WORLDS.flatMap((w, wi) => {
  let l = (wi * 7) % LIGHT.length, a = (wi * 3) % ACTION.length;
  return [...SLOTS].map((slot, k) => {
    const type = slot === 'L' ? LIGHT[l++ % LIGHT.length] : ACTION[a++ % ACTION.length];
    const idx = wi * PER_WORLD + k;
    return { id: `a${wi}-${k}`, idx, world: wi, num: idx + 1, type, params: duoParams(type, wi * 0.5 + (k >= 6 ? 0.25 : 0)) };
  });
});

// Pesan dari CMS: dunia 1–5 (level 1–60) pakai pesan yang ditulis pembeli (urut kayak di CMS).
// Kalau masih teks bawaan / kosong, pakai pesan bawaan versi berdua.
const CMS_SLOTS = levelList().filter((it) => !it.bonus);
export const duoMsgSlot = (idx) => CMS_SLOTS[idx] || null;
const DUO_MSG = [
  'Level pertama beres berdua! Ternyata kita kompak juga ya hehe 💞',
  'Main bareng kamu tuh selalu seru, menang kalah tetep ketawa 😆',
  'Satu level lagi beres. Satu kenangan lagi kita bikin bareng 🫶',
  '{pasangan} & {pengirim}: tim paling lucu sedunia 🏆',
  'Kalau kalah, gapapa. Yang penting mainnya sama kamu 🥰',
  'Kita tuh kayak puzzle, beda bentuk tapi pas banget 🧩',
  'Makasih udah mau main bareng, padahal lagi capek kan? 🥹',
  'Kompaknya kita bikin level ini kerasa gampang ✨',
  'Rekor baru: hari ini kita main bareng lagi 🔥',
  'Dunia ini beres! Lanjut petualangan berikutnya bareng yaa 🗺️',
  'Siapa pun yang menang, hadiahnya tetep: kita 💖',
  'Ketawa bareng kamu tuh obat paling ampuh 😂',
  'Pelan-pelan aja, yang penting jalannya berdua 🐾',
  'Tiap level kayak kencan kecil, dan aku suka banget 🎈',
  'Kangen kamu, makanya ngajak main terus hehe 🙈',
  'Kalau kita satu tim, nggak ada yang nggak bisa 💪',
  'Inget nggak pertama kali kita ketemu? Sekarang malah main game bareng 🥹',
  'Dari semua co-op di dunia, partner terbaikku tetep kamu 🎮',
  'Bintangnya buat kita berdua, sayangnya buat kamu semua ⭐',
  'Nggak sabar main level berikutnya bareng kamu 💫',
];
export function duoMsg(L) {
  if (!L || L.track) return '';
  const slot = duoMsgSlot(L.idx);
  const custom = slot ? CONFIG[slot.field]?.[slot.index] : '';
  if (custom && !DEFAULT_MSG.has(custom)) return custom;
  if ((L.idx + 1) === LETTER_AFTER) return 'Dunia 5 tamat berdua! Ada surat rahasia yang nunggu kamu buka sekarang 💌';
  if ((L.idx + 1) === DUO_LEVELS.length) return 'SEMUA 120 level tamat berdua!! Kalian pasangan paling kompak sedunia 👑💞';
  return DUO_MSG[L.idx % DUO_MSG.length];
}

// Level per game: id `t-<jenis>-<nomor 0..9>`
export function trackLevel(type, k) {
  if (!DUO_NAMES[type] || k < 0 || k >= TRACK_LEN) return null;
  return { id: `t-${type}-${k}`, track: type, k, world: Math.min(4, Math.floor(k / 2)), num: k + 1, type, params: duoParams(type, k * 0.5) };
}
// Cari level dari id (Petualangan atau per game)
export function getDuoLevel(id) {
  if (!id) return null;
  const t = /^t-([a-z]+)-(\d+)$/.exec(id);
  if (t) return trackLevel(t[1], +t[2]);
  return DUO_LEVELS.find((L) => L.id === id) || null;
}
export function nextDuoLevel(L) {
  if (L.track) return trackLevel(L.track, L.k + 1);
  return DUO_LEVELS[L.idx + 1] || null;
}
export const duoLabel = (L) => `${L.track ? DUO_NAMES[L.type] + ' · ' : ''}Level ${L.num}`;

// ---------- Progres ----------
const KEY = () => `lq-duo-${CONFIG.slug || (CONFIG.showcase ? `contoh-${CONFIG.showcase}` : 'demo')}`;
// Versi lama (30 level, id d<dunia>-<k>): bintangnya dipindah ke level baru di urutan yang sama
function migrate(all) {
  let moved = false;
  for (const [id, s] of Object.entries(all)) {
    const m = /^d(\d)-(\d)$/.exec(id); if (!m) continue;
    const L = DUO_LEVELS[+m[1] * 6 + +m[2]];
    if (L && s > (all[L.id] || 0)) all[L.id] = s;
    delete all[id]; moved = true;
  }
  return moved;
}
export function duoStars() {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(KEY()) || '{}') || {}; } catch {}
  if (migrate(all)) saveDuoStars(all);
  return all;
}
export function saveDuoStars(stars) {
  try { localStorage.setItem(KEY(), JSON.stringify(stars)); } catch {}
}
export function recordDuo(id, stars) {
  const all = duoStars();
  if ((all[id] || 0) >= stars) return false;
  all[id] = stars;
  saveDuoStars(all);
  return true;
}
// Gabungin progres dari HP pasangan (ambil bintang terbanyak)
export function mergeDuo(other) {
  const all = duoStars();
  let changed = false;
  other = { ...(other || {}) }; migrate(other);
  for (const [id, s] of Object.entries(other)) {
    if (typeof s === 'number' && s > (all[id] || 0) && s <= 3) { all[id] = s; changed = true; }
  }
  if (changed) saveDuoStars(all);
  return changed;
}
export function duoUnlocked(L, stars = duoStars()) {
  if (CONFIG.showcase || duoAllOpen) return true; // coba gratis: semua level kebuka
  if (L.track) return L.k === 0 || (stars[`t-${L.track}-${L.k - 1}`] || 0) > 0;
  return L.idx === 0 || (stars[DUO_LEVELS[L.idx - 1].id] || 0) > 0;
}
export let duoAllOpen = false; // mode tes (?bukasemua)
export function openAllDuo() { duoAllOpen = true; }
export const duoCleared = (n, stars = duoStars()) => (stars[DUO_LEVELS[n - 1]?.id] || 0) > 0;
