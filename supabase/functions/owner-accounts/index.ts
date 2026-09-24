// Edge function "owner-accounts" (Love Quest): owner bikin & kelola akun pembeli dari halaman /owner.
// Cuma bisa dipanggil akun yang ada di tabel admins (dicek di sini pakai token login-nya).
//   { action: "create", email, password, plan, days, names?, note? } → bikin akun + game-nya
//   { action: "password", couple_id, password }                      → ganti password pembeli
//   { action: "delete", couple_id }                                  → hapus akun, game, streak & fotonya
// Nggak butuh secret tambahan: SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY sudah otomatis ada.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
function addDays(n: number) {
  const d = new Date(`${fmt.format(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function randomSlug() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function isAdmin(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return false;
  const { data } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return Boolean(data);
}

async function ownerOf(coupleId: string) {
  const { data } = await db.from('couples').select('owner').eq('id', coupleId).maybeSingle();
  return data?.owner as string | undefined;
}

// Hapus semua foto di folder <id user>/ (bucket photos)
async function removePhotos(userId: string) {
  const { data } = await db.storage.from('photos').list(userId, { limit: 1000 });
  const paths = (data || []).map((f) => `${userId}/${f.name}`);
  if (paths.length) await db.storage.from('photos').remove(paths);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST saja' }, 405);
  if (!(await isAdmin(req))) return json({ error: 'Bukan admin' }, 403);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Body harus JSON' }, 400); }

  if (body.action === 'create') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const plan = body.plan === 'custom' ? 'custom' : 'basic';
    const days = Math.max(0, Math.min(3660, Number(body.days) || 0));
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Email nggak valid' }, 400);
    if (password.length < 6) return json({ error: 'Password minimal 6 karakter' }, 400);

    const { data: created, error: userErr } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (userErr || !created.user) {
      const taken = /already|registered|exists/i.test(userErr?.message || '');
      return json({ error: taken ? 'Email ini sudah punya akun' : `Gagal bikin akun: ${userErr?.message}` }, 400);
    }
    const userId = created.user.id;
    const names = {
      pasangan: String(body.names?.pasangan || '').trim().slice(0, 40),
      pengirim: String(body.names?.pengirim || '').trim().slice(0, 40),
    };

    const { data: couple, error: insErr } = await db.from('couples')
      .insert({ owner: userId, slug: randomSlug(), content: { names } })
      .select('id, slug').single();
    if (insErr || !couple) {
      await db.auth.admin.deleteUser(userId); // jangan sisakan akun tanpa game
      return json({ error: `Gagal bikin game: ${insErr?.message}` }, 500);
    }
    // Trigger database selalu pasang paket default; atur paket & masa aktif sesuai pilihan owner
    const { error: updErr } = await db.from('couples').update({
      plan, paid_until: addDays(days), active: true, note: String(body.note || '').trim() || null, owner_email: email,
    }).eq('id', couple.id);
    if (updErr) return json({ error: `Akun jadi, tapi paket gagal diatur: ${updErr.message}` }, 500);
    return json({ ok: true, id: couple.id, slug: couple.slug, email, paid_until: addDays(days), plan });
  }

  if (body.action === 'password') {
    const password = String(body.password || '');
    if (password.length < 6) return json({ error: 'Password minimal 6 karakter' }, 400);
    const owner = await ownerOf(String(body.couple_id || ''));
    if (!owner) return json({ error: 'Game nggak ketemu' }, 404);
    const { error } = await db.auth.admin.updateUserById(owner, { password });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (body.action === 'delete') {
    const owner = await ownerOf(String(body.couple_id || ''));
    if (!owner) return json({ error: 'Game nggak ketemu' }, 404);
    // Akun admin/owner nggak boleh kehapus dari sini
    const { data: adminRow } = await db.from('admins').select('user_id').eq('user_id', owner).maybeSingle();
    if (adminRow) return json({ error: 'Ini akun owner/admin, nggak bisa dihapus dari sini' }, 400);
    await removePhotos(owner).catch(() => {});
    // Akun dihapus → game, streak & langganan notifikasinya ikut terhapus (on delete cascade)
    const { error } = await db.auth.admin.deleteUser(owner);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'Aksi nggak dikenal' }, 400);
});
