// CMS Love Quest: pembeli login, lalu mengedit isi game miliknya (tabel `couples`).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';
import { LEVEL_MAP, TYPE_NAME, levelList } from './level-map.js';
import { TRACKS, createPlayer } from './music.js';
import { THEMES, CHARACTERS, DEFAULT_THEME, DEFAULT_CHARACTERS } from './themes.js';
import { esc } from './util.js';

const $ = (s) => document.querySelector(s);
const views = { login: $('#view-login'), create: $('#view-create'), editor: $('#view-editor') };
const status = $('#status');

function show(name) {
  Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
  $('#btn-logout').hidden = name === 'login';
  $('#save-bar').hidden = name !== 'editor';
}
function setStatus(text) {
  status.hidden = !text;
  status.textContent = text || '';
}
let toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ?contoh = lihat editor tanpa login (nggak ada yang disimpan)
const PREVIEW = new URLSearchParams(location.search).has('contoh');
const { url, anonKey } = CONFIG.cloud;
if (!PREVIEW && (!url || !anonKey)) {
  setStatus('CMS belum disambungkan: isi `cloud.url` dan `cloud.anonKey` di js/config.js dulu.');
  throw new Error('cloud config kosong');
}
const sb = PREVIEW ? null : createClient(url, anonKey);

// ---------- Data ----------
let couple = null;   // baris dari tabel couples
let content = null;  // salinan content yang sedang diedit
let dirty = false;

function defaultContent() {
  const copy = (v) => JSON.parse(JSON.stringify(v));
  return {
    names: { pasangan: '', pengirim: '' },
    messages: copy(CONFIG.messages),
    stageMessages: copy(CONFIG.stageMessages),
    bonusMessages: copy(CONFIG.bonusMessages),
    quiz: copy(CONFIG.quiz),
    finalLetter: CONFIG.finalLetter,
    music: 'ceria',
    theme: DEFAULT_THEME,
    characters: { ...DEFAULT_CHARACTERS },
    photos: { icon: null, letter: null, bonus: LEVEL_MAP.map(() => null), faces: { pasangan: null, pengirim: null } },
  };
}

// Isi yang belum ada (misal game dibuat sebelum ada fitur baru) pakai bawaan
function withDefaults(c) {
  const d = defaultContent();
  const out = { ...d, ...c };
  out.names = { ...d.names, ...(c.names || {}) };
  out.characters = { ...d.characters, ...(c.characters || {}) };
  // Daftar pesan/kuis/foto yang lebih pendek (game lama sebelum ada dunia baru) diisi pakai bawaan
  const fill = (def, got) => def.map((x, i) => got?.[i] ?? x);
  for (const key of ['messages', 'stageMessages', 'bonusMessages', 'quiz']) out[key] = fill(d[key], c[key]);
  out.photos = {
    ...d.photos, ...(c.photos || {}),
    bonus: fill(d.photos.bonus, c.photos?.bonus),
    faces: { ...d.photos.faces, ...(c.photos?.faces || {}) },
  };
  return out;
}

function randomSlug() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

let autoSaveTimer = 0;
function markDirty(on = true) {
  dirty = on;
  $('#save-bar').classList.toggle('dirty', on);
  $('#save-state').textContent = on ? 'Menyimpan sebentar lagi…' : 'Semua tersimpan ✓';
  clearTimeout(autoSaveTimer);
  // Simpan otomatis 1 detik setelah berhenti ngedit, biar nggak ada yang hilang
  if (on) autoSaveTimer = setTimeout(() => save(null), 1000);
}
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// ---------- Paket & masa aktif ----------
const fmtDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const todayWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

function renderSubscription() {
  const panel = $('#sub-panel');
  const planName = couple.plan === 'custom' ? 'Love Quest Premium' : 'Love Quest';
  if (!couple.paid_until) {
    // Sekali bayar, akses selamanya
    const up = `Halo! Aku mau upgrade ke Love Quest Premium 💖\nKode game: ${couple.slug}\nEmail: ${couple.owner_email || '-'}`;
    const wa = CONFIG.whatsapp && couple.plan !== 'custom' ? `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(up)}` : '';
    panel.className = 'panel sub-panel';
    panel.innerHTML = `
      <div><div class="muted small">${esc(planName)}</div><b>✅ Aktif selamanya 💖</b></div>
      ${wa ? `<a class="btn small-btn" href="${esc(wa)}" target="_blank" rel="noopener">✨ Upgrade ke Premium</a>` : ''}`;
    panel.hidden = !couple.active;
    return;
  }
  const daysLeft = Math.round((new Date(`${couple.paid_until}T00:00:00Z`) - new Date(`${todayWib()}T00:00:00Z`)) / 864e5);
  const expired = !couple.active || daysLeft < 0;
  const trial = couple.plan === 'basic' && !couple.note && daysLeft <= 3 && Date.now() - new Date(couple.created_at) < 4 * 864e5;
  const text = `Halo! Aku mau ${expired || trial ? 'bayar' : 'perpanjang'} Love Quest 💖\nKode game: ${couple.slug}\nEmail: ${couple.owner_email || '-'}`;
  const wa = CONFIG.whatsapp ? `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}` : '';
  panel.className = `panel sub-panel ${expired ? 'expired' : daysLeft <= 3 ? 'soon' : ''}`;
  panel.innerHTML = `
    <div>
      <div class="muted small">${esc(planName)}${trial ? ' · masa coba' : ''}</div>
      <b>${expired
        ? '⛔ Masa aktif habis, game-nya nggak bisa dibuka pasanganmu'
        : `✅ Aktif sampai ${fmtDate(couple.paid_until)}${daysLeft <= 3 ? ` (${daysLeft === 0 ? 'hari ini terakhir' : `${daysLeft} hari lagi`})` : ''}`}</b>
    </div>
    ${wa ? `<a class="btn small-btn" href="${esc(wa)}" target="_blank" rel="noopener">${expired || trial ? '💳 Bayar via WhatsApp' : '🔁 Perpanjang'}</a>` : ''}`;
  panel.hidden = false;
}

// ---------- Render editor ----------
function renderEditor() {
  renderSubscription();
  // Server lokal nggak kenal /c/<kode> (itu diatur vercel.json), jadi pakai ?c= kalau lagi tes lokal
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const link = local ? `${location.origin}/?c=${couple.slug}` : `${location.origin}/c/${couple.slug}`;
  $('#game-link').textContent = link;
  $('#game-link').href = link;
  $('#btn-open').href = link;

  // Semua input berlabel data-path langsung terhubung ke `content`
  document.querySelectorAll('#view-editor [data-path]').forEach((el) => { el.value = getPath(content, el.dataset.path) ?? ''; });

  renderMusic();
  renderLook();
  renderPhotos();
  renderMessages();
  renderQuiz();
}

function renderMessages() {
  const items = levelList();
  $('#message-list').innerHTML = LEVEL_MAP.map((w, wi) => `
    <div class="world-block">
      <h3>${w.icon} Dunia ${wi + 1}: ${esc(w.name)}</h3>
      ${items.filter((it) => it.world === wi).map((it) => `
        <label class="msg-item">${it.bonus ? '⭐ Bonus · Puzzle Foto' : `Level ${it.num} · ${TYPE_NAME[it.type]}`}
          <textarea rows="2" data-path="${it.field}.${it.index}">${esc(content[it.field][it.index] ?? '')}</textarea>
        </label>`).join('')}
    </div>`).join('');
}

function renderQuiz() {
  $('#quiz-list').innerHTML = content.quiz.map((qs, wi) => `
    <div class="world-block">
      <h3>${LEVEL_MAP[wi].icon} Kuis Dunia ${wi + 1}</h3>
      ${qs.map((q, qi) => `
        <div class="quiz-item">
          <label>Pertanyaan ${qi + 1}<input data-path="quiz.${wi}.${qi}.q" value="${esc(q.q)}"></label>
          <div class="opts">
            ${q.options.map((o, oi) => `<label>Pilihan ${'ABCD'[oi]}<input data-path="quiz.${wi}.${qi}.options.${oi}" value="${esc(o)}"></label>`).join('')}
          </div>
          <label>Jawaban benar
            <select data-path="quiz.${wi}.${qi}.answer" data-number>
              <option value="-1" ${q.answer === -1 ? 'selected' : ''}>Semua benar 😆</option>
              ${[0, 1, 2, 3].map((i) => `<option value="${i}" ${q.answer === i ? 'selected' : ''}>${'ABCD'[i]}</option>`).join('')}
            </select>
          </label>
          <label>Balasan kalau benar<input data-path="quiz.${wi}.${qi}.yes" value="${esc(q.yes || '')}" placeholder="Benar! 💖"></label>
        </div>`).join('')}
    </div>`).join('');
}

// ---------- Lagu ----------
let previewCtx = null;
const preview = createPlayer(
  () => (previewCtx ||= new (window.AudioContext || window.webkitAudioContext)()),
  () => previewCtx.destination,
);
let previewing = null;

function renderMusic() {
  const opts = [...Object.entries(TRACKS).map(([id, t]) => [id, t.name]), ['off', 'Tanpa lagu 🔇']];
  $('#music-list').innerHTML = (isCustom() ? '' : upsellNote('Pilihan lagu')) + opts.map(([id, name]) => `
    <label class="music-opt ${isCustom() ? '' : 'locked'}">
      <input type="radio" name="music" value="${id}" ${content.music === id ? 'checked' : ''} ${isCustom() ? '' : 'disabled'}>
      <span>${esc(name)}</span>
      ${id === 'off' ? '' : `<button class="btn ghost small-btn" type="button" data-preview="${id}">${previewing === id ? '⏹ Stop' : '▶ Dengerin'}</button>`}
    </label>`).join('');
}

$('#music-list').addEventListener('change', (e) => {
  if (e.target.name !== 'music') return;
  content.music = e.target.value;
  markDirty();
});
$('#music-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preview]');
  if (!b) return;
  e.preventDefault();
  if (previewing === b.dataset.preview) { preview.stop(); previewing = null; }
  else { preview.play(b.dataset.preview); previewing = b.dataset.preview; }
  renderMusic();
});

// ---------- Fitur paket Premium (tema, karakter, muka, lagu) ----------
const isCustom = () => couple.plan === 'custom';
function upsellNote(what) {
  const url = CONFIG.whatsapp
    ? `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(`Halo! Aku mau upgrade ke Love Quest Premium 💖\nKode game: ${couple.slug}`)}`
    : '';
  return `<div class="locked-note">🔒 ${what} tersedia di paket <b>Love Quest Premium</b>.
    ${url ? `<a class="btn small-btn" href="${esc(url)}" target="_blank" rel="noopener">Upgrade via WhatsApp</a>` : ''}</div>`;
}

function renderLook() {
  const isCustom = couple.plan === 'custom';
  const opts = (sel) => Object.entries(CHARACTERS).map(([id, ch]) =>
    `<option value="${id}" ${sel === id ? 'selected' : ''}>${ch.emoji} ${esc(ch.name)}</option>`).join('');
  const upsell = CONFIG.whatsapp
    ? `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(`Halo! Aku mau upgrade ke Love Quest Premium 💖\nKode game: ${couple.slug}`)}`
    : '';
  $('#look-editor').innerHTML = `
    ${isCustom ? '' : `
      <div class="locked-note">
        🔒 Tema & karakter tersedia di paket <b>Love Quest Premium</b>.
        ${upsell ? `<a class="btn small-btn" href="${esc(upsell)}" target="_blank" rel="noopener">Upgrade via WhatsApp</a>` : ''}
      </div>`}
    <fieldset class="look-fields" ${isCustom ? '' : 'disabled'}>
      <div class="muted small">Tema warna</div>
      <div class="theme-chips">
        ${Object.entries(THEMES).map(([id, t]) => `
          <button type="button" class="theme-chip ${content.theme === id ? 'on' : ''}" data-theme-id="${id}" style="--c:${t.swatch}" title="${esc(t.name)}"></button>`).join('')}
        <span class="small muted">${esc(THEMES[content.theme]?.name || '')}</span>
      </div>
      <div class="grid2">
        <label>Karakter pasangan (pemandu & yang terbang)<select data-char="pasangan">${opts(content.characters.pasangan)}</select></label>
        <label>Karakter kamu (yang bawa keranjang)<select data-char="pengirim">${opts(content.characters.pengirim)}</select></label>
      </div>
    </fieldset>`;
}
$('#look-editor').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-id]');
  if (!b || b.closest('fieldset')?.disabled) return;
  content.theme = b.dataset.themeId;
  renderLook();
  markDirty();
});
$('#look-editor').addEventListener('change', (e) => {
  const sel = e.target.closest('[data-char]');
  if (!sel) return;
  content.characters[sel.dataset.char] = sel.value;
  markDirty();
});

// ---------- Foto ----------
const PHOTO_SLOTS = [
  { key: 'icon', label: '📱 Logo aplikasi (ikon di home screen & tab browser)', icon: true, premium: true },
  { key: 'faces.pasangan', label: '😊 Muka pasangan (yang terbang & jalan di labirin)', face: true, premium: true },
  { key: 'faces.pengirim', label: '😆 Muka kamu (yang lari & jadi target lempar hati)', face: true, premium: true },
  { key: 'letter', label: 'Foto utama (surat)' },
  ...LEVEL_MAP.map((w, i) => ({ key: `bonus.${i}`, label: `Puzzle Dunia ${i + 1} ${w.icon}` })),
];

function renderPhotos() {
  const locked = !isCustom();
  $('#photo-list').innerHTML = (locked ? upsellNote('Logo aplikasi & muka kalian jadi karakter game') : '') + PHOTO_SLOTS.map((s) => {
    const src = getPath(content.photos, s.key);
    const shape = s.icon ? 'app-icon' : s.face ? 'round' : ''; // jangan pakai class 'face' (bentrok sama kartu memory di style.css)
    if (s.premium && locked) {
      return `
      <div class="photo-slot locked">
        <b>${esc(s.label)}</b>
        <div class="thumb ${shape}">🔒</div>
        <small class="muted">Paket Premium</small>
      </div>`;
    }
    return `
      <div class="photo-slot">
        <b>${esc(s.label)}</b>
        <div class="thumb ${shape}" style="${src ? `background-image:url('${esc(src)}')` : ''}">${src ? '' : s.icon ? '💖' : s.face ? '😊' : '📷'}</div>
        ${s.icon ? '<small class="muted">Foto dipotong bulat + bingkai warna tema. Yang udah pasang di HP mungkin perlu pasang ulang biar ikonnya ganti.</small>' : ''}
        <div class="row">
          <label class="btn ghost small-btn file-btn">${src ? 'Ganti' : 'Upload'}<input type="file" accept="image/*" data-photo="${s.key}"></label>
          ${src ? `<button class="link-btn" type="button" data-photo-del="${s.key}">hapus</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

function resizeImage(file, max = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('gagal'))), 'image/jpeg', 0.8);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Logo aplikasi: foto dipotong bulat di tengah, latar warna tema, ada 💖 kecil.
// Semua isi ada di dalam "zona aman" ikon Android (lingkaran 80%), jadi nggak kepotong.
function makeIcon(file, size = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const t = (THEMES[content.theme] || THEMES[DEFAULT_THEME]).vars;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const bg = g.createLinearGradient(0, 0, size, size);
      bg.addColorStop(0, t['--pink-soft']);
      bg.addColorStop(1, t['--pink']);
      g.fillStyle = bg;
      g.fillRect(0, 0, size, size);
      const mid = size / 2;
      const r = size * 0.36;
      g.beginPath(); g.arc(mid, mid, r + size * 0.025, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      g.save();
      g.beginPath(); g.arc(mid, mid, r, 0, Math.PI * 2); g.clip();
      const side = Math.min(img.width, img.height); // potong kotak di tengah
      g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, mid - r, mid - r, r * 2, r * 2);
      g.restore();
      g.font = `${Math.round(size * 0.17)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('💖', size * 0.69, size * 0.7);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('gagal'))), 'image/jpeg', 0.9);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function storagePath(publicUrl) {
  const marker = '/object/public/photos/';
  const i = publicUrl?.indexOf(marker) ?? -1;
  return i >= 0 ? decodeURIComponent(publicUrl.slice(i + marker.length)) : null;
}

$('#photo-list').addEventListener('change', async (e) => {
  const input = e.target.closest('[data-photo]');
  const file = input?.files?.[0];
  if (!file) return;
  if (PREVIEW) { toast('Mode contoh: upload foto butuh login'); input.value = ''; return; }
  const key = input.dataset.photo;
  const slot = PHOTO_SLOTS.find((x) => x.key === key);
  if (slot?.premium && !isCustom()) { input.value = ''; return; }
  toast('📤 Lagi upload foto…');
  try {
    const blob = slot?.icon ? await makeIcon(file) : await resizeImage(file, slot?.face ? 500 : 800);
    const path = `${couple.owner}/${Date.now()}-${randomSlug()}.jpg`;
    const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    const old = storagePath(getPath(content.photos, key));
    setPath(content.photos, key, sb.storage.from('photos').getPublicUrl(path).data.publicUrl);
    if (old) sb.storage.from('photos').remove([old]);
    renderPhotos();
    await save('📸 Foto tersimpan!');
  } catch (err) {
    console.error(err);
    toast('Yahh upload gagal, coba lagi 🥺');
  }
});

$('#photo-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-photo-del]');
  if (!b) return;
  const key = b.dataset.photoDel;
  const old = storagePath(getPath(content.photos, key));
  setPath(content.photos, key, null);
  if (old) sb.storage.from('photos').remove([old]);
  renderPhotos();
  await save('Foto dihapus');
});

// ---------- Edit teks ----------
$('#view-editor').addEventListener('input', (e) => {
  const el = e.target.closest('[data-path]');
  if (!el) return;
  setPath(content, el.dataset.path, el.hasAttribute('data-number') ? Number(el.value) : el.value);
  markDirty();
});
$('#view-editor').addEventListener('change', (e) => {
  const el = e.target.closest('select[data-path]');
  if (!el) return;
  setPath(content, el.dataset.path, Number(el.value));
  markDirty();
});

let saving = null;
async function save(message = 'Tersimpan 💖') {
  if (PREVIEW) { if (message) toast('Mode contoh: perubahan nggak disimpan'); return false; }
  clearTimeout(autoSaveTimer);
  if (saving) await saving; // tunggu simpanan sebelumnya selesai
  saving = doSave(message);
  const ok = await saving;
  saving = null;
  return ok;
}
async function doSave(message) {
  const pill = $('#save-bar');
  $('#save-state').textContent = 'Menyimpan…';
  pill.classList.remove('failed');
  const { error } = await sb.from('couples').update({ content }).eq('id', couple.id);
  if (error) {
    console.error(error);
    pill.classList.add('failed');
    $('#save-state').textContent = 'Gagal nyimpen, tap buat coba lagi';
    toast('Gagal nyimpen, cek internet terus coba lagi 🥺');
    return false;
  }
  dirty = false;
  $('#save-bar').classList.remove('dirty');
  $('#save-state').textContent = 'Semua tersimpan ✓';
  if (message) toast(message);
  return true;
}
$('#save-bar').addEventListener('click', () => { if ($('#save-bar').classList.contains('failed')) save(); });

// Buka game: simpan dulu kalau masih ada perubahan
$('#btn-open').addEventListener('click', async (e) => {
  if (!dirty) return;
  e.preventDefault();
  const tab = window.open('', '_blank');
  const ok = await save(null);
  if (tab) tab.location.href = $('#btn-open').href;
  else if (ok) location.href = $('#btn-open').href;
});

$('#btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#game-link').textContent);
    toast('Link disalin! Kirim ke pasanganmu 💌');
  } catch {
    toast('Nggak bisa nyalin otomatis, salin manual yaa');
  }
});

// ---------- Akun ----------
const waLink = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
$('#login-help').innerHTML = `Belum punya akun atau lupa password? <a href="${waLink('Halo! Aku mau pesan Love Quest 💖')}" target="_blank" rel="noopener">Chat WhatsApp</a>`;
$('#btn-create').href = waLink('Halo! Aku udah punya akun Love Quest tapi game-nya belum ada 🥺');

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('');
  const { error } = await sb.auth.signInWithPassword({ email: $('#in-email').value.trim(), password: $('#in-pass').value });
  if (error) {
    setStatus(error.message.includes('Invalid login') ? 'Email atau password salah.' : `Gagal: ${error.message}`);
    return;
  }
  await loadMine();
});

$('#btn-logout').addEventListener('click', async () => {
  if (dirty && !confirm('Ada perubahan belum disimpan. Tetap keluar?')) return;
  await sb.auth.signOut();
  couple = content = null;
  markDirty(false);
  show('login');
});

async function loadMine() {
  setStatus('');
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { show('login'); return; }
  const { data, error } = await sb.from('couples').select('*').eq('owner', session.user.id).maybeSingle();
  if (error) { setStatus(`Gagal memuat: ${error.message}`); return; }
  if (!data) { show('create'); return; }
  couple = data;
  content = withDefaults(data.content || {});
  show('editor');
  renderEditor();
  markDirty(false);
}

if (PREVIEW) {
  couple = { id: 'contoh', slug: 'contohkode123', owner: 'contoh' };
  content = defaultContent();
  show('editor');
  renderEditor();
  setStatus('👀 Mode contoh: kamu bisa lihat & coba editornya, tapi nggak ada yang disimpan.');
  $('#btn-logout').hidden = true;
} else {
  loadMine();
  // Balik ke halaman ini (misal tombol Back setelah buka game): muat ulang biar nggak pakai tampilan lama
  window.addEventListener('pageshow', (e) => { if (e.persisted && !dirty) loadMine(); });
}

// Tombol mata: lihat / sembunyikan password
document.querySelectorAll('.pass-eye').forEach((b) => b.addEventListener('click', () => {
  const input = b.previousElementSibling;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  b.textContent = show ? '🙈' : '👁️';
  b.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Lihat password');
}));
