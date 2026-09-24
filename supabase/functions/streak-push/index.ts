// Edge function "streak-push" (Love Quest): notifikasi streak untuk SEMUA pasangan.
//   { type: "reminder" }                        → dipanggil cron jam 19.00 WIB (butuh header x-cron-secret)
//   { type: "played", slug: "…", player: "…" }  → dipanggil game setelah salah satu main
// Secrets yang dibutuhkan: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type Player = 'pasangan' | 'pengirim';
const PLAYERS: Player[] = ['pasangan', 'pengirim'];
const other = (p: Player): Player => (p === 'pasangan' ? 'pengirim' : 'pasangan');
const DEFAULT_NAME: Record<Player, string> = { pasangan: 'Ayang', pengirim: 'Aku' };
const EMOJI: Record<string, string> = {
  owl: '🦉', cat: '🐱', dog: '🐶', rabbit: '🐰', bear: '🐻', panda: '🐼', penguin: '🐧',
  fox: '🦊', hamster: '🐹', frog: '🐸', unicorn: '🦄', koala: '🐨', chick: '🐥', tiger: '🐯',
};
const DEFAULT_CHAR: Record<Player, string> = { pasangan: 'owl', pengirim: 'cat' };

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
const shiftDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Couple = { id: string; slug: string; plan: string; content: Record<string, any> };

function people(c: Couple) {
  const names = c.content?.names ?? {};
  const chars = c.plan === 'custom' ? (c.content?.characters ?? {}) : {};
  const info = (p: Player) => ({
    name: String(names[p] || '').trim() || DEFAULT_NAME[p],
    emoji: EMOJI[chars[p]] ?? EMOJI[DEFAULT_CHAR[p]],
  });
  return { pasangan: info('pasangan'), pengirim: info('pengirim') };
}

// Aturan streak sama seperti di game
async function streakInfo(coupleId: string) {
  const today = fmt.format(new Date());
  const { data, error } = await db.from('plays').select('player, day').eq('couple_id', coupleId).gte('day', shiftDay(today, -120));
  if (error) throw error;
  const byDay = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    if (!byDay.has(r.day)) byDay.set(r.day, new Set());
    byDay.get(r.day)!.add(r.player);
  }
  const both = (d: string) => PLAYERS.every((p) => byDay.get(d)?.has(p));
  let count = 0;
  let d = both(today) ? today : shiftDay(today, -1);
  while (both(d)) { count++; d = shiftDay(d, -1); }
  return { today, count, lit: both(today), played: (p: Player) => !!byDay.get(today)?.has(p) };
}

// Tiap jenis notif cuma sekali per hari per pasangan
async function once(coupleId: string, day: string, kind: string, player: string) {
  const { error } = await db.from('notify_log').insert({ couple_id: coupleId, day, kind, player });
  return !error;
}

async function sendTo(c: Couple, player: Player, payload: Record<string, unknown>) {
  const { data } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('couple_id', c.id).eq('player', player);
  const body = JSON.stringify({ url: `/c/${c.slug}`, ...payload });
  await Promise.all((data ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }));
}

async function activeCouples(filter?: { slug?: string; ids?: string[] }) {
  const today = fmt.format(new Date());
  let q = db.from('couples').select('id, slug, plan, content').eq('active', true).gte('paid_until', today);
  if (filter?.slug) q = q.eq('slug', filter.slug);
  if (filter?.ids) q = q.in('id', filter.ids);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Couple[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => ({}));

  if (body.type === 'reminder') {
    if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'unauthorized' }, 401);
    // Cuma pasangan yang ada HP terdaftar notifikasi
    const { data: subs } = await db.from('push_subscriptions').select('couple_id');
    const ids = [...new Set((subs ?? []).map((s) => s.couple_id))];
    if (!ids.length) return json({ ok: true, sent: 0 });
    let sent = 0;
    for (const c of await activeCouples({ ids })) {
      const info = await streakInfo(c.id);
      const who = people(c);
      for (const p of PLAYERS) {
        if (info.played(p) || !(await once(c.id, info.today, 'reminder', p))) continue;
        const o = other(p);
        const text = info.played(o)
          ? `${who[o].name} udah main, tinggal kamu! ${info.count ? `Streak ${info.count} hari jangan sampe putus 🥺` : 'Yuk nyalain streaknya 🔥'}`
          : info.count
            ? `Kalian berdua belum main hari ini, streak ${info.count} hari bisa putus 🥺`
            : `Yuk main bentar, nyalain streak bareng ${who[o].name} 🔥`;
        await sendTo(c, p, { title: '🔥 Jangan lupa main hari ini!', body: text, tag: 'reminder' });
        sent++;
      }
    }
    return json({ ok: true, sent });
  }

  if (body.type === 'played' && typeof body.slug === 'string' && PLAYERS.includes(body.player)) {
    const [c] = await activeCouples({ slug: body.slug });
    if (!c) return json({ error: 'game nggak aktif' }, 404);
    const p = body.player as Player;
    const o = other(p);
    const info = await streakInfo(c.id);
    if (!info.played(p)) return json({ error: 'belum main hari ini' }, 400);
    const who = people(c);
    if (info.lit) {
      if (await once(c.id, info.today, 'lit', 'both')) {
        await sendTo(c, o, {
          title: `🔥 Streak nyala! ${info.count} hari`,
          body: `${who[p].name} barusan main, streak kalian nyala lagi hari ini 💖`,
          tag: 'lit', badge: info.count,
        });
      }
    } else if (await once(c.id, info.today, 'played', p)) {
      await sendTo(c, o, {
        title: `${who[p].emoji} ${who[p].name} baru aja main!`,
        body: `Sekarang giliran kamu biar streak${info.count ? ` ${info.count} hari` : ''} nyala 🔥`,
        tag: 'played',
      });
    }
    return json({ ok: true });
  }

  return json({ error: 'bad request' }, 400);
});
