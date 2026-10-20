// Bar menu bawah (kayak aplikasi): Beranda · Deep Talk · [Main] · Peliharaan · Kotak Kita.
// Barnya nggak ngatur layar sendiri: tiap tab cuma "mencet" tombol yang udah ada di beranda,
// jadi semua aturan lama (keluar lobby, simpan peliharaan, dll) tetap jalan.
// Ikon menu: SVG dua warna (garis + isian tipis), pas aktif isiannya penuh
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICON = {
  home: svg('<path class="f" d="M3.5 10.6 12 3.8l8.5 6.8V19a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path class="k" d="M12 17.6s-3-1.8-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6z"/>'),
  talk: svg('<path class="f" d="M6 4.5h10.5a3.5 3.5 0 0 1 3.5 3.5v5a3.5 3.5 0 0 1-3.5 3.5H12l-4.5 3.8v-3.8H6A3.5 3.5 0 0 1 2.5 13V8A3.5 3.5 0 0 1 6 4.5z"/><path class="k" d="M7.8 10.5h.01M11.3 10.5h.01M14.8 10.5h.01" stroke-width="2.8"/>'),
  play: svg('<path class="f" d="M7.2 7.5h9.6a5 5 0 0 1 4.9 5.9l-.6 3.3a2.6 2.6 0 0 1-4.6 1.1L15 16h-6l-1.5 1.8a2.6 2.6 0 0 1-4.6-1.1l-.6-3.3a5 5 0 0 1 4.9-5.9z"/><path class="k" d="M8 10.3v3.4M6.3 12h3.4"/><path class="k" d="M15.6 11h.01M17.6 13h.01" stroke-width="2.8"/>'),
  pet: svg('<path class="f" d="M12 12.2c2.6 0 5.2 2.7 5.2 5a2.6 2.6 0 0 1-3.2 2.5c-.8-.2-1.3-.5-2-.5s-1.2.3-2 .5a2.6 2.6 0 0 1-3.2-2.5c0-2.3 2.6-5 5.2-5z"/><ellipse class="f" cx="5.4" cy="10.6" rx="1.8" ry="2.3"/><ellipse class="f" cx="9.2" cy="6.1" rx="1.9" ry="2.4"/><ellipse class="f" cx="14.8" cy="6.1" rx="1.9" ry="2.4"/><ellipse class="f" cx="18.6" cy="10.6" rx="1.8" ry="2.3"/>'),
  kita: svg('<rect class="f" x="3" y="5.5" width="18" height="14" rx="3"/><path class="k" d="m4 7.5 8 6 8-6"/>'),
  memo: svg('<path class="f" d="M7 4h10v5.5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a2.5 3 0 0 0 2.8 4.3M17 6h2.5a2.5 3 0 0 1-2.8 4.3M12 14.5V18M8.5 20.5h7M9.5 18h5"/>'),
};
const TABS = [
  { id: 'home', icon: ICON.home, label: 'Beranda', screens: ['home'] },
  { id: 'talk', icon: ICON.talk, label: 'Deep Talk', btn: '#btn-talk', screens: ['talk'] },
  { id: 'play', icon: ICON.play, label: 'Main', btn: '#btn-play', screens: ['map', 'online'], main: true },
  { id: 'pet', icon: ICON.pet, label: 'Peliharaan', btn: '#btn-pet', screens: ['pet'] },
  { id: 'kita', icon: ICON.kita, label: 'Kotak Kita', btn: '#btn-kita', screens: [] },
  { id: 'memo', icon: ICON.memo, label: 'Kenangan', btn: '#btn-memo', screens: ['memo'] },
];
const SHOW_ON = ['home', 'talk', 'map', 'online', 'pet', 'memo'];

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
