// Manifest PWA per pasangan: /c/<kode>/manifest.webmanifest (lihat vercel.json).
// Kalau paket Premium & logo aplikasi sudah diupload, ikon di home screen pakai foto itu.
const SUPABASE_URL = 'https://paymeqnshhmjqypergji.supabase.co';
const ANON_KEY = 'sb_publishable_pDiStBz1jEdLO9q3AOB3Bw_RfeZP57y'; // publishable key (sama dengan js/config.js)

const DEFAULT_ICONS = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

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

module.exports = async (req, res) => {
  const slug = String(req.query.slug || '');
  if (!/^[a-z0-9]{10,32}$/.test(slug)) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const content = await loadContent(slug);
  const icon = content?.photos?.icon;
  const pasangan = content?.names?.pasangan;
  const icons = icon
    ? [
      { src: icon, sizes: '512x512', type: 'image/jpeg', purpose: 'any' },
      { src: icon, sizes: '512x512', type: 'image/jpeg', purpose: 'maskable' },
    ]
    : DEFAULT_ICONS;
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(JSON.stringify({
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
  }));
};
