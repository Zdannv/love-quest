// Edge function "checkout" (Love Quest): bayar otomatis lewat Midtrans Snap.
//   { action: "create", plan, email, names }   → bikin pesanan + link bayar Midtrans
//   { action: "status", order_id, secret }      → cek status pesanan (dipanggil halaman /bayar)
//   { action: "claim",  order_id, secret }      → setelah lunas: kasih login CMS (password baru tiap diambil)
//   { action: "upgrade_check", order_id } + header Authorization → cek & proses pesanan upgrade (cadangan kalau notifikasi telat)
//   { action: "upgrade" } + header Authorization: Bearer <token login CMS> → bayar selisih Rp20.000, paket jadi Premium
//   Notifikasi Midtrans (POST berisi signature_key) → cek tanda tangan, cek ulang ke API Midtrans,
//   kalau lunas: bikin akun CMS + game-nya otomatis (sekali bayar, aktif selamanya).
// Secret yang perlu diisi di Supabase → Edge Functions → Secrets:
//   MIDTRANS_SERVER_KEY   (Server Key dari dashboard Midtrans; sandbox dulu buat tes)
//   MIDTRANS_PRODUCTION   ("true" kalau udah pakai key production, selain itu dianggap sandbox)
//   SITE_URL              (opsional, default https://lovequest.id)
// Deploy dengan "Verify JWT" DIMATIKAN (Midtrans nggak kirim token Supabase).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const SERVER_KEY = Deno.env.get('MIDTRANS_SERVER_KEY') || '';
const PROD = Deno.env.get('MIDTRANS_PRODUCTION') === 'true';
const SITE = (Deno.env.get('SITE_URL') || 'https://lovequest.id').replace(/\/$/, '');
const SNAP = PROD ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const API = PROD ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2';
const PLANS: Record<string, { amount: number; name: string }> = {
  basic: { amount: 29000, name: 'Love Quest' },
  custom: { amount: 49000, name: 'Love Quest Premium' },
  upgrade: { amount: 20000, name: 'Upgrade ke Love Quest Premium' },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (algo: 'SHA-256' | 'SHA-512', text: string) => hex(await crypto.subtle.digest(algo, new TextEncoder().encode(text)));
const rand = (n: number, chars = 'abcdefghijkmnpqrstuvwxyz23456789') =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => chars[b % chars.length]).join('');
const auth = () => 'Basic ' + btoa(`${SERVER_KEY}:`);
const wib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).replaceAll('-', '');

// Lunas → bikin akun + game (aman dipanggil berkali-kali, cuma jalan sekali)
async function fulfill(orderId: string) {
  const { data: kind } = await db.from('orders').select('plan, couple_id').eq('id', orderId).maybeSingle();
  if (kind?.plan === 'upgrade') {
    // Upgrade: game-nya udah ada, tinggal ganti paketnya jadi Premium
    const { data: lk } = await db.from('orders').update({ status: 'creating' }).eq('id', orderId).in('status', ['pending', 'failed']).select('couple_id');
    if (!lk?.length) return;
    const { error } = await db.from('couples').update({ plan: 'custom' }).eq('id', kind.couple_id);
    await db.from('orders').update(error ? { status: 'need_help', note: `Upgrade gagal: ${error.message}` } : { status: 'paid', paid_at: new Date().toISOString() }).eq('id', orderId);
    return;
  }
  // Kunci dulu: notifikasi Midtrans & halaman /bayar bisa manggil barengan, akun cuma boleh dibikin sekali
  const { data: lock } = await db.from('orders').update({ status: 'creating' }).eq('id', orderId).in('status', ['pending', 'failed']).is('couple_id', null).select('*');
  const o = lock?.[0];
  if (!o) return;
  const { data: created, error: userErr } = await db.auth.admin.createUser({ email: o.email, password: rand(16), email_confirm: true });
  if (userErr || !created.user) {
    // Email ini udah punya akun: jangan otak-atik akun lama, owner yang beresin manual
    await db.from('orders').update({ status: 'need_help', note: `Akun gagal dibuat: ${userErr?.message || '-'}`, paid_at: new Date().toISOString() }).eq('id', orderId);
    return;
  }
  const userId = created.user.id;
  const { data: couple, error: insErr } = await db.from('couples')
    .insert({ owner: userId, slug: rand(12), content: { names: o.names || {} } }).select('id, slug').single();
  if (insErr || !couple) {
    await db.auth.admin.deleteUser(userId);
    await db.from('orders').update({ status: 'need_help', note: `Game gagal dibuat: ${insErr?.message}` }).eq('id', orderId);
    return;
  }
  await db.from('couples').update({ plan: o.plan, paid_until: null, active: true, owner_email: o.email, note: `Midtrans ${orderId}` }).eq('id', couple.id);
  await db.from('orders').update({ status: 'paid', couple_id: couple.id, slug: couple.slug, paid_at: new Date().toISOString() }).eq('id', orderId);
}

async function checkOwner(orderId: string, secret: string) {
  const { data: o } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!o || !secret || (await sha('SHA-256', secret)) !== o.token_hash) return null;
  return o;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST saja' }, 405);
  if (!SERVER_KEY) return json({ error: 'Pembayaran otomatis belum diaktifkan' }, 503);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Body harus JSON' }, 400); }

  // ---- Notifikasi dari Midtrans ----
  if (body.signature_key) {
    const expect = await sha('SHA-512', `${body.order_id}${body.status_code}${body.gross_amount}${SERVER_KEY}`);
    // Tanda tangan salah / pesanan bukan dari kita (misalnya tombol "Test notification" di dashboard):
    // dijawab OK tapi nggak ngapa-ngapain
    if (expect !== body.signature_key) return json({ ok: true, ignored: 'signature' });
    const { data: o } = await db.from('orders').select('amount').eq('id', String(body.order_id)).maybeSingle();
    if (!o) return json({ ok: true, ignored: 'unknown order' });
    // Jangan percaya isi notifikasi mentah-mentah: tanya ulang status aslinya ke Midtrans
    const st = await fetch(`${API}/${encodeURIComponent(body.order_id)}/status`, { headers: { Authorization: auth(), Accept: 'application/json' } }).then((r) => r.json()).catch(() => null);
    if (!st?.transaction_status) return json({ ok: false }, 502); // Midtrans bakal kirim ulang nanti
    const ts = st.transaction_status, paid = (ts === 'settlement' || (ts === 'capture' && st.fraud_status === 'accept')) && Math.round(Number(st.gross_amount)) === o.amount;
    await db.from('orders').update({ pay_status: ts }).eq('id', st.order_id);
    if (paid) await fulfill(st.order_id);
    else if (['expire', 'cancel', 'deny', 'failure'].includes(ts)) await db.from('orders').update({ status: 'failed' }).eq('id', st.order_id).eq('status', 'pending');
    return json({ ok: true });
  }

  // ---- Upgrade ke Premium dari CMS (harus login) ----
  if (body.action === 'upgrade') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: 'Login CMS dulu ya' }, 401);
    const { data: c } = await db.from('couples').select('id, slug, plan').eq('owner', user.id).maybeSingle();
    if (!c) return json({ error: 'Game-mu nggak ketemu' }, 404);
    if (c.plan === 'custom') return json({ error: 'Game-mu udah Premium 💖' }, 400);
    const id = `LQU-${wib()}-${rand(6)}`, secret = rand(32);
    const { error } = await db.from('orders').insert({ id, plan: 'upgrade', amount: PLANS.upgrade.amount, email: user.email, token_hash: await sha('SHA-256', secret), couple_id: c.id, slug: c.slug });
    if (error) return json({ error: 'Gagal nyimpen pesanan upgrade' }, 500);
    const res = await fetch(SNAP, {
      method: 'POST',
      headers: { Authorization: auth(), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: id, gross_amount: PLANS.upgrade.amount },
        item_details: [{ id: 'upgrade', price: PLANS.upgrade.amount, quantity: 1, name: PLANS.upgrade.name }],
        customer_details: { email: user.email },
        callbacks: { finish: `${SITE}/admin?upgrade=${id}` },
        expiry: { unit: 'hours', duration: 24 },
      }),
    });
    const snap = await res.json().catch(() => ({}));
    if (!res.ok || !snap.redirect_url) return json({ error: 'Midtrans lagi nggak bisa dihubungi, coba sebentar lagi ya' }, 502);
    return json({ ok: true, order_id: id, redirect_url: snap.redirect_url });
  }

  // ---- CMS ngecek pesanan upgrade-nya (nggak cuma nunggu notifikasi Midtrans) ----
  if (body.action === 'upgrade_check') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: 'Login CMS dulu ya' }, 401);
    const { data: c } = await db.from('couples').select('id, plan').eq('owner', user.id).maybeSingle();
    if (!c) return json({ error: 'Game-mu nggak ketemu' }, 404);
    const { data: o } = await db.from('orders').select('id, amount, status').eq('id', String(body.order_id || '')).eq('couple_id', c.id).eq('plan', 'upgrade').maybeSingle();
    if (o && o.status === 'pending') {
      const st = await fetch(`${API}/${encodeURIComponent(o.id)}/status`, { headers: { Authorization: auth(), Accept: 'application/json' } }).then((r) => r.json()).catch(() => null);
      const ts = st?.transaction_status;
      if ((ts === 'settlement' || (ts === 'capture' && st.fraud_status === 'accept')) && Math.round(Number(st.gross_amount)) === o.amount) await fulfill(o.id);
      else if (['expire', 'cancel', 'deny', 'failure'].includes(ts)) await db.from('orders').update({ status: 'failed', pay_status: ts }).eq('id', o.id);
    }
    const { data: now } = await db.from('couples').select('plan').eq('id', c.id).single();
    const { data: ord } = o ? await db.from('orders').select('status').eq('id', o.id).single() : { data: null };
    return json({ ok: true, plan: now.plan, status: ord?.status || null });
  }

  // ---- Pembeli bikin pesanan ----
  if (body.action === 'create') {
    const plan = body.plan === 'custom' ? 'custom' : 'basic';
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 120) return json({ error: 'Email-nya belum bener' }, 400);
    const names = { pasangan: String(body.names?.pasangan || '').trim().slice(0, 40), pengirim: String(body.names?.pengirim || '').trim().slice(0, 40) };
    const id = `LQ-${wib()}-${rand(6)}`, secret = rand(32);
    const { error } = await db.from('orders').insert({ id, plan, amount: PLANS[plan].amount, email, names, token_hash: await sha('SHA-256', secret) });
    if (error) return json({ error: 'Gagal nyimpen pesanan, coba lagi ya' }, 500);
    const res = await fetch(SNAP, {
      method: 'POST',
      headers: { Authorization: auth(), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: id, gross_amount: PLANS[plan].amount },
        item_details: [{ id: plan, price: PLANS[plan].amount, quantity: 1, name: PLANS[plan].name }],
        customer_details: { email, first_name: names.pengirim || undefined },
        callbacks: { finish: `${SITE}/bayar?order=${id}` },
        expiry: { unit: 'hours', duration: 24 },
      }),
    });
    const snap = await res.json().catch(() => ({}));
    if (!res.ok || !snap.redirect_url) return json({ error: 'Midtrans lagi nggak bisa dihubungi, coba sebentar lagi ya' }, 502);
    return json({ ok: true, order_id: id, secret, redirect_url: snap.redirect_url });
  }

  if (body.action === 'status' || body.action === 'claim') {
    const o = await checkOwner(String(body.order_id || ''), String(body.secret || ''));
    if (!o) return json({ error: 'Pesanan nggak ketemu' }, 404);
    // Notifikasi Midtrans telat/nggak nyampe? Cek sendiri statusnya
    if (o.status === 'pending') {
      const st = await fetch(`${API}/${encodeURIComponent(o.id)}/status`, { headers: { Authorization: auth(), Accept: 'application/json' } }).then((r) => r.json()).catch(() => null);
      const ts = st?.transaction_status;
      if ((ts === 'settlement' || (ts === 'capture' && st.fraud_status === 'accept')) && Math.round(Number(st.gross_amount)) === o.amount) await fulfill(o.id);
      else if (['expire', 'cancel', 'deny', 'failure'].includes(ts)) await db.from('orders').update({ status: 'failed', pay_status: ts }).eq('id', o.id);
    }
    const { data: cur } = await db.from('orders').select('status, slug, couple_id, email, plan, claimed').eq('id', o.id).single();
    if (body.action === 'status' || cur.status !== 'paid') return json({ ok: true, status: cur.status, plan: cur.plan });
    // claim: password baru tiap diambil (yang lama otomatis nggak berlaku)
    const { data: c } = await db.from('couples').select('owner').eq('id', cur.couple_id).single();
    const password = rand(10);
    const { error } = await db.auth.admin.updateUserById(c.owner, { password });
    if (error) return json({ error: 'Gagal nyiapin password, hubungi admin ya' }, 500);
    await db.from('orders').update({ claimed: (cur.claimed || 0) + 1 }).eq('id', o.id);
    return json({ ok: true, status: 'paid', plan: cur.plan, email: cur.email, password, slug: cur.slug, cms: `${SITE}/admin`, game: `${SITE}/c/${cur.slug}` });
  }

  return json({ error: 'Aksi nggak dikenal' }, 400);
});
