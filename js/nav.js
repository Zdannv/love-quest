// Bar menu bawah (kayak aplikasi): Beranda · Deep Talk · [Main] · Peliharaan · Kotak Kita.
// Barnya nggak ngatur layar sendiri: tiap tab cuma "mencet" tombol yang udah ada di beranda,
// jadi semua aturan lama (keluar lobby, simpan peliharaan, dll) tetap jalan.
const TABS = [
  { id: 'home', icon: '🏠', label: 'Beranda', screens: ['home'] },
  { id: 'talk', icon: '💬', label: 'Deep Talk', btn: '#btn-talk', screens: ['talk'] },
  { id: 'play', icon: '🎮', label: 'Main', btn: '#btn-play', screens: ['map', 'online'], main: true },
  { id: 'pet', icon: '🐾', label: 'Peliharaan', btn: '#btn-pet', screens: ['pet'] },
  { id: 'kita', icon: '📮', label: 'Kotak Kita', btn: '#btn-kita', screens: [] },
];
const SHOW_ON = ['home', 'talk', 'map', 'online', 'pet'];

export function setupNav() {
  const tabs = TABS.filter((t) => !t.btn || document.querySelector(t.btn));
  const bar = document.createElement('nav');
  bar.className = 'tabbar';
  bar.setAttribute('aria-label', 'Menu utama');
  bar.innerHTML = tabs.map((t) => `<button type="button" class="tab${t.main ? ' tab-main' : ''}" data-tab="${t.id}"><span class="tab-ic">${t.icon}</span><span class="tab-lb">${t.label}</span></button>`).join('');
  document.body.appendChild(bar);

  const active = () => document.querySelector('.screen.active')?.id.replace('screen-', '') || 'home';
  const goHome = () => { if (active() !== 'home') document.querySelector('.screen.active [data-go="home"]')?.click(); };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    const t = tabs.find((x) => x.id === b.dataset.tab);
    if (t.screens.includes(active()) && t.id !== 'play') return;
    goHome();
    if (t.btn) document.querySelector(t.btn)?.click();
  });

  // titik merah Kotak Kita ikut badge yang di beranda
  const badge = document.querySelector('#kita-badge');
  function sync() {
    const scr = active();
    const on = SHOW_ON.includes(scr) && !document.body.classList.contains('is-demo') && !document.body.classList.contains('booting');
    bar.classList.toggle('show', on);
    document.body.classList.toggle('has-tabbar', on);
    bar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', tabs.find((t) => t.id === b.dataset.tab).screens.includes(scr)));
    const kb = bar.querySelector('[data-tab="kita"]');
    if (kb && badge) kb.classList.toggle('dot', !badge.hidden);
  }
  const mo = new MutationObserver(sync);
  document.querySelectorAll('.screen').forEach((s) => mo.observe(s, { attributes: true, attributeFilter: ['class'] }));
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (badge) mo.observe(badge, { attributes: true, attributeFilter: ['hidden'] });
  sync();
}
