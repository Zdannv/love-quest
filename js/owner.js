// Halaman owner: lihat semua pembeli & atur paket / masa aktif (manual, setelah pembayaran masuk).
// Semua aksi lewat fungsi database yang cuma bisa dipanggil admin (lihat migration-2.sql).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';
import { esc } from './util.js';

const $ = (s) => document.querySelector(s);
const status = $('#status');
const setStatus = (t) => { status.hidden = !t; status.textContent = t || ''; };
let toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

const { url, anonKey, ownerFunction = 'owner-accounts' } = CONFIG.cloud;
// Login owner disimpan terpisah dari login CMS, biar nggak saling nimpa kalau tes akun pembeli di browser yang sama
const sb = createClient(url, anonKey, { auth: { storageKey: 'lq-owner-auth' } });

const todayWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5);
const fmtDate = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-');

let couples = [];

function stateOf(c) {
  if (!c.active) return 'expired';
  if (!c.paid_until) return 'active';
  const left = daysBetween(todayWib(), c.paid_until);
  if (left < 0) return 'expired';
  return left <= 3 ? 'soon' : 'active';
}
const STATE_LABEL = { active: '✅ Aktif', soon: '⏳ Segera habis', expired: '⛔ Berhenti' };

function gameLink(slug) {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  return local ? `${location.origin}/?c=${slug}` : `${location.origin}/c/${slug}`;
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const f = $('#filter').value;
  const counts = { active: 0, soon: 0, expired: 0 };
  couples.forEach((c) => counts[stateOf(c)]++);
  const PRICE = { basic: 49000, custom: 79000 };
  const forever = couples.filter((c) => !c.paid_until && c.active).length;
  const income = couples.reduce((a, c) => a + (PRICE[c.plan] || 0), 0);
  $('#summary').innerHTML = `
    <div><b>${couples.length}</b><small>total game</small></div>
    <div><b>${counts.active}</b><small>aktif</small></div>
    <div><b>${counts.soon}</b><small>habis ≤ 3 hari</small></div>
    <div><b>${counts.expired}</b><small>berhenti</small></div>
    <div><b>${forever}</b><small>aktif selamanya</small></div>
    <div><b>Rp${income.toLocaleString('id-ID')}</b><small>perkiraan total penjualan*</small></div>`;

  const list = couples.filter((c) => {
    const hay = `${c.owner_email} ${c.slug} ${c.names?.pasangan ?? ''} ${c.names?.pengirim ?? ''} ${c.note ?? ''}`.toLowerCase();
    return (!q || hay.includes(q)) && (f === 'all' || stateOf(c) === f);
  });

  $('#couple-list').innerHTML = list.length ? list.map((c) => {
    const st = stateOf(c);
    const names = [c.names?.pengirim, c.names?.pasangan].filter(Boolean).join(' → ') || '(nama belum diisi)';
    return `
      <article class="panel couple-card ${st}" data-id="${c.id}">
        <header>
          <div>
            <b>${esc(names)}</b>
            <div class="muted small">${esc(c.owner_email || '-')} · <a href="${esc(gameLink(c.slug))}" target="_blank" rel="noopener">${esc(c.slug)}</a></div>
          </div>
          <span class="state-chip">${STATE_LABEL[st]}</span>
        </header>
        <div class="grid2">
          <label>Paket
            <select data-f="plan">
              <option value="basic" ${c.plan === 'basic' ? 'selected' : ''}>Love Quest (Rp49rb)</option>
              <option value="custom" ${c.plan === 'custom' ? 'selected' : ''}>Love Quest Premium</option>
            </select>
          </label>
          <label>Aktif sampai (${c.paid_until ? fmtDate(c.paid_until) : '♾️ selamanya'})<input type="date" data-f="paid_until" value="${c.paid_until || ''}"></label>
        </div>
        <label>Catatan (misal: bayar 24 Sep via QRIS)<input data-f="note" value="${esc(c.note || '')}"></label>
        <div class="row">
          <button class="btn ghost small-btn" data-forever>♾️ Selamanya</button>
          <button class="btn ghost small-btn" data-add="30">+30 hari</button>
          <button class="btn ghost small-btn" data-add="365">+1 tahun</button>
          <button class="btn ghost small-btn" data-toggle>${c.active ? 'Nonaktifkan' : 'Aktifkan lagi'}</button>
          <button class="btn small-btn" data-save>Simpan</button>
        </div>
        <div class="row">
          <button class="link-btn" data-pass>🔑 Ganti password</button>
          <button class="link-btn danger" data-delete>🗑️ Hapus akun</button>
        </div>
        <div class="muted small">Dibuat ${fmtDate(c.created_at?.slice(0, 10))} · terakhir diedit ${fmtDate(c.updated_at?.slice(0, 10))}</div>
      </article>`;
  }).join('') : '<p class="muted">Belum ada game yang cocok.</p>';
}

async function update(c, patch) {
  const next = { ...c, ...patch };
  const { error } = await sb.rpc('admin_update_couple', {
    p_id: c.id, p_plan: next.plan, p_paid_until: next.paid_until || null, p_active: next.active, p_note: next.note || null,
  });
  if (error) { toast(`Gagal: ${error.message}`); return; }
  Object.assign(c, next);
  render();
  toast('Tersimpan ✓');
}

$('#couple-list').addEventListener('click', (e) => {
  const card = e.target.closest('.couple-card');
  if (!card) return;
  const c = couples.find((x) => x.id === card.dataset.id);
  const field = (f) => card.querySelector(`[data-f="${f}"]`).value;
  const add = e.target.closest('[data-add]');
  if (add) {
    // Perpanjang dari tanggal habis (atau dari hari ini kalau sudah lewat)
    const base = c.paid_until && c.paid_until >= todayWib() ? c.paid_until : todayWib();
    update(c, { plan: field('plan'), note: field('note'), paid_until: addDays(base, Number(add.dataset.add)), active: true });
  } else if (e.target.closest('[data-forever]')) {
    update(c, { plan: field('plan'), note: field('note'), paid_until: null, active: true });
  } else if (e.target.closest('[data-toggle]')) {
    update(c, { active: !c.active });
  } else if (e.target.closest('[data-save]')) {
    update(c, { plan: field('plan'), note: field('note'), paid_until: field('paid_until') || null });
  } else if (e.target.closest('[data-pass]')) {
    changePassword(c);
  } else if (e.target.closest('[data-delete]')) {
    removeAccount(c);
  }
});

// ---------- Kelola akun pembeli (lewat edge function, butuh kunci rahasia di server) ----------
async function callOwner(body) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.reload(); throw new Error('Sesi login habis, masuk lagi yaa'); }
  let res;
  try {
    res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/${ownerFunction}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Nggak nyambung ke server. Cek internet, atau edge function owner-accounts belum di-deploy.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 404 && !data.error) throw new Error(`Edge function "${ownerFunction}" belum di-deploy di Supabase.`);
  if (!res.ok || data.error) throw new Error(data.error || data.message || `Error ${res.status}`);
  return data;
}

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const cmsUrl = () => `${location.origin}/admin${['localhost', '127.0.0.1'].includes(location.hostname) ? '.html' : ''}`;

function loginMessage({ email, password, slug, paid_until }) {
  return `Halo! Makasih udah pesan Love Quest 💖

Game kalian udah jadi. Isi nama, pesan, foto & suratnya di sini:
${cmsUrl()}
Email: ${email}
Password: ${password}

Kalau udah selesai, kirim link ini ke pasanganmu:
${gameLink(slug)}
${paid_until === 'forever' ? '\nAktif selamanya 💖' : paid_until ? `\nAktif sampai ${fmtDate(paid_until)}.` : ''}`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Pesan disalin, tinggal paste di WhatsApp 💬'); }
  catch { toast('Nggak bisa nyalin otomatis, salin manual yaa'); }
}

$('#cms-url').textContent = cmsUrl();
$('#btn-gen').addEventListener('click', () => { $('#new-pass').value = randomPassword(); });

$('#form-new').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#btn-new');
  const payload = {
    action: 'create',
    email: $('#new-email').value.trim(),
    password: $('#new-pass').value,
    plan: $('#new-plan').value,
    days: $('#new-days').value === 'forever' ? 0 : Number($('#new-days').value),
    names: { pasangan: $('#new-pasangan').value.trim(), pengirim: $('#new-pengirim').value.trim() },
    note: $('#new-note').value.trim(),
  };
  btn.disabled = true;
  btn.textContent = 'Membuat…';
  try {
    const res = await callOwner(payload);
    const forever = $('#new-days').value === 'forever';
    if (forever) {
      // Sekali bayar: tanpa tanggal habis
      const { error } = await sb.rpc('admin_update_couple', { p_id: res.id, p_plan: res.plan, p_paid_until: null, p_active: true, p_note: payload.note || null });
      if (error) throw new Error(`Akun jadi, tapi gagal diset selamanya: ${error.message}`);
    }
    const msg = loginMessage({ email: res.email, password: payload.password, slug: res.slug, paid_until: forever ? 'forever' : payload.days ? res.paid_until : null });
    const box = $('#new-result');
    box.hidden = false;
    box.innerHTML = `<b>✅ Akun ${esc(res.email)} jadi!</b> Kirim pesan ini ke pembeli (password cuma kelihatan sekarang):
      <pre>${esc(msg)}</pre>
      <div class="row">
        <button type="button" class="btn small-btn" id="btn-copy-msg">📋 Salin pesan</button>
        <a class="btn ghost small-btn" target="_blank" rel="noopener" id="btn-wa-msg">💬 Buka WhatsApp</a>
      </div>`;
    $('#btn-copy-msg').onclick = () => copyText(msg);
    $('#btn-wa-msg').href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    $('#form-new').reset();
    toast('Akun pembeli dibuat ✓');
    await refresh();
  } catch (err) {
    const box = $('#new-result');
    box.hidden = false;
    box.innerHTML = `<b>❌ Akun belum jadi.</b><br>${esc(err.message)}`;
    toast(`Gagal: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Bikin akun';
  }
});

async function changePassword(c) {
  const password = prompt(`Password baru buat ${c.owner_email}? (min. 6 karakter)`, randomPassword());
  if (password == null) return;
  if (password.length < 6) { toast('Password minimal 6 karakter'); return; }
  try {
    await callOwner({ action: 'password', couple_id: c.id, password });
    await copyText(`Password Love Quest kamu udah diganti 🔑\n${cmsUrl()}\nEmail: ${c.owner_email}\nPassword: ${password}`);
  } catch (err) {
    toast(`Gagal: ${err.message}`);
  }
}

async function removeAccount(c) {
  const typed = prompt(`Hapus akun ${c.owner_email} beserta game, streak & fotonya? Ini nggak bisa dibatalin.\n\nKetik HAPUS buat lanjut:`);
  if (typed?.trim().toUpperCase() !== 'HAPUS') return;
  try {
    await callOwner({ action: 'delete', couple_id: c.id });
    couples = couples.filter((x) => x.id !== c.id);
    render();
    toast('Akun dihapus');
  } catch (err) {
    toast(`Gagal: ${err.message}`);
  }
}
$('#search').addEventListener('input', render);
$('#filter').addEventListener('change', render);

async function load() {
  const { data: { session } } = await sb.auth.getSession();
  $('#btn-logout').hidden = !session;
  if (!session) { $('#view-login').hidden = false; $('#view-list').hidden = true; return; }
  const { data: isAdmin, error: adminErr } = await sb.rpc('is_admin');
  if (adminErr) {
    // Biasanya sesi login sudah nggak berlaku (akun dihapus / password diganti): minta login ulang
    await sb.auth.signOut().catch(() => {});
    setStatus(`Sesi login nggak berlaku lagi (${adminErr.message}). Masuk lagi yaa.`);
    $('#btn-logout').hidden = true;
    $('#view-login').hidden = false;
    $('#view-list').hidden = true;
    return;
  }
  if (!isAdmin) {
    setStatus(`Akun ${session.user.email} bukan admin. Jalankan baris terakhir migration-2.sql dengan email akun ini.`);
    $('#view-login').hidden = true;
    return;
  }
  if (!(await refresh())) return;
  setStatus('');
  $('#view-login').hidden = true;
  $('#view-list').hidden = false;
  render();
}

async function refresh() {
  const { data, error } = await sb.rpc('admin_list_couples');
  if (error) { setStatus(`Gagal memuat: ${error.message}`); return false; }
  couples = data;
  render();
  return true;
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword({ email: $('#in-email').value.trim(), password: $('#in-pass').value });
  if (error) { setStatus(error.message.includes('Invalid login') ? 'Email atau password salah.' : `Gagal: ${error.message}`); return; }
  load();
});
$('#btn-logout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

load();

// Tombol mata: lihat / sembunyikan password
document.querySelectorAll('.pass-eye').forEach((b) => b.addEventListener('click', () => {
  const input = b.previousElementSibling;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  b.textContent = show ? '🙈' : '👁️';
  b.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Lihat password');
}));
