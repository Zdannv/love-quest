// Sambutan pertama kali buka link game (versi pasangan): kartu kado yang dibuka, lalu 3 slide singkat isi game-nya.
// Muncul sekali per HP per game (disimpan di localStorage), bisa dilewati kapan aja.
import { CONFIG } from './config.js';
import { getNames, getChars, getFace } from './personal.js';
import { esc } from './util.js';

const KEY = () => `lq-welcome-${CONFIG.slug || CONFIG.showcase}`;

export function maybeWelcome({ sfx } = {}) {
  if (CONFIG.demo || window.__lqTest) return;
  if (!CONFIG.slug && !CONFIG.showcase) return;
  try { if (localStorage.getItem(KEY())) return; } catch { return; }
  const n = getNames(), c = getChars();
  const fa = getFace('pasangan'), fb = getFace('pengirim');
  const face = (src, emoji) => (src ? `<img src="${esc(src)}" alt="">` : `<span>${emoji}</span>`);
  const fromName = n.raw?.pengirim ? esc(n.pengirim) : 'Seseorang yang sayang kamu';
  const SLIDES = [
    { ic: '🗺️', t: 'Petualangan 60 level', d: `Tiap level game-nya beda, dan tiap selesai ada pesan dari ${fromName} 💌. Tamatin semuanya buat buka surat rahasia di akhir.` },
    { ic: '💞', t: 'Main berdua', d: 'Duel, masak bareng, sampai kerja sama dari HP masing-masing. Ada juga kartu Deep Talk & peliharaan yang dirawat berdua.' },
    { ic: '🔥', t: 'Main tiap hari', d: 'Jaga streak berdua biar apinya nggak padam. Pasang game ini di home screen biar gampang dibuka.' },
  ];
  const el = document.createElement('div');
  el.className = 'welcome';
  el.innerHTML = `
    <div class="wl-card">
      <button class="wl-skip" type="button" data-wl="skip">Lewati</button>
      <div class="wl-page wl-gift on">
        <div class="wl-faces">${face(fa, c.pasangan.emoji)}<b>💖</b>${face(fb, c.pengirim.emoji)}</div>
        <small class="wl-kicker">Ada kado buat kamu</small>
        <h2>Hai ${esc(n.pasangan)}! 🎁</h2>
        <p><b>${fromName}</b> bikinin game ini khusus buat kamu. Isinya cerita kalian berdua.</p>
        <button class="wl-box" type="button" data-wl="open" aria-label="Buka kado"><span class="wl-lid">🎀</span><span class="wl-gbox">🎁</span></button>
        <small class="wl-tap">Tap kadonya buat buka</small>
      </div>
      ${SLIDES.map((s, i) => `
      <div class="wl-page" data-i="${i}">
        <div class="wl-ic">${s.ic}</div>
        <h2>${s.t}</h2>
        <p>${s.d}</p>
      </div>`).join('')}
      <div class="wl-foot" hidden>
        <div class="wl-dots">${SLIDES.map((_, i) => `<i data-d="${i}"></i>`).join('')}</div>
        <button class="btn" type="button" data-wl="next">Lanjut ▶</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  let step = -1;
  const pages = [...el.querySelectorAll('.wl-page')];
  const foot = el.querySelector('.wl-foot'), next = el.querySelector('[data-wl="next"]');
  function go(i) {
    step = i;
    pages.forEach((p, k) => p.classList.toggle('on', k === i + 1));
    foot.hidden = i < 0;
    el.querySelectorAll('.wl-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    next.textContent = i === SLIDES.length - 1 ? 'Mulai main 💖' : 'Lanjut ▶';
  }
  function close() {
    try { localStorage.setItem(KEY(), '1'); } catch {}
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-wl]')?.dataset.wl;
    if (!a) return;
    if (a === 'skip') { sfx?.('click'); close(); return; }
    if (a === 'open') {
      sfx?.('gold');
      el.querySelector('.wl-gift').classList.add('opened');
      for (let i = 0; i < 26; i++) { // konfeti kecil dari kado
        const s = document.createElement('i');
        s.className = 'wl-conf';
        s.style.setProperty('--x', `${(Math.random() - 0.5) * 320}px`);
        s.style.setProperty('--y', `${-120 - Math.random() * 220}px`);
        s.style.setProperty('--r', `${Math.random() * 720}deg`);
        s.style.background = ['#ff8fb7', '#ffd166', '#8fd3ff', '#b9f0d2', '#c9a6ff'][i % 5];
        el.querySelector('.wl-box').appendChild(s);
      }
      setTimeout(() => go(0), 1100);
      return;
    }
    if (a === 'next') { sfx?.('click'); if (step >= SLIDES.length - 1) close(); else go(step + 1); }
  });
}
