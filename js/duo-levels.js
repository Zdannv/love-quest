// Peta Main Berdua: 5 dunia × 6 level kerja sama. Makin jauh dunianya, makin susah.
// Progres (bintang) disimpan di HP masing-masing, lalu disamain tiap kalian nyambung.
import { CONFIG } from './config.js';
import { LEVEL_MAP } from './level-map.js';

const PATTERN = ['flyco', 'tebak', 'odd', 'memoryco', 'samaan', 'puzzle'];

function params(type, d) {
  switch (type) {
    case 'flyco': return { target: 6 + d * 3, gap: 225 - d * 8, speed: 140 + d * 8, spacing: 240 - d * 6, lives: 3 };
    case 'tebak': return { rounds: d < 2 ? 6 : 8, pass: 0.5 };
    case 'samaan': return { rounds: d < 2 ? 6 : 8, pass: 0.4 };
    case 'odd': return { rounds: 8 + d * 2, size: d < 2 ? 4 : 5, time: 40 + d * 5 };
    case 'memoryco': return { pairs: [6, 6, 8, 8, 10][d] };
    case 'puzzle': return { size: d < 2 ? 3 : 4, time: [90, 90, 150, 150, 180][d] };
    default: return {};
  }
}

export const DUO_NAMES = {
  flyco: 'Terbang Berdua', tebak: 'Tebak Pasangan', samaan: 'Samaan Yuk', odd: 'Cari yang Beda',
  memoryco: 'Kartu Kembar Bareng', puzzle: 'Puzzle Bareng',
};
export const DUO_ICONS = { flyco: '🕊️', tebak: '💞', samaan: '🤝', odd: '🔍', memoryco: '🃏', puzzle: '🧩' };

export const DUO_LEVELS = LEVEL_MAP.flatMap((w, wi) => PATTERN.map((type, k) => ({
  id: `d${wi}-${k}`, idx: wi * 6 + k, world: wi, num: wi * 6 + k + 1, type, params: params(type, wi),
})));

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
export const duoUnlocked = (L, stars = duoStars()) => L.idx === 0 || (stars[DUO_LEVELS[L.idx - 1].id] || 0) > 0;
