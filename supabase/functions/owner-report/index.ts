// Edge function "owner-report" (Love Quest): laporan mingguan ke Telegram (dan email kalau RESEND_API_KEY diisi).
// Dipanggil pg_cron tiap Senin 07.00 WIB (lihat migration-13.sql), atau dari tombol "Kirim laporan sekarang" di /owner.
// Secret: CRON_SECRET (sama dengan streak-push), TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
//         opsional RESEND_API_KEY + REPORT_EMAIL (+ REPORT_FROM, default "Love Quest <laporan@lovequest.id>").
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const rp = (n: number) => `Rp${Number(n).toLocaleString('id-ID')}`;

async function allowed(req: Request) {
  if (req.headers.get('x-cron-secret') && req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')) return true;
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return false;
  const { data } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return Boolean(data);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await allowed(req))) return json({ error: 'Nggak boleh' }, 403);
  const since = new Date(Date.now() - 7 * 864e5).toISOString(), day = since.slice(0, 10);
  const { data: orders } = await db.from('orders').select('plan, amount, status, promo_code').gte('created_at', since);
  const paid = (orders || []).filter((o) => o.status === 'paid');
  const sum = paid.reduce((a, o) => a + (o.amount || 0), 0);
  const by = (p: string) => paid.filter((o) => o.plan === p).length;
  const promos: Record<string, number> = {};
  paid.filter((o) => o.promo_code).forEach((o) => (promos[o.promo_code] = (promos[o.promo_code] || 0) + 1));
  const help = (orders || []).filter((o) => o.status === 'need_help').length;
  const { data: ev } = await db.from('event_counts').select('name, n').gte('day', day);
  const e = (k: string) => (ev || []).filter((x) => x.name === k).reduce((a, x) => a + x.n, 0);
  const { count: total } = await db.from('couples').select('id', { count: 'exact', head: true });
  const text = [
    '📊 Laporan Love Quest 7 hari terakhir',
    '',
    `💰 Penjualan: ${paid.length} transaksi · ${rp(sum)}`,
    `   Love Quest ${by('basic')} · Premium ${by('custom')} · Upgrade ${by('upgrade')}`,
    Object.keys(promos).length ? `🏷️ Promo: ${Object.entries(promos).map(([k, v]) => `${k} ${v}x`).join(', ')}` : '🏷️ Promo: belum ada yang dipakai',
    help ? `⚠️ ${help} pesanan perlu dibantu (cek /owner)` : '✅ Nggak ada pesanan yang nyangkut',
    '',
    `👀 Buka landing ${e('landing_view')} → coba main ${e('try_click')} → buka halaman bayar ${e('bayar_view')} → klik bayar ${e('bayar_submit')} → lunas ${e('bayar_paid')}`,
    `🎮 Game pasangan dibuka: ${e('game_open')}`,
    `👥 Total game: ${total ?? '-'}`,
  ].join('\n');
  const out: string[] = [];
  const tok = Deno.env.get('TELEGRAM_BOT_TOKEN'), chat = Deno.env.get('TELEGRAM_CHAT_ID');
  if (tok && chat) {
    const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) });
    out.push(r.ok ? 'telegram' : `telegram gagal ${r.status}`);
  }
  const key = Deno.env.get('RESEND_API_KEY'), to = Deno.env.get('REPORT_EMAIL');
  if (key && to) {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('REPORT_FROM') || 'Love Quest <laporan@lovequest.id>', to: [to], subject: `Laporan Love Quest: ${paid.length} penjualan, ${rp(sum)}`, text }) });
    out.push(r.ok ? 'email' : `email gagal ${r.status}`);
  }
  return json({ ok: true, sent: out, text });
});
