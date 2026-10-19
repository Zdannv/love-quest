// Toko peliharaan: koin 🪙 bareng (satu dompet berdua) dari ngerawat, dipakai beli aksesoris 3D & warna karpet.
// Bentuk 3D aksesorisnya ada di pet3d.js (ACC), di sini cuma daftar harga & tampilan tokonya.
import { esc } from './util.js';

export const SHOP = [
  { id: 'pita', em: '🎀', name: 'Pita', price: 30 },
  { id: 'topi', em: '🧢', name: 'Topi', price: 50 },
  { id: 'kacamata', em: '🕶️', name: 'Kacamata', price: 60 },
  { id: 'bunga', em: '🌸', name: 'Bando Bunga', price: 70 },
  { id: 'pesta', em: '🥳', name: 'Topi Pesta', price: 80 },
  { id: 'headset', em: '🎧', name: 'Headphone', price: 100 },
  { id: 'santa', em: '🎅', name: 'Topi Santa', price: 120 },
  { id: 'tinggi', em: '🎩', name: 'Topi Tinggi', price: 150 },
  { id: 'halo', em: '😇', name: 'Lingkaran Malaikat', price: 180 },
  { id: 'mahkota', em: '👑', name: 'Mahkota', price: 250, lvl: 5 },
];
export const RUGS = [
  { id: 'pink', hex: '#ffc7dc', name: 'Pink', price: 0 },
  { id: 'mint', hex: '#bdf0d6', name: 'Mint', price: 25 },
  { id: 'langit', hex: '#c4e4ff', name: 'Langit', price: 25 },
  { id: 'lemon', hex: '#fff0a8', name: 'Lemon', price: 25 },
  { id: 'lavender', hex: '#e2d2ff', name: 'Lavender', price: 35 },
  { id: 'peach', hex: '#ffd6bf', name: 'Peach', price: 35 },
];
// Dulu aksesoris kebuka per level (disimpen sebagai emoji). Yang udah kebuka tetap jadi milik mereka.
const LEGACY = { '🎀': 'pita', '🧢': 'topi', '🕶️': 'kacamata', '🎩': 'tinggi', '👑': 'mahkota' };
const LEGACY_LVL = { pita: 2, topi: 3, kacamata: 4, tinggi: 5, mahkota: 7 };

export function upgradeShop(s, lvl) {
  if (s.coins == null) { // pertama kali ada toko: modal awal + aksesoris lama tetap punya
    s.coins = 30 + lvl * 10;
    s.owned = Object.keys(LEGACY_LVL).filter((k) => LEGACY_LVL[k] <= lvl);
  }
  if (!Array.isArray(s.owned)) s.owned = [];
  if (!Array.isArray(s.rugs)) s.rugs = ['pink'];
  if (LEGACY[s.outfit]) s.outfit = LEGACY[s.outfit];
  if (s.outfit && !s.owned.includes(s.outfit)) s.outfit = null;
  if (!RUGS.some((r) => r.id === s.rug)) s.rug = 'pink';
  return s;
}
export const rugHex = (s) => (RUGS.find((r) => r.id === s.rug) || RUGS[0]).hex;

export function shopHTML(s, lvl, tab) {
  const item = (it, kind) => {
    const own = kind === 'acc' ? s.owned.includes(it.id) : s.rugs.includes(it.id) || !it.price;
    const on = kind === 'acc' ? s.outfit === it.id : s.rug === it.id;
    const lock = it.lvl && lvl < it.lvl && !own;
    const tag = on ? '<em class="on">Dipakai ✓</em>' : own ? '<em>Pakai</em>' : lock ? `<em>🔒 Lv ${it.lvl}</em>` : `<em class="${s.coins >= it.price ? 'buy' : 'poor'}">🪙 ${it.price}</em>`;
    const pic = kind === 'acc' ? `<span class="si-em">${it.em}</span>` : `<span class="si-rug" style="--rug:${it.hex}"></span>`;
    return `<button class="shop-item ${on ? 'on' : ''} ${own ? 'own' : ''} ${lock ? 'lock' : ''}" data-${kind === 'acc' ? 'shop' : 'rug'}="${it.id}">${pic}<b>${esc(it.name)}</b>${tag}</button>`;
  };
  return `
    <div class="pet-sec"><b>🛍️ Toko</b><small>beli pakai koin dari ngerawat, dompetnya berdua</small></div>
    <div class="pet-shop">
      <div class="shop-tabs"><button data-shoptab="acc" class="${tab === 'acc' ? 'on' : ''}">👗 Aksesoris</button><button data-shoptab="rug" class="${tab === 'rug' ? 'on' : ''}">🧶 Karpet</button></div>
      <div class="shop-grid">${tab === 'rug' ? RUGS.map((r) => item(r, 'rug')).join('') : SHOP.map((a) => item(a, 'acc')).join('')}</div>
      <small class="shop-earn">🪙 Dapet koin: makan +2 · mandi +6 · main +2–10 · elus +1 · kado harian · koin nyasar di kamar</small>
    </div>`;
}
