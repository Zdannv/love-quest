// Level Main Berdua.
// - Petualangan: 5 dunia × 6 level campur (makin jauh makin susah).
// - Per game: tiap jenis game punya 10 level sendiri yang makin susah.
// Progres (bintang) disimpan di HP masing-masing, lalu disamain tiap kalian nyambung.
import { CONFIG } from './config.js';
import { LEVEL_MAP } from './level-map.js';

const PATTERN = ['flyco', 'tebak', 'odd', 'memoryco', 'samaan', 'puzzle'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
    default: return {};
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
// Urutan jenis game di menu "Per game"
export const DUO_TYPES = ['flyco', 'tebak', 'samaan', 'odd', 'memoryco', 'puzzle', 'simonco', 'popco', 'catchco', 'stackco', 'throwco'];
export const TRACK_LEN = 10;

export const DUO_LEVELS = LEVEL_MAP.flatMap((w, wi) => PATTERN.map((type, k) => ({
  id: `d${wi}-${k}`, idx: wi * 6 + k, world: wi, num: wi * 6 + k + 1, type, params: duoParams(type, wi),
})));

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
export function duoStars() {
  try { return JSON.parse(localStorage.getItem(KEY()) || '{}'); } catch { return {}; }
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
  for (const [id, s] of Object.entries(other || {})) {
    if (typeof s === 'number' && s > (all[id] || 0) && s <= 3) { all[id] = s; changed = true; }
  }
  if (changed) saveDuoStars(all);
  return changed;
}
export function duoUnlocked(L, stars = duoStars()) {
  if (L.track) return L.k === 0 || (stars[`t-${L.track}-${L.k - 1}`] || 0) > 0;
  return L.idx === 0 || (stars[DUO_LEVELS[L.idx - 1].id] || 0) > 0;
}
