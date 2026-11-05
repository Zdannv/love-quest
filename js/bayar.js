// Halaman /bayar: pilih paket → bayar di Midtrans → balik ke sini → login CMS langsung muncul.
// Kode rahasia pesanan disimpen di HP ini aja, jadi cuma yang bayar yang bisa ambil login-nya.
import { CONFIG } from './config.js';
import { esc } from './util.js';
import { loadSite } from './site.js';
import { track as trackEvent } from './track.js';

const $ = (s) => document.querySelector(s);
const { url, anonKey } = CONFIG.cloud;
const FN = `${url.replace(/\/$/, '')}/functions/v1/${CONFIG.checkout?.fn || 'checkout'}`;
const KEY = (id) => `lq-order-${id}`;
const rupiah = (n) => `Rp${n.toLocaleString('id-ID')}`;
await loadSite();
const PRICE = { basic: CONFIG.prices?.basic || 29000, custom: CONFIG.prices?.custom || 49000 };
const wa = (t) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(t)}`;

async function call(body) {
  const res = await fetch(FN, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
const show = (id) => ['#pay-form', '#pay-qris', '#pay-wait', '#pay-done', '#pay-fail'].forEach((s) => ($(s).hidden = s !== id));

// ---------- Formulir ----------
const params = new URLSearchParams(location.search);
let plan = params.get('paket') === 'custom' ? 'custom' : 'basic';
let promo = null; // { code, discount, final } kalau kode promo berlaku

// ---------- Kode promo ----------
async function checkPromo(code, quiet = false) {
  const msg = $('#pay-promo-msg');
  code = String(code || '').trim().toUpperCase();
  if (!code) { promo = null; msg.hidden = true; renderAmount(); return; }
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/promo_check`, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_code: code, p_plan: plan }) }).then((x) => x.json());
    promo = r.ok ? { code: r.code, discount: r.discount, final: r.final } : null;
    msg.hidden = quiet && !r.ok;
    msg.textContent = r.ok ? `✅ ${r.code}: ${r.message}` : `❌ ${r.message || 'Kode promo nggak berlaku'}`;
    msg.className = `pay-promo-msg ${r.ok ? 'ok' : 'bad'}`;
  } catch { promo = null; msg.hidden = false; msg.textContent = 'Nggak bisa ngecek kode sekarang, coba lagi ya'; msg.className = 'pay-promo-msg bad'; }
  renderAmount();
}
function renderAmount() {
  const full = PRICE[plan];
  $('#pay-amt').innerHTML = promo ? `<s>${rupiah(full)}</s> ${rupiah(promo.final)}` : rupiah(full);
  document.querySelectorAll('.pay-amt2').forEach((el) => { el.textContent = rupiah(promo ? promo.final : full); });
}
function renderPlans() {
  $('#pay-plans').innerHTML = CONFIG.packages.map((pk, i) => {
    const id = i ? 'custom' : 'basic';
    return `<label class="pay-plan ${plan === id ? 'on' : ''}"><input type="radio" name="plan" value="${id}" ${plan === id ? 'checked' : ''}>
      <span class="pp-head"><b>${esc(pk.name)}</b><em>${esc(pk.price)}</em></span>
      <ul>${(pk.highlights || []).slice(0, 4).map((f) => `<li>${esc(f)}</li>`).join('')}</ul></label>`;
  }).join('');
  renderAmount();
}
$('#pay-plans').addEventListener('change', (e) => { plan = e.target.value; renderPlans(); if ($('#pay-code').value.trim()) checkPromo($('#pay-code').value); });
$('#pay-apply').addEventListener('click', () => checkPromo($('#pay-code').value));
$('#pay-promo-toggle').addEventListener('click', () => { $('#pay-promo').hidden = false; $('#pay-promo-toggle').hidden = true; $('#pay-code').focus(); });
$('#pay-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); checkPromo($('#pay-code').value); } });
$('#pay-wa').href = wa('Halo! Aku mau pesan Love Quest 💖');
$('#pf-wa').href = wa('Halo! Aku udah coba bayar Love Quest tapi belum berhasil, bisa dibantu? 🙏');

$('#pay-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.submitter?.id === 'pay-qris-go') { qrisCreate(); return; }
  const btn = $('#pay-go'), err = $('#pay-err');
  err.hidden = true; btn.disabled = true; btn.textContent = 'Nyiapin pembayaran…';
  try {
    const r = await call({ action: 'create', plan, promo: promo?.code || undefined, email: $('#pay-email').value, names: { pengirim: $('#pay-pengirim').value, pasangan: $('#pay-pasangan').value } });
    try { localStorage.setItem(KEY(r.order_id), r.secret); localStorage.setItem('lq-order-last', r.order_id); } catch {}
    trackEvent('bayar_submit');
    location.href = r.redirect_url;
  } catch (x) {
    err.textContent = x.message; err.hidden = false;
    btn.disabled = false; btn.innerHTML = 'Bayar <span id="pay-amt"></span> ▶'; renderAmount();
  }
});

// ---------- QRIS semi-otomatis: bayar nominal unik ke QRIS owner, upload bukti, admin nyetujuin ----------
let qrisOn = false;
call({ action: 'qris_info' }).then((r) => {
  qrisOn = Boolean(r.enabled);
  $('#pay-qris-go').hidden = !qrisOn;
  $('#pay-go').classList.toggle('ghost', qrisOn);
  document.body.classList.toggle('qris-on', qrisOn);
  if (qrisOn) $('#pay-go').innerHTML = 'Bayar lewat transfer bank / kartu <span id="pay-amt"></span>';
  renderAmount();
}).catch(() => {});
async function qrisCreate() {
  const btn = $('#pay-qris-go'), err = $('#pay-err');
  err.hidden = true; btn.disabled = true;
  try {
    const r = await call({ action: 'qris_create', plan, promo: promo?.code || undefined, email: $('#pay-email').value, names: { pengirim: $('#pay-pengirim').value, pasangan: $('#pay-pasangan').value } });
    try { localStorage.setItem(KEY(r.order_id), r.secret); localStorage.setItem('lq-order-last', r.order_id); } catch {}
    history.replaceState(null, '', `/bayar?order=${r.order_id}`);
    trackEvent('bayar_qris');
    showQris(r.order_id, r.amount, r.qris);
  } catch (x) { err.textContent = x.message; err.hidden = false; }
  btn.disabled = false;
}
let proof = null;
function showQris(orderId, amount, img) {
  show('#pay-qris'); window.scrollTo(0, 0);
  $('#pq-amt').textContent = rupiah(amount); $('#pq-id').textContent = orderId;
  if (img) { $('#pq-img').src = img; $('#pq-save').href = img; }
  $('#pq-copy').onclick = async () => { try { await navigator.clipboard.writeText(String(amount)); $('#pq-copy').textContent = 'Disalin ✓'; } catch {} };
  $('#pq-send').onclick = async () => {
    if (!proof) return;
    const btn = $('#pq-send'), err = $('#pq-err');
    let secret = null; try { secret = localStorage.getItem(KEY(orderId)); } catch {}
    err.hidden = true; btn.disabled = true; btn.textContent = 'Ngirim…';
    try {
      await call({ action: 'qris_proof', order_id: orderId, secret, proof });
      trackEvent('bayar_qris_proof');
      track(orderId);
    } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Kirim bukti bayar'; }
  };
}
// Screenshot bukti dikecilin dulu (maks 1400px, JPEG) biar upload-nya cepet
$('#pq-file').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    proof = c.toDataURL('image/jpeg', 0.82);
    $('#pq-prev').src = proof; $('#pq-prev').hidden = false;
    $('#pq-file-txt').textContent = '✅ Bukti kepilih (tap buat ganti)';
    $('#pq-send').disabled = false;
  } catch { $('#pq-err').textContent = 'Gambarnya nggak kebaca, coba screenshot lain ya'; $('#pq-err').hidden = false; }
});

// ---------- Habis bayar ----------
async function track(orderId) {
  let secret = null;
  try { secret = localStorage.getItem(KEY(orderId)); } catch {}
  if (!secret) {
    show('#pay-fail');
    $('#pf-title').textContent = 'Pesanan ini dibayar dari HP lain?';
    $('#pf-txt').textContent = 'Login CMS cuma bisa diambil dari HP/browser yang dipakai buat pesan. Kalau udah bayar, chat admin aja ya, nanti dibantu.';
    $('#pf-wa').href = wa(`Halo! Aku udah bayar Love Quest, kode pesanan ${orderId} 🙏`);
    return;
  }
  // Login yang udah pernah diambil di HP ini: tampilin lagi tanpa bikin password baru
  try { const saved = JSON.parse(localStorage.getItem(`${KEY(orderId)}-login`)); if (saved) { done(saved); return; } } catch {}
  show('#pay-wait');
  const t0 = Date.now();
  for (;;) {
    let r;
    try { r = await call({ action: 'status', order_id: orderId, secret }); } catch (x) { r = { status: 'error', msg: x.message }; }
    if (r.status === 'paid') {
      const login = await call({ action: 'claim', order_id: orderId, secret });
      try { localStorage.setItem(`${KEY(orderId)}-login`, JSON.stringify(login)); } catch {}
      trackEvent('bayar_paid');
      done(login); return;
    }
    if (r.qris_state === 'qris_wait' && r.status === 'pending') { showQris(orderId, r.amount, r.qris); return; }
    if (r.qris_state === 'qris_review' && r.status === 'pending') {
      $('#pay-wait h1').textContent = 'Bukti bayar udah dikirim 🙏';
      $('#pay-wait-txt').textContent = 'Admin lagi ngecek pembayaranmu, biasanya nggak sampai 15 menit (09.00–21.00 WIB). Biarin halaman ini kebuka, login-nya muncul otomatis begitu disetujui.';
      $('#pw-wa').hidden = false; $('#pw-wa').href = wa(`Halo! Aku udah bayar Love Quest pakai QRIS (kode ${orderId}), tolong dicek ya 🙏`);
    }
    if (r.status === 'failed' && r.qris_state === 'qris_rejected') {
      show('#pay-fail'); $('#pf-title').textContent = 'Pembayaran QRIS-nya belum bisa dikonfirmasi';
      $('#pf-txt').textContent = 'Admin belum nemu pembayaranmu di mutasi. Kalau udah beneran bayar, chat admin ya, kirim bukti & kode pesanannya.';
      $('#pf-wa').href = wa(`Halo! Pembayaran QRIS Love Quest-ku (kode ${orderId}) ditolak, padahal udah bayar 🙏`);
      return;
    }
    if (r.status === 'failed') { show('#pay-fail'); return; }
    if (r.status === 'need_help') {
      show('#pay-fail'); $('#pf-title').textContent = 'Pembayaran masuk, tapi akunnya perlu dibantu admin';
      $('#pf-txt').textContent = 'Biasanya karena email ini udah pernah dipakai. Tenang, uangmu aman. Chat admin ya, kami beresin.';
      $('#pf-wa').href = wa(`Halo! Pembayaran Love Quest-ku udah masuk (kode ${orderId}), tapi akunnya belum jadi 🙏`);
      return;
    }
    if (Date.now() - t0 > (r.qris_state === 'qris_review' ? 30 * 60000 : 90000)) { // pembayaran belum dilakukan (misalnya transfer bank yang masih nunggu)
      $('#pay-wait-txt').textContent = 'Pembayaranmu belum masuk. Kalau pakai transfer bank/VA, selesain dulu bayarnya, terus tap Cek lagi.';
      $('#pay-recheck').hidden = false; return;
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
}
function done(l) {
  show('#pay-done');
  $('#pd-cms').textContent = l.cms; $('#pd-cms').href = l.cms; $('#pd-open').href = l.cms;
  $('#pd-email').textContent = l.email; $('#pd-pass').textContent = l.password;
  $('#pd-game').textContent = l.game; $('#pd-game').href = l.game;
  $('#pd-copy').onclick = async () => {
    const text = `Love Quest 💖\nCMS: ${l.cms}\nEmail: ${l.email}\nPassword: ${l.password}\nLink game: ${l.game}`;
    try { await navigator.clipboard.writeText(text); $('#pd-copy').textContent = '✅ Disalin'; } catch { $('#pd-copy').textContent = 'Salin manual ya'; }
  };
}
$('#pay-recheck').addEventListener('click', () => { $('#pay-recheck').hidden = true; $('#pay-wait-txt').textContent = 'Ngecek lagi…'; track(params.get('order')); });

if (params.get('order')) track(params.get('order'));
else {
  renderPlans(); show('#pay-form'); trackEvent('bayar_view', { once: true });
  if (params.get('promo')) { $('#pay-promo').hidden = false; $('#pay-promo-toggle').hidden = true; $('#pay-code').value = params.get('promo').toUpperCase(); checkPromo(params.get('promo')); }
}
