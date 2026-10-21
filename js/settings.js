// Pengaturan (disimpen di HP ini): volume efek & musik, getar, kurangi gerakan, tulisan gede, kontras tinggi,
// tampilin lagi tutorial, ganti profil, reset progres.
import { setVolumes, sfx as playSfx } from './audio.js';

const KEY = 'lq-settings';
const reduceDefault = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEF = { sfxVol: 0.8, musicVol: 0.6, vibrate: true, reduceMotion: reduceDefault, bigText: false, contrast: false };
export function getSettings() { try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return { ...DEF }; } }
function put(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

export function applySettings(s = getSettings()) {
  const b = document.body.classList;
  b.toggle('reduce-motion', !!s.reduceMotion);
  b.toggle('big-text', !!s.bigText);
  b.toggle('hi-contrast', !!s.contrast);
  setVolumes({ sfx: s.sfxVol, music: s.musicVol, vibrate: s.vibrate });
}

// actions: { resetTutorial, switchProfile, resetProgress, toast, profileName }
export function openSettings(actions = {}) {
  const s = getSettings();
  const el = document.createElement('div');
  el.className = 'set-ov';
  const tog = (k, ic, t, sub) => `<label class="set-row"><span class="set-ic">${ic}</span><span class="set-t"><b>${t}</b><small>${sub}</small></span><input type="checkbox" class="set-sw" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
  const slide = (k, ic, t) => `<div class="set-row"><span class="set-ic">${ic}</span><span class="set-t"><b>${t}</b><input type="range" min="0" max="100" step="5" value="${Math.round(s[k] * 100)}" data-vol="${k}" aria-label="${t}"></span><em class="set-val" data-val="${k}">${Math.round(s[k] * 100)}%</em></div>`;
  el.innerHTML = `
    <div class="set-card" role="dialog" aria-label="Pengaturan">
      <div class="set-head"><b>⚙️ Pengaturan</b><button class="set-x" type="button" data-set-x aria-label="Tutup">✕</button></div>
      <p class="set-sec">Suara</p>
      ${slide('sfxVol', '🔊', 'Efek suara')}
      ${slide('musicVol', '🎵', 'Musik')}
      ${tog('vibrate', '📳', 'Getar', 'Pas kena, menang & kalah (HP Android)')}
      <p class="set-sec">Tampilan</p>
      ${tog('reduceMotion', '🐢', 'Kurangi gerakan', 'Animasi & efek dikurangin, nggak bikin pusing')}
      ${tog('bigText', '🔠', 'Tulisan lebih gede', 'Menu & tulisan jadi lebih gampang dibaca')}
      ${tog('contrast', '🌓', 'Kontras lebih tinggi', 'Tulisan abu-abu jadi lebih tegas')}
      <p class="set-sec">Lainnya</p>
      <button class="set-btn" type="button" data-set-act="tutorial"><span class="set-ic">❓</span><span class="set-t"><b>Tampilin lagi "Cara Main"</b><small>Kartu petunjuk muncul lagi di tiap game</small></span><span>›</span></button>
      ${actions.switchProfile ? `<button class="set-btn" type="button" data-set-act="profile"><span class="set-ic">👤</span><span class="set-t"><b>Ganti profil</b><small>${actions.profileName ? `Sekarang: ${actions.profileName}` : 'Belum masuk profil'}</small></span><span>›</span></button>` : ''}
      ${actions.resetProgress ? '<button class="set-btn danger" type="button" data-set-act="reset"><span class="set-ic">🗑️</span><span class="set-t"><b>Reset progres di HP ini</b><small>Bintang & level dari awal lagi</small></span><span>›</span></button>' : ''}
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 20); // bukan rAF: pas game dijeda, rAF ditahan
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-set-x]')) { close(); return; }
    const act = e.target.closest('[data-set-act]')?.dataset.setAct;
    if (act === 'tutorial') { actions.resetTutorial?.(); playSfx('good'); actions.toast?.('Kartu "Cara Main" bakal muncul lagi di tiap game 👍'); }
    if (act === 'profile') { close(); actions.switchProfile?.(); }
    if (act === 'reset') {
      const b = e.target.closest('[data-set-act]');
      if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.querySelector('b').textContent = 'Yakin? Tap sekali lagi buat reset'; playSfx('bad'); return; }
      close(); actions.resetProgress?.();
    }
  });
  el.addEventListener('change', (e) => {
    const k = e.target.dataset.set; if (!k) return;
    const cur = getSettings(); cur[k] = e.target.checked; put(cur); applySettings(cur);
    if (k === 'vibrate' && cur.vibrate) navigator.vibrate?.(40);
    playSfx('click');
  });
  let tick = 0;
  el.addEventListener('input', (e) => {
    const k = e.target.dataset.vol; if (!k) return;
    const v = Number(e.target.value) / 100, cur = getSettings(); cur[k] = v; put(cur); applySettings(cur);
    el.querySelector(`[data-val="${k}"]`).textContent = `${Math.round(v * 100)}%`;
    if (k === 'sfxVol' && performance.now() - tick > 120) { tick = performance.now(); playSfx('pop'); } // bunyi contoh
  });
}
