// Statistik corong penjualan: cuma "+1" per kejadian per hari (tanpa data pribadi, tanpa cookie).
// Kejadian "lihat" dihitung sekali per sesi browser biar nggak dobel pas halaman dimuat ulang.
import { CONFIG } from './config.js';

export function track(name, { once = false } = {}) {
  try {
    if (window.__lqTest || ['localhost', '127.0.0.1'].includes(location.hostname)) return; // tes lokal nggak ikut dihitung
    if (once) { const k = `lq-ev-${name}`; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); }
    const { url, anonKey } = CONFIG.cloud || {};
    if (!url) return;
    fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/track_event`, {
      method: 'POST', keepalive: true,
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_name: name }),
    }).catch(() => {});
  } catch {}
}
