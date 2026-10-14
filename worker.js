// Cloudflare Worker: game pasangan /c/<kode> (halaman sama dengan demo) + manifest PWA per pasangan.
// Paket Premium + logo diupload → ikon aplikasi pakai foto itu. File lain langsung dari assets.
const SUPABASE_URL = 'https://paymeqnshhmjqypergji.supabase.co';
const ANON_KEY = 'sb_publishable_pDiStBz1jEdLO9q3AOB3Bw_RfeZP57y'; // publishable key (sama dengan js/config.js)

const DEFAULT_ICONS = [
  { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
  { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
  { src: '/icons/icon-maskable-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

const BOTS = /WhatsApp|facebookexternalhit|Facebot|Instagram|Twitterbot|TelegramBot|Slackbot|Discordbot|LinkedInBot|Line\/|Pinterest|Googlebot|bingbot/i;

async function loadContent(slug) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_couple`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.status === 'ok' ? data.content : null;
  } catch {
    return null;
  }
}

async function manifest(slug) {
  const content = await loadContent(slug);
  const icon = content?.photos?.icon;
  const pasangan = content?.names?.pasangan;
  const icons = icon
    ? [
      { src: icon, sizes: '512x512', type: 'image/jpeg', purpose: 'any' },
      { src: icon, sizes: '512x512', type: 'image/jpeg', purpose: 'maskable' },
    ]
    : DEFAULT_ICONS;
  return new Response(JSON.stringify({
    id: `/c/${slug}`,
    name: pasangan ? `Love Quest untuk ${pasangan}` : 'Love Quest',
    short_name: 'Love Quest',
    description: 'Game lucu penuh cinta, khusus buat kalian berdua.',
    start_url: `/c/${slug}`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffe4ef',
    theme_color: '#ffd6e7',
    lang: 'id',
    icons,
  }), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=0, s-maxage=300' },
  });
}

// Video: iPhone (Safari) cuma mau muter video kalau server bisa kirim sepotong-sepotong (Range → 206)
async function serveVideo(request, env) {
  const res = await env.ASSETS.fetch(new Request(request.url, { method: 'GET' }));
  if (!res.ok) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const head = request.method === 'HEAD';
  const base = { 'Content-Type': res.headers.get('Content-Type') || 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
  if (!m || (m[1] === '' && m[2] === '')) return new Response(head ? null : buf, { headers: { ...base, 'Content-Length': String(size) } });
  let start, end;
  if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(head ? null : buf.slice(start, end + 1), {
    status: 206,
    headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/video/')) return serveVideo(request, env);
    const m = url.pathname.match(/^\/c\/([a-z0-9]{10,32})(\/manifest\.webmanifest|\/?)$/);
    if (m && m[2] === '/manifest.webmanifest') return manifest(m[1]);
    if (m) {
      const page = await env.ASSETS.fetch(new Request(new URL('/', url), request)); // game pasangan = index.html
      // Pas link dibagi di WhatsApp/IG/Telegram: preview-nya "Ada kado buat <nama>" (cuma buat bot pembuat preview,
      // pengunjung biasa langsung dapet halamannya tanpa nunggu database)
      if (!BOTS.test(request.headers.get('User-Agent') || '')) return page;
      const content = await loadContent(m[1]);
      const n = content?.names || {};
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      const title = esc(n.pasangan ? `Ada kado buat ${n.pasangan} 🎁` : 'Ada kado buat kamu 🎁');
      const desc = esc(`${n.pengirim || 'Seseorang yang sayang kamu'} bikinin game kecil khusus buat kamu. Buka yuk 💌`);
      const set = (sel, attr, val) => [sel, { element(e) { e.setAttribute(attr, val); } }];
      let rw = new HTMLRewriter();
      for (const [sel, h] of [
        set('meta[property="og:title"]', 'content', title), set('meta[property="og:description"]', 'content', desc),
        set('meta[name="description"]', 'content', desc), set('meta[property="og:image"]', 'content', 'https://lovequest.id/img/og/kado.jpg'),
        set('meta[property="og:url"]', 'content', `https://lovequest.id/c/${m[1]}`),
      ]) rw = rw.on(sel, h);
      rw = rw.on('title', { element(e) { e.setInnerContent(title); } });
      return rw.transform(page);
    }
    return env.ASSETS.fetch(request);
  },
};
