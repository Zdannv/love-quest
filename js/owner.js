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
let orders = null; // null = daftar pembayaran belum bisa dimuat (migration-9 belum dijalankan)
// Mode contoh (cuma di komputer sendiri): data bohongan buat ngecek tampilan, nggak nyentuh database
const PREVIEW = new URLSearchParams(location.search).has('contoh') && ['localhost', '127.0.0.1'].includes(location.hostname);
const SAMPLE = [
  { id: 'a1', slug: 'kiranaarga27', owner_email: 'arga@email.com', names: { pengirim: 'Arga', pasangan: 'Kirana' }, plan: 'custom', paid_until: null, active: true, note: 'Midtrans LQ-20261015-abc123', created_at: '2026-10-15T09:00:00Z', updated_at: '2026-10-15T12:00:00Z' },
  { id: 'a2', slug: 'rakanadia001', owner_email: 'raka@email.com', names: { pengirim: 'Raka', pasangan: 'Nadia' }, plan: 'basic', paid_until: null, active: true, note: 'bayar 3 Okt via QRIS', created_at: '2026-10-03T09:00:00Z', updated_at: '2026-10-10T12:00:00Z' },
  { id: 'a3', slug: 'dimasayu0002', owner_email: 'dimas@email.com', names: { pengirim: 'Dimas', pasangan: '' }, plan: 'basic', paid_until: '2026-10-17', active: true, note: '', created_at: '2026-09-28T09:00:00Z', updated_at: '2026-09-29T12:00:00Z' },
  { id: 'a4', slug: 'lamaaaaa0003', owner_email: 'lama@email.com', names: {}, plan: 'basic', paid_until: '2026-09-30', active: false, note: 'nggak lanjut', created_at: '2026-09-20T09:00:00Z', updated_at: '2026-09-20T12:00:00Z' },
];
const SAMPLE_ORDERS = [
  { id: 'LQ-20261015-abc123', plan: 'custom', amount: 49000, email: 'arga@email.com', names: { pengirim: 'Arga', pasangan: 'Kirana' }, status: 'paid', pay_status: 'settlement', slug: 'kiranaarga27', claimed: 1, created_at: '2026-10-15T08:58:00Z', paid_at: '2026-10-15T09:00:00Z' },
  { id: 'LQ-20261015-zzz999', plan: 'basic', amount: 29000, email: 'raka@email.com', names: {}, status: 'need_help', pay_status: 'settlement', note: 'Akun gagal dibuat: email sudah terdaftar', claimed: 0, created_at: '2026-10-15T10:00:00Z', paid_at: '2026-10-15T10:02:00Z' },
  { id: 'LQ-20261015-pend01', plan: 'basic', amount: 29000, email: 'calon@email.com', names: {}, status: 'pending', pay_status: 'pending', claimed: 0, created_at: '2026-10-15T11:00:00Z' },
  { id: 'LQ-20261014-fail01', plan: 'custom', amount: 49000, email: 'batal@email.com', names: {}, status: 'failed', pay_status: 'expire', claimed: 0, created_at: '2026-10-14T11:00:00Z' },
];

function stateOf(c) {
  if (!c.active) return 'expired';
  if (!c.paid_until) return 'active';
  const left = daysBetween(todayWib(), c.paid_until);
  if (left < 0) return 'expired';
  return left <= 3 ? 'soon' : 'active';
}
const STATE_LABEL = { active: 'Aktif', soon: 'Segera habis', expired: 'Berhenti' };
const ORDER_LABEL = { paid: ['Lunas', 'ok'], creating: ['Lagi dibuat', 'wait'], pending: ['Nunggu bayar', 'wait'], failed: ['Batal / kedaluwarsa', 'off'], need_help: ['Perlu dibantu', 'bad'] };
const initials = (n) => (n || '?').trim().slice(0, 1).toUpperCase();
const timeAgo = (iso) => {
  if (!iso) return '-';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? 'baru aja' : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : fmtDate(iso.slice(0, 10));
};
let filterNow = 'all';
let events = null, fnDays = 7; // null = statistik belum bisa dimuat (migration-10 belum dijalankan)
const SAMPLE_EVENTS = (() => { const out = []; const base = { landing_view: 120, try_click: 46, paket_open: 30, bayar_view: 22, bayar_submit: 9, bayar_paid: 6, game_open: 40, upgrade_click: 2 };
  for (let i = 0; i < 30; i++) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); for (const [k, v] of Object.entries(base)) out.push({ day: d, name: k, n: Math.round(v * (0.5 + ((i * 7 + k.length) % 10) / 10)) }); } return out; })();
let promos = null; // null = belum bisa dimuat (migration-11 belum dijalankan)
const SAMPLE_PROMOS = [
  { code: 'LOVE1111', kind: 'amount', value: 11000, plans: ['basic', 'custom'], starts_at: '2026-11-09T00:00:00+07:00', ends_at: '2026-11-11T23:59:00+07:00', max_uses: 111, used: 0, active: true, banner: 'Promo 11.11: hemat Rp11.000!', note: 'promo IG 11.11' },
  { code: 'LDR20', kind: 'percent', value: 20, plans: ['custom'], starts_at: '2026-10-10T00:00:00+07:00', ends_at: '2026-10-31T23:59:00+07:00', max_uses: null, used: 7, active: true, banner: null, note: 'kolab kreator LDR' },
  { code: 'COBA5', kind: 'amount', value: 5000, plans: ['basic'], starts_at: '2026-10-01T00:00:00+07:00', ends_at: '2026-10-07T23:59:00+07:00', max_uses: 50, used: 50, active: true, banner: null, note: '' },
];
const PRICE_OF = { basic: 29000, custom: 49000 };
const wibInput = (d) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 16); // Date → nilai input datetime-local (WIB)
const fromWib = (v) => new Date(`${v}:00+07:00`).toISOString();
function promoState(p) {
  const now = Date.now();
  if (!p.active) return ['Nonaktif', 'off'];
  if (p.max_uses && p.used >= p.max_uses) return ['Kuota habis', 'off'];
  if (now < new Date(p.starts_at)) return ['Terjadwal', 'wait'];
  if (now > new Date(p.ends_at)) return ['Berakhir', 'off'];
  return ['Aktif', 'ok'];
}
const discText = (p) => (p.kind === 'percent' ? `${p.value}%` : `Rp${p.value.toLocaleString('id-ID')}`);
function renderPromos() {
  const box = $('#promo-list');
  if (promos === null) { box.innerHTML = '<p class="muted small">Kode promo belum bisa dimuat. Jalankan <code>supabase/migration-11.sql</code> di SQL Editor dulu.</p>'; return; }
  if (!promos.length) { box.innerHTML = '<p class="muted small">Belum ada kode promo. Bikin dari form di atas.</p>'; return; }
  const fmt = (d) => new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  box.innerHTML = promos.map((p) => {
    const [label, cls] = promoState(p);
    const ex = (p.plans || []).map((pl) => { const full = PRICE_OF[pl]; if (!full) return ''; const d = Math.min(p.kind === 'percent' ? Math.floor(full * Math.min(p.value, 90) / 100) : p.value, full - 1000); return `${pl === 'custom' ? 'Premium' : 'Love Quest'} Rp${(full - d).toLocaleString('id-ID')}`; }).filter(Boolean).join(' · ');
    return `<div class="promo-row ${cls}" data-code="${esc(p.code)}">
      <div class="pr-main"><div class="pr-top"><span class="pr-code">${esc(p.code)}</span><span class="or-chip ${cls}">${label}</span><b>−${discText(p)}</b></div>
        <small>${fmt(p.starts_at)} – ${fmt(p.ends_at)} WIB · dipakai ${p.used}${p.max_uses ? `/${p.max_uses}` : ''}</small>
        <small>Jadi: ${ex}${p.banner ? ` · 🎀 pita: "${esc(p.banner)}"` : ''}${p.note ? ` · 📝 ${esc(p.note)}` : ''}</small></div>
      <div class="pr-act"><button type="button" class="link-btn" data-pedit>Edit</button><button type="button" class="link-btn" data-ptoggle>${p.active ? 'Matikan' : 'Nyalakan'}</button><button type="button" class="link-btn danger" data-pdel>Hapus</button><button type="button" class="link-btn" data-plink>Salin link</button></div>
    </div>`;
  }).join('');
}
function fillPromo(p) {
  $('#pf-code').value = p.code || ''; $('#pf-kind').value = p.kind || 'amount'; $('#pf-value').value = p.value || '';
  $('#pf-start').value = p.starts_at ? wibInput(new Date(p.starts_at)) : ''; $('#pf-end').value = p.ends_at ? wibInput(new Date(p.ends_at)) : '';
  $('#pf-max').value = p.max_uses || ''; $('#pf-banner').value = p.banner || ''; $('#pf-note').value = p.note || '';
  $('#pf-basic').checked = (p.plans || ['basic']).includes('basic'); $('#pf-custom').checked = (p.plans || ['custom']).includes('custom');
  $('#promo-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
// Isi cepat: tanggal kembar berikutnya (11.11, 12.12, 1.1, 2.2, …), diskon seminggu, gajian
function preset(kind) {
  const wib = new Date(Date.now() + 7 * 3600e3); let y = wib.getUTCFullYear(), m = wib.getUTCMonth() + 1, d = wib.getUTCDate();
  if (kind === 'twin') {
    let tm = m, ty = y; if (d > m) { tm = m + 1; if (tm > 12) { tm = 1; ty++; } }
    const s = new Date(Date.UTC(ty, tm - 1, tm, 0, 0) - 7 * 3600e3), e = new Date(Date.UTC(ty, tm - 1, tm, 23, 59) - 7 * 3600e3);
    const tag = `${tm}${tm}`;
    fillPromo({ code: `LOVE${tag}`, kind: 'amount', value: Math.min(15000, tm * 1000), plans: ['basic', 'custom'], starts_at: new Date(s.getTime() - 2 * 864e5).toISOString(), ends_at: e.toISOString(), banner: `Promo ${tm}.${tm}: hemat Rp${(Math.min(15000, tm * 1000)).toLocaleString('id-ID')}!`, note: `promo tanggal kembar ${tm}.${tm}` });
  } else if (kind === 'week') {
    fillPromo({ code: 'SAYANG20', kind: 'percent', value: 20, plans: ['basic', 'custom'], starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 7 * 864e5).toISOString(), banner: 'Diskon 20% minggu ini!', note: '' });
  } else {
    let pm = m, py = y; if (d > 28) { pm++; if (pm > 12) { pm = 1; py++; } }
    fillPromo({ code: 'GAJIAN', kind: 'amount', value: 7000, plans: ['basic', 'custom'], starts_at: new Date(Date.UTC(py, pm - 1, 25, 0, 0) - 7 * 3600e3).toISOString(), ends_at: new Date(Date.UTC(py, pm - 1, 28, 23, 59) - 7 * 3600e3).toISOString(), banner: 'Promo gajian: hemat Rp7.000!', note: 'promo gajian' });
  }
}
// ---------- Pengaturan web (tabel site_settings) ----------
let settings = null; // null = belum bisa dimuat (migration-13 belum dijalankan)
const SAMPLE_SETTINGS = { prices: { basic: 29000, custom: 49000, upgrade: 20000 }, contact: { whatsapp: '6285136086902', email: 'zdannfoo@gmail.com', hours: 'Setiap hari, 09.00–21.00 WIB', instagram: '', tiktok: '' }, announcement: { text: '', where: 'both', until: null }, testimonials: [] };
function renderSettings() {
  const box = $('#settings-body');
  if (settings === null) { box.innerHTML = '<p class="muted small">Pengaturan belum bisa dimuat. Jalankan <code>supabase/migration-13.sql</code> di SQL Editor dulu.</p>'; return; }
  const pr = settings.prices || {}, c = settings.contact || {}, a = settings.announcement || {}, T = settings.testimonials || [];
  const pk = settings.packages || CONFIG.packages.map((p) => ({ tag: p.tag, highlights: p.highlights || [] }));
  box.innerHTML = `
    <form class="set-group" data-set="prices"><h4>💰 Harga</h4>
      <div class="grid3"><label>Love Quest<input type="number" name="basic" min="1000" step="500" value="${pr.basic || 29000}"></label><label>Premium<input type="number" name="custom" min="1000" step="500" value="${pr.custom || 49000}"></label><label>Upgrade ke Premium<input type="number" name="upgrade" min="1000" step="500" value="${pr.upgrade || 20000}"></label></div>
      <p class="muted small">Langsung dipakai di landing, halaman bayar, CMS & server pembayaran.</p><button class="btn small-btn">Simpan harga</button></form>
    <form class="set-group" data-set="packages"><h4>📦 Isi kartu paket</h4>
      ${[0, 1].map((i) => `<div class="grid2"><label>Label ${i ? 'Premium' : 'Love Quest'}<input name="tag${i}" maxlength="40" value="${esc(pk[i]?.tag || '')}"></label><label>Poin utama (satu per baris)<textarea name="hl${i}" rows="5">${esc((pk[i]?.highlights || []).join('\n'))}</textarea></label></div>`).join('')}
      <button class="btn small-btn">Simpan isi paket</button></form>
    <form class="set-group" data-set="contact"><h4>📞 Kontak</h4>
      <div class="grid2"><label>WhatsApp layanan<input name="whatsapp" value="${esc(c.whatsapp || '')}" placeholder="08xx atau 628xx"></label><label>Email<input type="email" name="email" value="${esc(c.email || '')}"></label></div>
      <div class="grid3"><label>Jam layanan<input name="hours" value="${esc(c.hours || '')}"></label><label>Instagram<input name="instagram" value="${esc(c.instagram || '')}" placeholder="@lovequest.id"></label><label>TikTok<input name="tiktok" value="${esc(c.tiktok || '')}" placeholder="@lovequest.id"></label></div>
      <button class="btn small-btn">Simpan kontak</button></form>
    <form class="set-group" data-set="announcement"><h4>📢 Pengumuman</h4>
      <label>Teks (kosongin buat matiin)<input name="text" maxlength="140" value="${esc(a.text || '')}" placeholder="contoh: Fitur baru: menu Kenangan! 🏆"></label>
      <div class="grid2"><label>Tampil di<select name="where"><option value="both" ${a.where === 'both' ? 'selected' : ''}>Landing & game</option><option value="landing" ${a.where === 'landing' ? 'selected' : ''}>Landing aja</option><option value="game" ${a.where === 'game' ? 'selected' : ''}>Game pasangan aja</option></select></label><label>Sampai (opsional, WIB)<input type="datetime-local" name="until" value="${a.until ? wibInput(new Date(a.until)) : ''}"></label></div>
      <button class="btn small-btn">Simpan pengumuman</button></form>
    <form class="set-group" data-set="testimonials"><h4>💬 Testimoni</h4>
      <p class="muted small">Bagian testimoni di landing muncul otomatis kalau ada minimal satu. Pakai testimoni asli & minta izin dulu ya.</p>
      <div id="testi-list">${T.map((t, i) => testiRow(t, i)).join('')}</div>
      <div class="row"><button type="button" class="btn ghost small-btn" data-testi-add>+ Tambah testimoni</button><button class="btn small-btn">Simpan testimoni</button></div></form>`;
}
const testiRow = (t = {}, i = 0) => `<div class="testi-row"><div class="grid2"><label>Nama<input name="name" maxlength="40" value="${esc(t.name || '')}" placeholder="contoh: Raka, Bandung"></label><label>Keterangan<input name="note" maxlength="60" value="${esc(t.note || '')}" placeholder="contoh: kado anniversary"></label></div>
  <label>Isi testimoni<textarea name="text" rows="2" maxlength="300">${esc(t.text || '')}</textarea></label><label>Link foto (opsional)<input name="photo" value="${esc(t.photo || '')}" placeholder="https://…"></label><button type="button" class="link-btn danger" data-testi-del>Hapus</button></div>`;
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-testi-add]')) { $('#testi-list').insertAdjacentHTML('beforeend', testiRow()); }
  if (e.target.closest('[data-testi-del]')) e.target.closest('.testi-row').remove();
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-set]'); if (!f) return;
  e.preventDefault();
  const key = f.dataset.set, v = Object.fromEntries(new FormData(f));
  let value;
  if (key === 'prices') value = { basic: Number(v.basic), custom: Number(v.custom), upgrade: Number(v.upgrade) };
  else if (key === 'packages') value = [0, 1].map((i) => ({ tag: v[`tag${i}`].trim(), highlights: v[`hl${i}`].split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8) }));
  else if (key === 'contact') value = { ...v, whatsapp: String(v.whatsapp).replace(/\D/g, '').replace(/^0/, '62') };
  else if (key === 'announcement') value = { text: v.text.trim(), where: v.where, until: v.until ? fromWib(v.until) : null };
  else value = [...f.querySelectorAll('.testi-row')].map((r) => Object.fromEntries(['name', 'note', 'text', 'photo'].map((n) => [n, r.querySelector(`[name="${n}"]`).value.trim()]))).filter((t) => t.text);
  if (PREVIEW) { settings[key] = value; renderSettings(); toast('Mode contoh: nggak disimpan'); return; }
  const { error } = await sb.rpc('admin_set_setting', { p_key: key, p_value: value });
  if (error) { toast(`Gagal: ${error.message}`); return; }
  settings[key] = value; renderSettings(); toast('Tersimpan ✓ Langsung berlaku di web');
});
// Ekspor CSV (dibikin di browser dari data yang udah dimuat)
function downloadCsv(name, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(cell).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}
$('#btn-csv-couples').addEventListener('click', () => downloadCsv('lovequest-pembeli', [['email', 'pengirim', 'pasangan', 'paket', 'aktif sampai', 'status', 'link game', 'catatan', 'dibuat'],
  ...couples.map((c) => [c.owner_email, c.names?.pengirim, c.names?.pasangan, c.plan === 'custom' ? 'Premium' : 'Love Quest', c.paid_until || 'selamanya', stateOf(c), gameLink(c.slug), c.note, c.created_at?.slice(0, 10)])]));
$('#btn-csv-orders').addEventListener('click', () => { if (!orders) { toast('Daftar pesanan belum kemuat'); return; } downloadCsv('lovequest-pesanan', [['kode', 'email', 'paket', 'nominal', 'promo', 'status', 'status midtrans', 'dibuat', 'lunas'],
  ...orders.map((o) => [o.id, o.email, o.plan, o.amount, o.promo_code || '', o.status, o.pay_status || '', o.created_at, o.paid_at || ''])]); });
$('#btn-report').addEventListener('click', async () => {
  if (PREVIEW) { toast('Mode contoh'); return; }
  const b = $('#btn-report'); b.disabled = true; b.textContent = 'Ngirim…';
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(`${url.replace(/\/$/, '')}/functions/v1/owner-report`, { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json().catch(() => ({}));
    if (r.status === 404) throw new Error('Edge function owner-report belum di-deploy');
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    $('#report-out').textContent = d.sent?.length ? `Terkirim lewat: ${d.sent.join(', ')} ✓` : 'Laporan jadi, tapi Telegram/email belum diatur (isi secret TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID).';
  } catch (x) { toast(x.message); }
  b.disabled = false; b.textContent = '📊 Kirim laporan sekarang';
});
const FUNNEL = [['landing_view', 'Buka landing'], ['try_click', 'Coba main gratis'], ['paket_open', 'Lihat paket'], ['bayar_view', 'Buka halaman bayar'], ['bayar_submit', 'Klik bayar'], ['bayar_paid', 'Lunas 🎉']];
function renderFunnel() {
  const box = $('#funnel');
  if (events === null) { box.innerHTML = '<p class="muted small">Statistik belum bisa dimuat. Jalankan <code>supabase/migration-10.sql</code> di SQL Editor dulu.</p>'; return; }
  const from = new Date(Date.now() - (fnDays - 1) * 864e5).toISOString().slice(0, 10);
  const sum = (k) => events.filter((e) => e.name === k && e.day >= from).reduce((a, e) => a + e.n, 0);
  const top = Math.max(1, sum('landing_view'));
  box.innerHTML = FUNNEL.map(([k, label], i) => {
    const n = sum(k), prev = i ? sum(FUNNEL[i - 1][0]) : 0;
    return `<div class="fn-row"><span class="fn-label">${label}</span><div class="fn-bar"><i style="width:${Math.max(2, (n / top) * 100)}%"></i></div><b>${n}</b><small>${i ? (prev ? `${Math.round((n / prev) * 100)}%` : '-') : ''}</small></div>`;
  }).join('') + `<p class="muted small fn-extra">🎮 Game pasangan dibuka: <b>${sum('game_open')}</b> · ✨ Klik upgrade: <b>${sum('upgrade_click')}</b> · Konversi landing → lunas: <b>${sum('landing_view') ? ((sum('bayar_paid') / sum('landing_view')) * 100).toFixed(1) : 0}%</b></p>`;
}

function gameLink(slug) {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  return local ? `${location.origin}/?c=${slug}` : `${location.origin}/c/${slug}`;
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const f = filterNow;
  const counts = { active: 0, soon: 0, expired: 0 };
  couples.forEach((c) => counts[stateOf(c)]++);
  const PRICE = { basic: 29000, custom: 49000 };
  const forever = couples.filter((c) => !c.paid_until && c.active).length;
  const income = couples.reduce((a, c) => a + (PRICE[c.plan] || 0), 0);
  const paidOrders = (orders || []).filter((o) => o.status === 'paid');
  const help = (orders || []).filter((o) => o.status === 'need_help').length;
  $('#oh-income').textContent = `Rp${income.toLocaleString('id-ID')}`;
  $('#oh-sub').textContent = `${couples.length} game · ${paidOrders.length} lunas otomatis${help ? ` · ⚠️ ${help} perlu dibantu` : ''}`;
  const stat = (n, t, ic, cls) => `<div class="stat ${cls}"><span>${ic}</span><b>${n}</b><small>${t}</small></div>`;
  $('#summary').innerHTML = stat(couples.length, 'total game', '🎮', 'c1') + stat(counts.active, 'aktif', '✅', 'c2') + stat(forever, 'selamanya', '♾️', 'c3')
    + stat(couples.filter((c) => c.plan === 'custom').length, 'Premium', '✨', 'c4') + stat(counts.soon, 'habis ≤ 3 hari', '⏳', 'c5') + stat(counts.expired, 'berhenti', '⛔', 'c6');
  $('#filter').value = filterNow;
  $('#filter-chips').innerHTML = [['all', `Semua ${couples.length}`], ['active', `Aktif ${counts.active}`], ['soon', `Segera habis ${counts.soon}`], ['expired', `Berhenti ${counts.expired}`]]
    .map(([v, t]) => `<button type="button" class="${filterNow === v ? 'on' : ''}" data-filter="${v}">${t}</button>`).join('');
  renderOrders();
  renderFunnel();
  renderPromos();
  renderSettings();

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
          <span class="cc-ava ${c.plan}">${esc(initials(c.names?.pengirim || c.owner_email))}</span>
          <div class="cc-who">
            <b>${esc(names)}</b>
            <div class="muted small">${esc(c.owner_email || '-')} · <a href="${esc(gameLink(c.slug))}" target="_blank" rel="noopener">${esc(c.slug)}</a></div>
            <div class="cc-tags"><span class="plan-chip ${c.plan}">${c.plan === 'custom' ? '✨ Premium' : 'Love Quest'}</span><span class="state-chip ${st}">${STATE_LABEL[st]}</span><span class="cc-date">${c.paid_until ? `s/d ${fmtDate(c.paid_until)}` : '♾️ selamanya'}</span></div>
          </div>
        </header>
        <details class="cc-manage"><summary>Kelola akun</summary><div class="cc-body">
        <div class="grid2">
          <label>Paket
            <select data-f="plan">
              <option value="basic" ${c.plan === 'basic' ? 'selected' : ''}>Love Quest (Rp29rb)</option>
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
          <button class="link-btn" data-pass>🔑 Kirim ulang login</button>
          <button class="link-btn danger" data-delete>🗑️ Hapus akun</button>
        </div>
        </div></details>
        <div class="muted small cc-foot">Dibuat ${fmtDate(c.created_at?.slice(0, 10))} · terakhir diedit ${fmtDate(c.updated_at?.slice(0, 10))}${c.note ? ` · 📝 ${esc(c.note)}` : ''}</div>
      </article>`;
  }).join('') : '<p class="muted">Belum ada game yang cocok.</p>';
}

function renderOrders() {
  const box = $('#order-list');
  if (orders === null) { box.innerHTML = '<p class="muted small">Daftar pembayaran belum bisa dimuat. Jalankan <code>supabase/migration-9.sql</code> di SQL Editor dulu.</p>'; $('#op-count').textContent = ''; return; }
  if (!orders.length) { box.innerHTML = '<p class="muted small">Belum ada pembayaran otomatis.</p>'; $('#op-count').textContent = ''; return; }
  $('#op-count').textContent = `${orders.filter((o) => o.status === 'paid').length} lunas`;
  box.innerHTML = orders.slice(0, 30).map((o) => {
    const [label, cls] = ORDER_LABEL[o.status] || [o.status, 'off'];
    return `<div class="order-row ${cls}">
      <span class="or-dot"></span>
      <div class="or-main"><b>${esc(o.email)}</b><small>${esc(o.id)} · ${o.plan === 'custom' ? 'Premium' : 'Love Quest'} · Rp${(o.amount || 0).toLocaleString('id-ID')}</small>${o.note ? `<small class="or-note">${esc(o.note)}</small>` : ''}</div>
      <div class="or-side"><span class="or-chip ${cls}">${label}</span><small>${timeAgo(o.paid_at || o.created_at)}</small>
        ${o.status === 'need_help' ? `<span class="or-fix"><button type="button" class="link-btn" data-fix="link" data-id="${esc(o.id)}">Sambungin ke akun lama</button><button type="button" class="link-btn" data-fix="new" data-id="${esc(o.id)}">Akun baru (email lain)</button></span>` : ''}</div>
    </div>`;
  }).join('');
}

async function update(c, patch) {
  if (PREVIEW) { Object.assign(c, patch); render(); toast('Mode contoh: nggak disimpan'); return; }
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

// Kirim ulang login: bikin password baru, terus siapin pesan WA buat pembeli
async function changePassword(c) {
  if (!confirm(`Bikin password baru buat ${c.owner_email}? Password lama nggak berlaku lagi.`)) return;
  const password = randomPassword();
  try {
    if (!PREVIEW) await callOwner({ action: 'password', couple_id: c.id, password });
    showLoginMsg(`Halo! Ini login Love Quest kamu yang baru 🔑\n\nCMS: ${cmsUrl()}\nEmail: ${c.owner_email}\nPassword: ${password}\n\nLink game buat pasangan:\n${gameLink(c.slug)}`, `Login baru ${c.owner_email}`);
  } catch (err) {
    toast(`Gagal: ${err.message}`);
  }
}
// Jendela kecil berisi pesan siap kirim (salin / buka WhatsApp)
function showLoginMsg(msg, title) {
  const el = document.createElement('div');
  el.className = 'tour';
  el.innerHTML = `<div class="tour-card" style="text-align:left"><h3>${esc(title)}</h3><p class="small muted">Password cuma kelihatan sekarang. Kirim ke pembeli:</p><pre class="msg-pre">${esc(msg)}</pre>
    <div class="row"><button type="button" class="btn small-btn" data-m="copy">📋 Salin</button><a class="btn ghost small-btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">💬 WhatsApp</a><button type="button" class="link-btn" data-m="close">Tutup</button></div></div>`;
  el.addEventListener('click', (e) => { const a = e.target.closest('[data-m]')?.dataset.m; if (a === 'copy') copyText(msg); if (a === 'close' || e.target === el) el.remove(); });
  document.body.appendChild(el);
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
document.querySelector('.promo-presets').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b) preset(b.dataset.preset); });
$('#pf-reset').addEventListener('click', () => $('#promo-form').reset());
$('#promo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const plans = [$('#pf-basic').checked && 'basic', $('#pf-custom').checked && 'custom'].filter(Boolean);
  if (!plans.length) { toast('Pilih minimal satu paket'); return; }
  const p = { code: $('#pf-code').value.trim().toUpperCase(), kind: $('#pf-kind').value, value: Number($('#pf-value').value), plans,
    starts_at: fromWib($('#pf-start').value), ends_at: fromWib($('#pf-end').value), max_uses: $('#pf-max').value || '', active: true,
    banner: $('#pf-banner').value.trim(), note: $('#pf-note').value.trim() };
  if (new Date(p.ends_at) <= new Date(p.starts_at)) { toast('Waktu berakhir harus setelah waktu mulai'); return; }
  if (p.kind === 'percent' && p.value > 90) { toast('Diskon persen maksimal 90%'); return; }
  if (PREVIEW) { promos = [{ ...p, used: 0, max_uses: p.max_uses ? Number(p.max_uses) : null }, ...promos.filter((x) => x.code !== p.code)]; renderPromos(); toast('Mode contoh: nggak disimpan'); return; }
  const { error } = await sb.rpc('admin_save_promo', { p });
  if (error) { toast(`Gagal: ${error.message}`); return; }
  toast(`Promo ${p.code} tersimpan ✓`); $('#promo-form').reset(); await refresh();
});
$('#promo-list').addEventListener('click', async (e) => {
  const row = e.target.closest('.promo-row'); if (!row) return;
  const p = promos.find((x) => x.code === row.dataset.code); if (!p) return;
  if (e.target.closest('[data-pedit]')) { fillPromo(p); return; }
  if (e.target.closest('[data-plink]')) { try { await navigator.clipboard.writeText(`${location.origin}/bayar?promo=${p.code}`); toast('Link promo disalin 🔗'); } catch { toast(`${location.origin}/bayar?promo=${p.code}`); } return; }
  if (e.target.closest('[data-pdel]') && !confirm(`Hapus kode ${p.code}?`)) return;
  if (PREVIEW) { if (e.target.closest('[data-pdel]')) promos = promos.filter((x) => x !== p); else p.active = !p.active; renderPromos(); return; }
  const { error } = e.target.closest('[data-pdel]')
    ? await sb.rpc('admin_delete_promo', { p_code: p.code })
    : await sb.rpc('admin_save_promo', { p: { ...p, active: !p.active, max_uses: p.max_uses ?? '' } });
  if (error) { toast(`Gagal: ${error.message}`); return; }
  await refresh();
});
$('#order-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-fix]'); if (!b) return;
  const o = orders.find((x) => x.id === b.dataset.id); if (!o) return;
  let email = null;
  if (b.dataset.fix === 'link' && !confirm(`Sambungin pembayaran ${o.id} ke game lama milik ${o.email}?${o.plan === 'custom' ? ' Paketnya jadi Premium.' : ''}`)) return;
  if (b.dataset.fix === 'new') { email = prompt('Email baru buat akun pembeli ini:'); if (!email) return; }
  if (PREVIEW) { toast('Mode contoh: nggak dijalanin'); return; }
  try {
    const r = await callOwner({ action: 'resolve_order', order_id: o.id, mode: b.dataset.fix, email });
    if (r.password) showLoginMsg(`Halo! Makasih udah pesan Love Quest 💖\n\nCMS: ${cmsUrl()}\nEmail: ${r.email}\nPassword: ${r.password}\n\nLink game buat pasangan:\n${gameLink(r.slug)}`, 'Akun baru jadi ✅');
    else toast(`Disambungin ke game ${r.slug} ✓`);
    await refresh();
  } catch (err) { toast(`Gagal: ${err.message}`); }
});
$('#fn-range').addEventListener('click', (e) => { const b = e.target.closest('[data-days]'); if (!b) return; fnDays = Number(b.dataset.days); $('#fn-range').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); renderFunnel(); });
$('#filter-chips').addEventListener('click', (e) => { const b = e.target.closest('[data-filter]'); if (!b) return; filterNow = b.dataset.filter; render(); });
$('#btn-refresh').addEventListener('click', async () => { if (PREVIEW) { toast('Mode contoh'); return; } if (await refresh()) toast('Data terbaru ✓'); });

async function load() {
  if (PREVIEW) {
    couples = SAMPLE; orders = SAMPLE_ORDERS; events = SAMPLE_EVENTS; promos = SAMPLE_PROMOS; settings = SAMPLE_SETTINGS;
    setStatus('Mode contoh: data bohongan, nggak ada yang disimpan.');
    $('#view-login').hidden = true; $('#view-list').hidden = false; render(); return;
  }
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
  $('#oh-hi').textContent = `Halo, ${session.user.email.split('@')[0]}! 👋`;
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
  const ord = await sb.rpc('admin_list_orders');
  orders = ord.error ? null : ord.data;
  const ev = await sb.rpc('admin_event_counts', { p_days: 30 });
  events = ev.error ? null : ev.data;
  const pr = await sb.rpc('admin_list_promos');
  promos = pr.error ? null : pr.data;
  const st = await sb.rpc('get_site_settings');
  settings = st.error ? null : (st.data || {});
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
