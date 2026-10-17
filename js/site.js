// Pengaturan web dari halaman /owner (harga, isi paket, kontak, pengumuman, testimoni).
// Dimuat sekali di awal & disimpen di HP biar tetap jalan pas offline. Kalau gagal, pakai bawaan di config.js.
import { CONFIG } from './config.js';

const KEY = 'lq-site-settings';
const rupiah = (n) => `Rp${Number(n).toLocaleString('id-ID')}`;

export async function loadSite() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const { url, anonKey } = CONFIG.cloud || {};
  const fresh = url && fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_site_settings`, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: '{}' })
    .then((r) => (r.ok ? r.json() : null)).then((v) => { if (v && typeof v === 'object') { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} return v; } return null; }).catch(() => null);
  // tunggu maksimal 1,5 detik biar halaman nggak kelamaan kosong; sisanya pakai yang tersimpan
  const got = fresh ? await Promise.race([fresh, new Promise((r) => setTimeout(() => r(null), 1500))]) : null;
  applySite(got || s);
}

export function applySite(s) {
  if (!s) return;
  const pr = s.prices || {};
  if (Array.isArray(s.packages) && s.packages.length === 2) {
    s.packages.forEach((pk, i) => { CONFIG.packages[i] = { ...CONFIG.packages[i], ...pk }; });
  }
  if (pr.basic) CONFIG.packages[0].price = rupiah(pr.basic);
  if (pr.custom) CONFIG.packages[1].price = rupiah(pr.custom);
  CONFIG.prices = { basic: Number(pr.basic) || 29000, custom: Number(pr.custom) || 49000, upgrade: Number(pr.upgrade) || 20000 };
  const c = s.contact || {};
  if (c.whatsapp) {
    CONFIG.whatsapp = String(c.whatsapp).replace(/\D/g, '').replace(/^0/, '62');
    CONFIG.orderUrl = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent('Halo! Aku mau pesan Love Quest 💖')}`;
  }
  CONFIG.contact = c;
  const a = s.announcement || {};
  CONFIG.announcement = a.text && (!a.until || new Date(a.until) > new Date()) ? a : null;
  CONFIG.testimonials = Array.isArray(s.testimonials) ? s.testimonials.filter((t) => t && t.text) : [];
}
