// Halaman owner: lihat semua pembeli & atur langganan (manual, setelah pembayaran masuk).
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

const { url, anonKey } = CONFIG.cloud;
const sb = createClient(url, anonKey);

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
  const paying = couples.filter((c) => stateOf(c) !== 'expired');
  const mrr = paying.length * 30000;
  $('#summary').innerHTML = `
    <div><b>${couples.length}</b><small>total game</small></div>
    <div><b>${counts.active}</b><small>aktif</small></div>
    <div><b>${counts.soon}</b><small>habis ≤ 3 hari</small></div>
    <div><b>${counts.expired}</b><small>berhenti</small></div>
    <div><b>Rp${mrr.toLocaleString('id-ID')}</b><small>perkiraan / bulan*</small></div>`;

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
              <option value="basic" ${c.plan === 'basic' ? 'selected' : ''}>Love Quest (Rp30rb/bln)</option>
              <option value="custom" ${c.plan === 'custom' ? 'selected' : ''}>Love Quest Custom</option>
            </select>
          </label>
          <label>Aktif sampai (${fmtDate(c.paid_until)})<input type="date" data-f="paid_until" value="${c.paid_until || ''}"></label>
        </div>
        <label>Catatan (misal: bayar 24 Sep via QRIS)<input data-f="note" value="${esc(c.note || '')}"></label>
        <div class="row">
          <button class="btn ghost small-btn" data-add="30">+30 hari</button>
          <button class="btn ghost small-btn" data-add="365">+1 tahun</button>
          <button class="btn ghost small-btn" data-toggle>${c.active ? 'Nonaktifkan' : 'Aktifkan lagi'}</button>
          <button class="btn small-btn" data-save>Simpan</button>
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
  } else if (e.target.closest('[data-toggle]')) {
    update(c, { active: !c.active });
  } else if (e.target.closest('[data-save]')) {
    update(c, { plan: field('plan'), note: field('note'), paid_until: field('paid_until') || null });
  }
});
$('#search').addEventListener('input', render);
$('#filter').addEventListener('change', render);

async function load() {
  const { data: { session } } = await sb.auth.getSession();
  $('#btn-logout').hidden = !session;
  if (!session) { $('#view-login').hidden = false; $('#view-list').hidden = true; return; }
  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) {
    setStatus('Akun ini bukan admin. Jalankan baris terakhir migration-2.sql dengan email akun ini.');
    $('#view-login').hidden = true;
    return;
  }
  const { data, error } = await sb.rpc('admin_list_couples');
  if (error) { setStatus(`Gagal memuat: ${error.message}`); return; }
  couples = data;
  setStatus('');
  $('#view-login').hidden = true;
  $('#view-list').hidden = false;
  render();
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword({ email: $('#in-email').value.trim(), password: $('#in-pass').value });
  if (error) { setStatus(error.message.includes('Invalid login') ? 'Email atau password salah.' : `Gagal: ${error.message}`); return; }
  load();
});
$('#btn-logout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

load();
