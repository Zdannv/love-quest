// Penghitung kecil buat halaman Kenangan (disimpen di HP ini aja, nggak makan kuota server).
import { CONFIG } from './config.js';

const KEY = () => `lq-stats-${CONFIG.slug || (CONFIG.showcase ? `contoh-${CONFIG.showcase}` : 'demo')}`;
export function getStats() {
  try { return { duoGames: 0, duoWins: 0, talkCards: 0, soloWins: 0, types: [], ...(JSON.parse(localStorage.getItem(KEY())) || {}) }; }
  catch { return { duoGames: 0, duoWins: 0, talkCards: 0, soloWins: 0, types: [] }; }
}
function put(s) { try { localStorage.setItem(KEY(), JSON.stringify(s)); } catch {} }
// bump('talkCards'), bump('duoWins', 1), playedType('race')
export function bump(name, n = 1) { const s = getStats(); s[name] = (s[name] || 0) + n; if (!s.first) s.first = new Date().toISOString().slice(0, 10); put(s); }
export function playedType(type) { const s = getStats(); if (!s.types.includes(type)) s.types.push(type); if (!s.first) s.first = new Date().toISOString().slice(0, 10); put(s); }
export function setPet(info) { const s = getStats(); s.pet = info; put(s); }
