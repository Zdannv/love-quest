// Halaman /bayar: pilih paket → bayar di Midtrans → balik ke sini → login CMS langsung muncul.
// Kode rahasia pesanan disimpen di HP ini aja, jadi cuma yang bayar yang bisa ambil login-nya.
import { CONFIG } from './config.js';
import { esc } from './util.js';
import { track } from './track.js';

const $ = (s) => document.querySelector(s);
const { url, anonKey } = CONFIG.cloud;
const FN = `${url.replace(/\/$/, '')}/functions/v1/${CONFIG.checkout?.fn || 'checkout'}`;
const KEY = (id) => `lq-order-${id}`;
const rupiah = (n) => `Rp${n.toLocaleString('id-ID')}`;
const PRICE = { basic: 29000, custom: 49000 };
const wa = (t) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(t)}`;

async function call(body) {
  const res = await fetch(FN, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
const show = (id) => ['#pay-form', '#pay-wait', '#pay-done', '#pay-fail'].forEach((s) => ($(s).hidden = s !== id));

// ---------- Formulir ----------
const params = new URLSearchParams(location.search);
let plan = params.get('paket') === 'custom' ? 'custom' : 'basic';
function renderPlans() {
  $('#pay-plans').innerHTML = CONFIG.packages.map((pk, i) => {
    const id = i ? 'custom' : 'basic';
    return `<label class="pay-plan ${plan === id ? 'on' : ''}"><input type="radio" name="plan" value="${id}" ${plan === id ? 'checked' : ''}>
      <span class="pp-head"><b>${esc(pk.name)}</b><em>${esc(pk.price)}</em></span>
      <ul>${(pk.highlights || []).slice(0, 4).map((f) => `<li>${esc(f)}</li>`).join('')}</ul></label>`;
  }).join('');
  $('#pay-amt').textContent = rupiah(PRICE[plan]);
}
$('#pay-plans').addEventListener('change', (e) => { plan = e.target.value; renderPlans(); });
$('#pay-wa').href = wa('Halo! Aku mau pesan Love Quest 💖');
$('#pf-wa').href = wa('Halo! Aku udah coba bayar Love Quest tapi belum berhasil, bisa dibantu? 🙏');

$('#pay-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#pay-go'), err = $('#pay-err');
  err.hidden = true; btn.disabled = true; btn.textContent = 'Nyiapin pembayaran…';
  try {
    const r = await call({ action: 'create', plan, email: $('#pay-email').value, names: { pengirim: $('#pay-pengirim').value, pasangan: $('#pay-pasangan').value } });
    try { localStorage.setItem(KEY(r.order_id), r.secret); localStorage.setItem('lq-order-last', r.order_id); } catch {}
    track('bayar_submit');
    location.href = r.redirect_url;
  } catch (x) {
    err.textContent = x.message; err.hidden = false;
    btn.disabled = false; btn.innerHTML = `Bayar <span id="pay-amt">${rupiah(PRICE[plan])}</span> ▶`;
  }
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
      track('bayar_paid');
      done(login); return;
    }
    if (r.status === 'failed') { show('#pay-fail'); return; }
    if (r.status === 'need_help') {
      show('#pay-fail'); $('#pf-title').textContent = 'Pembayaran masuk, tapi akunnya perlu dibantu admin';
      $('#pf-txt').textContent = 'Biasanya karena email ini udah pernah dipakai. Tenang, uangmu aman. Chat admin ya, kami beresin.';
      $('#pf-wa').href = wa(`Halo! Pembayaran Love Quest-ku udah masuk (kode ${orderId}), tapi akunnya belum jadi 🙏`);
      return;
    }
    if (Date.now() - t0 > 90000) { // pembayaran belum dilakukan (misalnya transfer bank yang masih nunggu)
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
else { renderPlans(); show('#pay-form'); track('bayar_view', { once: true }); }
