// Profil: HP ini punya siapa (pasangan / pengirim).
// Kalau pembeli ngisi tanggal lahir berdua di CMS, masuknya pakai tanggal lahir (yang disimpan cuma kode acaknya).
// Cukup sekali per HP, habis itu diingat. Dipakai Main Berdua & streak.
import { CONFIG } from './config.js';
import { getNames, getFace, getChars } from './personal.js';
import { setPlayer } from './streak.js';
import { esc } from './util.js';

const ROLES = ['pasangan', 'pengirim'];
const scope = () => CONFIG.slug || (CONFIG.showcase ? `contoh-${CONFIG.showcase}` : 'demo');
const KEY = () => `lq-me-${scope()}`;

export async function birthdayHash(slug, date) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${slug}|${date}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function whoAmI() {
  try {
    const r = localStorage.getItem(KEY());
    return ROLES.includes(r) ? r : null;
  } catch { return null; }
}
function remember(role) {
  try { localStorage.setItem(KEY(), role); } catch {}
  setPlayer(role); // streak ikut pakai profil ini
}
export function forget() {
  try { localStorage.removeItem(KEY()); } catch {}
}

// Contoh versi jadi: tanggal lahirnya ditulis sebagai petunjuk biar pengunjung bisa nyoba
async function profileHashes() {
  if (CONFIG.showcaseBirthdays) {
    const out = {};
    for (const r of ROLES) out[r] = await birthdayHash(scope(), CONFIG.showcaseBirthdays[r]);
    return out;
  }
  return CONFIG.profiles || {};
}

// Munculin layar "masuk ke profil". Selesai kalau udah ketahuan siapa.
export function askProfile({ sfx } = {}) {
  const known = whoAmI();
  if (known) return Promise.resolve(known);
  return profileHashes().then((hashes) => new Promise((resolve) => {
    const names = getNames();
    const chars = getChars();
    const useBirthday = ROLES.every((r) => hashes[r]);
    const el = document.createElement('div');
    el.className = 'profile-gate';
    const ava = (r) => {
      const f = getFace(r);
      return f ? `<img src="${esc(f)}" alt="">` : `<span>${chars[r]?.emoji || '💖'}</span>`;
    };
    const hint = CONFIG.showcaseBirthdays
      ? `<p class="pg-hint">Coba pakai tanggal lahir contoh: <b>${esc(names.pasangan)}</b> ${fmtDate(CONFIG.showcaseBirthdays.pasangan)} · <b>${esc(names.pengirim)}</b> ${fmtDate(CONFIG.showcaseBirthdays.pengirim)}</p>`
      : '';
    el.innerHTML = `
      <div class="pg-card">
        <div class="pg-avas">${ROLES.map((r) => `<span class="pg-ava">${ava(r)}</span>`).join('<span class="pg-heart">💞</span>')}</div>
        <h2>Masuk ke profilmu</h2>
        ${useBirthday ? `
          <p>Masukin tanggal lahirmu. Cukup sekali, habis itu HP ini inget kamu 😊</p>
          <form class="pg-form"><input type="date" required aria-label="Tanggal lahir"><button class="btn" type="submit">Masuk</button></form>
          <p class="pg-wrong" hidden>Hmm, tanggalnya nggak cocok 🤔 coba cek lagi</p>
          ${hint}` : `
          <p>Kamu yang mana? Cukup sekali, habis itu HP ini inget kamu 😊</p>
          <div class="pg-pick">${ROLES.map((r) => `<button class="btn ghost" type="button" data-pg="${r}">${esc(names[r] || r)}</button>`).join('')}</div>`}
        <button class="link-btn" type="button" data-pg-close>nanti aja</button>
      </div>`;
    document.body.appendChild(el);
    const done = (role) => {
      remember(role);
      sfx?.('win');
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
      resolve(role);
    };
    el.querySelector('[data-pg-close]').addEventListener('click', () => { el.remove(); resolve(null); });
    el.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => done(b.dataset.pg)));
    el.querySelector('.pg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = e.target.querySelector('input').value;
      const h = await birthdayHash(scope(), date);
      const role = ROLES.find((r) => hashes[r] === h);
      if (role) return done(role);
      sfx?.('bad');
      el.querySelector('.pg-wrong').hidden = false;
      const card = el.querySelector('.pg-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    });
  }));
}

function fmtDate(d) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
