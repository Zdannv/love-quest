// Titik awal: kalau ini game milik pasangan (/c/<kode> atau ?c=<kode>),
// ambil isinya dari CMS dulu. Kalau nggak ada kode, jalan sebagai demo.
import { CONFIG } from './config.js';

const CONTENT_KEYS = ['names', 'messages', 'stageMessages', 'bonusMessages', 'quiz', 'finalLetter', 'music', 'photos', 'theme', 'characters'];

function slugFromUrl() {
  const m = location.pathname.match(/^\/c\/([a-z0-9]{10,32})\/?$/);
  return m?.[1] || new URLSearchParams(location.search).get('c');
}

const CONTENT_CACHE = (slug) => `lq-content-${slug}`;

async function loadCouple(slug) {
  const { url, anonKey } = CONFIG.cloud;
  if (!url || !anonKey) throw new Error('CMS belum disetel');
  let res;
  try {
    res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_couple`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    });
  } catch {
    // Offline: pakai isi game yang terakhir tersimpan di HP
    const cached = localStorage.getItem(CONTENT_CACHE(slug));
    if (cached) return JSON.parse(cached);
    throw new Error('offline');
  }
  if (!res.ok) throw new Error(`CMS ${res.status}`);
  const result = await res.json();
  if (!result) throw new Error('Game nggak ditemukan');
  if (!('status' in result && 'content' in result)) {
    // format lama (sebelum migration-2.sql)
    try { localStorage.setItem(CONTENT_CACHE(slug), JSON.stringify(result)); } catch {}
    return result;
  }
  if (result.status !== 'ok') {
    try { localStorage.removeItem(CONTENT_CACHE(slug)); } catch {}
    throw new Error(result.status); // 'expired' | 'inactive'
  }
  try { localStorage.setItem(CONTENT_CACHE(slug), JSON.stringify(result.content)); } catch {}
  return result.content;
}

// Ikon aplikasi per pasangan: tab browser, ikon iPhone (Add to Home Screen) & manifest Android
function applyAppIcon(slug, icon) {
  const setLink = (rel, href) => {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
    el.href = href;
  };
  if (icon) {
    setLink('icon', icon);
    setLink('apple-touch-icon', icon);
  }
  // Manifest dinamis cuma ada di server (Vercel), bukan di server lokal
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) {
    setLink('manifest', `/c/${slug}/manifest.webmanifest`);
  }
}

function showError(text) {
  document.body.innerHTML = `
    <main style="min-height:100dvh;display:grid;place-items:center;padding:24px;text-align:center;font-family:Fredoka,sans-serif;color:#6a2c52">
      <div><div style="font-size:64px">🦉💧</div><h1 style="color:#e8558f">Yahh…</h1><p>${text}</p></div>
    </main>`;
}

const LAST_KEY = 'lq-last-couple';
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let slug = slugFromUrl();
// Dibuka dari ikon home screen tanpa kode → balik ke game pasangan terakhir
if (!slug && isStandalone) {
  try { slug = localStorage.getItem(LAST_KEY); } catch {}
}
let ok = true;
// Contoh versi jadi (halaman depan): /?lihat=<id>
const lihat = new URLSearchParams(location.search).get('lihat');
if (lihat) {
  const { applyShowcase } = await import('./showcase.js');
  if (applyShowcase(CONFIG, lihat)) slug = null;
}
if (slug) {
  try {
    const content = await loadCouple(slug);
    // Daftar pesan/kuis: yang belum diisi pembeli (misal level baru) pakai bawaan
    const LIST_KEYS = ['messages', 'stageMessages', 'bonusMessages', 'quiz'];
    const mergeList = (def, got) => def.map((d, i) => got?.[i] ?? d);
    for (const key of CONTENT_KEYS) {
      if (content[key] == null) continue;
      if (LIST_KEYS.includes(key)) CONFIG[key] = mergeList(CONFIG[key], content[key]);
      else if (key === 'photos') {
        CONFIG.photos = {
          ...CONFIG.photos, ...content.photos,
          bonus: mergeList(CONFIG.photos.bonus, content.photos.bonus),
          faces: { ...CONFIG.photos.faces, ...(content.photos.faces || {}) },
        };
      } else CONFIG[key] = content[key];
    }
    CONFIG.demo = false;
    CONFIG.slug = slug;
    applyAppIcon(slug, CONFIG.photos.icon);
    try { localStorage.setItem(LAST_KEY, slug); } catch {}
  } catch (err) {
    ok = false;
    const messages = {
      'Game nggak ditemukan': 'Game ini nggak ketemu. Coba cek lagi link-nya yaa 🥺',
      expired: 'Game ini lagi istirahat karena langganannya belum diperpanjang. Kabarin yang ngasih game ini yaa 💌',
      inactive: 'Game ini lagi nggak aktif. Kabarin yang ngasih game ini yaa 💌',
      offline: 'Lagi offline nih. Buka game ini sekali pas ada internet dulu, habis itu bisa dimainin offline 📶',
    };
    showError(messages[err.message] || 'Game-nya lagi nggak bisa dimuat. Cek internet terus coba lagi yaa 🥺');
  }
}
if (ok) await import('./main.js');
