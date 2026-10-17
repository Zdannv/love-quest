// 🐥 Peliharaan Kita (ala Pou / Tamagotchi): satu peliharaan bareng, dirawat berdua dari HP masing-masing.
// Status (kenyang/bersih/senang/energi) turun pelan sesuai waktu nyata. Tiap rawat dapet XP → naik level → buka aksesoris.
// Kalau dua-duanya ngerawat di hari yang sama: bonus XP "kompak".
// Disimpen di Supabase per pasangan (supabase/migration-7.sql). Demo & contoh: disimpen di HP ini aja.
import { CONFIG } from './config.js';
import { whoAmI } from './profile.js';
import { getNames } from './personal.js';
import { esc } from './util.js';
import { createPet3D } from './pet3d.js';
import { setPet } from './stats.js';

const { url = '', anonKey = '' } = CONFIG.cloud || {};
const SIM = CONFIG.demo || Boolean(CONFIG.showcase);
const LOCAL = `lq-pet-${CONFIG.slug || CONFIG.showcase || 'demo'}`;
const FOODS = [
  { em: '🍎', name: 'Apel', h: 12 }, { em: '🍙', name: 'Onigiri', h: 20 },
  { em: '🍗', name: 'Ayam', h: 28 }, { em: '🍭', name: 'Permen', h: 8, f: 10 },
];
// Pilihan hewan: model 3D (img/pets/animal-<m>.glb, Kenney Cube Pets) + gambar kecil buat menu pilih (img/pets/thumb/<m>.webp)
const ANIMALS = [
  { k: 'ayam', m: 'chick', em: '🐥', label: 'Anak Ayam', name: 'Mochi' }, { k: 'kucing', m: 'cat', em: '🐱', label: 'Kucing', name: 'Oyen' },
  { k: 'anjing', m: 'dog', em: '🐶', label: 'Anjing', name: 'Choco' }, { k: 'kelinci', m: 'bunny', em: '🐰', label: 'Kelinci', name: 'Bunny' },
  { k: 'panda', m: 'panda', em: '🐼', label: 'Panda', name: 'Bambu' }, { k: 'pinguin', m: 'penguin', em: '🐧', label: 'Pinguin', name: 'Pingu' },
  { k: 'rubah', m: 'fox', em: '🦊', label: 'Rubah', name: 'Rubi' }, { k: 'koala', m: 'koala', em: '🐨', label: 'Koala', name: 'Kolo' },
  { k: 'babi', m: 'pig', em: '🐷', label: 'Babi', name: 'Pinky' }, { k: 'harimau', m: 'tiger', em: '🐯', label: 'Harimau', name: 'Belang' },
  { k: 'singa', m: 'lion', em: '🦁', label: 'Singa', name: 'Leo' }, { k: 'beruang', m: 'polar', em: '🐻', label: 'Beruang Kutub', name: 'Salju' },
  { k: 'monyet', m: 'monkey', em: '🐵', label: 'Monyet', name: 'Momo' }, { k: 'gajah', m: 'elephant', em: '🐘', label: 'Gajah', name: 'Dumbo' },
  { k: 'rusa', m: 'deer', em: '🦌', label: 'Rusa', name: 'Rudi' }, { k: 'landak', m: 'hog', em: '🦔', label: 'Landak', name: 'Duri' },
];
const animalOf = (s) => ANIMALS.find((a) => a.k === s.kind);
const OUTFITS = [{ lvl: 2, em: '🎀' }, { lvl: 3, em: '🧢' }, { lvl: 4, em: '🕶️' }, { lvl: 5, em: '🎩' }, { lvl: 7, em: '👑' }];
const ACT = { makan: 'kasih makan', mandi: 'mandiin', main: 'ngajak main', tidur: 'nidurin', bangun: 'bangunin' };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const clamp = (v) => Math.max(0, Math.min(100, v));
const levelOf = (xp) => 1 + Math.floor(Math.sqrt(xp / 30));
const xpAt = (l) => (l - 1) * (l - 1) * 30;

const fresh = () => ({ kind: null, name: 'Mochi', xp: 0, hunger: 70, clean: 70, fun: 70, energy: 80, sleep: false, at: Date.now(), log: [], daily: { d: today(), pasangan: false, pengirim: false, bonus: false }, outfit: null });
function decay(s, now = Date.now()) {
  const h = Math.max(0, (now - (s.at || now)) / 3.6e6);
  s.hunger = clamp(s.hunger - 4 * h); s.clean = clamp(s.clean - 2.5 * h); s.fun = clamp(s.fun - 3.5 * h);
  s.energy = clamp(s.energy + (s.sleep ? 14 : -2) * h);
  if (s.sleep && s.energy >= 100) s.sleep = false; // bangun sendiri kalau udah seger
  s.at = now;
  if (s.daily?.d !== today()) s.daily = { d: today(), pasangan: false, pengirim: false, bonus: false };
  return s;
}
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'barusan' : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`; };

async function rpc(name, body) {
  if (SIM || !url || !CONFIG.slug) throw new Error('lokal');
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_slug: CONFIG.slug, ...body }) });
  if (!res.ok) throw new Error(`pet ${res.status}`);
  return res.status === 204 ? null : res.json();
}
let local = false;
async function load() {
  const s = await loadRaw();
  if (s?.kind) setPet({ name: s.name, kind: s.kind, m: animalOf(s)?.m, lvl: levelOf(s.xp || 0) });
  return s;
}
async function loadRaw() {
  if (!local) {
    try { const s = await rpc('pet_get', {}); return decay(s || fresh()); } catch { local = true; }
  }
  try { return decay(JSON.parse(localStorage.getItem(LOCAL)) || fresh()); } catch { return fresh(); }
}
async function save(s) {
  try { localStorage.setItem(LOCAL, JSON.stringify(s)); } catch {}
  if (s?.kind) setPet({ name: s.name, kind: s.kind, m: animalOf(s)?.m, lvl: levelOf(s.xp || 0) });
  if (!local) { try { await rpc('pet_save', { p_state: s }); } catch { local = true; } }
}

export function initPet({ sfx, toast }) {
  const root = document.querySelector('#pet-root');
  let st = null, busy = false, poll = 0, mode = null, raf = 0;

  // Ambil data terbaru → ubah → simpan (biar perawatan dari HP pasangan nggak ketimpa)
  async function act(kind, apply) {
    if (busy) return;
    busy = true;
    try {
      const s = await load();
      const who = whoAmI() || 'pasangan';
      const msg = apply(s, who);
      if (msg === false) { st = s; render(); return; }
      const before = levelOf(s.xp);
      let bonus = '';
      if (ACT[kind]) { // ganti nama / aksesoris nggak diitung ngerawat
        s.daily[who] = true;
        if (s.daily.pasangan && s.daily.pengirim && !s.daily.bonus) { s.daily.bonus = true; s.xp += 30; bonus = ' · Kalian kompak hari ini! +30 XP 💞'; }
        s.log = [{ w: who, a: kind, t: Date.now() }, ...(s.log || [])].slice(0, 6);
      }
      await save(s);
      st = s;
      if (levelOf(s.xp) > before) { sfx('win'); toast(`${s.name} naik ke level ${levelOf(s.xp)}! 🎉${OUTFITS.find((o) => o.lvl === levelOf(s.xp)) ? ' Ada aksesoris baru!' : ''}`); }
      else if (msg) toast(msg + bonus);
      render();
    } finally { busy = false; }
  }

  function mood(s) {
    if (s.sleep) return { em: '💤', t: 'Lagi bobo… sstt' };
    if (s.hunger < 30) return { em: '🍙', t: 'Laper… 🥺' };
    if (s.clean < 30) return { em: '🫧', t: 'Pengen mandi' };
    if (s.energy < 25) return { em: '💤', t: 'Ngantuk banget' };
    if (s.fun < 30) return { em: '⚽', t: 'Bosen, ajak main dong' };
    return { em: '💖', t: 'Seneng banget!' };
  }

  // Pilih hewan (pertama kali, atau pas mau ganti)
  let choosing = false;
  function renderChooser() {
    const cur = st?.kind;
    root.innerHTML = `
      <div class="pet-choose">
        <h2>${cur ? 'Ganti hewan peliharaan' : 'Pilih hewan peliharaan kalian'} 🐾</h2>
        <p>${cur ? 'Level & XP-nya tetap kebawa kok' : 'Nanti dirawat berdua, dikasih makan, dimandiin, diajak main 💞'}</p>
        <div class="pet-grid">${ANIMALS.map((a) => `<button data-pick="${a.k}" class="${cur === a.k ? 'on' : ''}"><img class="pet-thumb" src="/img/pets/thumb/${a.m}.webp" alt=""><b>${a.label}</b></button>`).join('')}</div>
        ${cur ? '<button class="link-btn" data-pick="batal">batal</button>' : ''}
      </div>`;
  }
  function render() {
    if (!st) { root.innerHTML = '<p class="pet-load">Nyiapin peliharaan… 🐾</p>'; return; }
    if (!st.kind || !animalOf(st) || choosing) { renderChooser(); return; }
    const s = st, lvl = levelOf(s.xp), m = mood(s), A = animalOf(s) || ANIMALS[0];
    const outfit = s.outfit && OUTFITS.find((o) => o.em === s.outfit && o.lvl <= lvl) ? s.outfit : null;
    // meteran bulat: makin penuh makin hijau, di bawah 30 jadi merah & kedip
    const bar = (em, label, v) => `<div class="pet-ring ${v < 30 ? 'low' : ''}" style="--v:${Math.round(v)};--c:${v < 30 ? '#ff4d6d' : v < 60 ? '#ffb020' : '#2fbf71'}"><span class="pr-ic">${em}</span><small>${label}</small><b>${Math.round(v)}</b></div>`;
    const last = s.log?.[0];
    root.innerHTML = `
      <div class="pet-head">
        <button class="pet-name" data-pet="rename">${esc(s.name)} ✏️</button>
        <span class="pet-lvl">Lv ${lvl}</span>
        <button class="pet-swap" data-pet="swap">${A.em} ganti hewan</button>
        <div class="pet-xp"><b style="width:${Math.round(((s.xp - xpAt(lvl)) / (xpAt(lvl + 1) - xpAt(lvl))) * 100)}%"></b></div>
      </div>
      <div class="pet-room ${s.sleep ? 'night' : ''}" id="pet-room">
        <div class="pet-decor" aria-hidden="true"><i class="pd-window"><u></u></i><i class="pd-frame">💞</i><i class="pd-shelf"><span>🪴</span><span>📚</span></i><i class="pd-bed">🧺</i><i class="pd-bowl">🥣</i><i class="pd-toy">🧸</i></div>
        <div class="pet-bubble">${m.em} ${m.t}</div>
        <div class="pet-3d-slot" id="pet-3d-slot">
          <div class="pet-body pet-fallback ${s.sleep ? 'sleep' : ''}" style="--sz:${Math.min(1.35, 0.85 + lvl * 0.06)}"><span class="pet-em">${A.em}</span></div>
        </div>
        ${outfit ? `<span class="pet-outfit3d" id="pet-outfit">${outfit}</span>` : ''}
        ${s.sleep ? '<span class="pet-zzz" id="pet-zzz">💤</span>' : ''}
        <div class="pet-floor"></div>
        <div class="pet-layer" id="pet-layer"></div>
      </div>
      <div class="pet-stats">${bar('🍙', 'Kenyang', s.hunger)}${bar('🫧', 'Bersih', s.clean)}${bar('⚽', 'Senang', s.fun)}${bar('⚡', 'Energi', s.energy)}</div>
      <div class="pet-actions">
        <button data-pet="makan" ${s.sleep ? 'disabled' : ''}><span>🍙</span>Makan</button>
        <button data-pet="mandi" ${s.sleep ? 'disabled' : ''}><span>🛁</span>Mandi</button>
        <button data-pet="main" ${s.sleep || s.energy < 10 ? 'disabled' : ''}><span>⚽</span>Main</button>
        <button data-pet="tidur"><span>${s.sleep ? '☀️' : '💤'}</span>${s.sleep ? 'Bangun' : 'Tidur'}</button>
      </div>
      <div class="pet-sec"><b>👗 Lemari</b><small>aksesoris kebuka tiap naik level</small></div>
      <div class="pet-outfits">${OUTFITS.map((o) => `<button data-pet="outfit" data-v="${o.em}" class="${s.outfit === o.em ? 'on' : ''}" ${o.lvl > lvl ? `disabled title="Buka di level ${o.lvl}"` : ''}>${o.lvl > lvl ? '🔒' : o.em}<small>Lv${o.lvl}</small></button>`).join('')}</div>
      <div class="pet-couple">
        <p>Hari ini: <b>${s.daily.pasangan ? '✅' : '⬜'} ${esc(getNames().pasangan)}</b> · <b>${s.daily.pengirim ? '✅' : '⬜'} ${esc(getNames().pengirim)}</b>${s.daily.bonus ? ' · <span>kompak +30 XP 💞</span>' : ' · rawat berdua buat bonus XP 💞'}</p>
        ${last ? `<small>${esc(getNames()[last.w] || '')} ${ACT[last.a] || last.a} ${esc(s.name)} · ${ago(last.t)}</small>` : ''}
        ${local && !SIM ? '<small class="pet-local">📱 Sementara disimpen di HP ini</small>' : ''}
      </div>`;
    mount3d(A, lvl, s.sleep);
  }

  // ---- Peliharaan 3D (kalau HP-nya nggak bisa 3D, tetap pakai ikon) ----
  let p3 = null, p3fail = false, p3wait = null, follow = 0, sadT = 0;
  async function ensure3d() {
    if (p3 || p3fail) return p3;
    p3wait ||= createPet3D().then((x) => { p3 = x; }).catch(() => { p3fail = true; });
    await p3wait;
    return p3;
  }
  async function mount3d(A, lvl, sleep) {
    const slot = root.querySelector('#pet-3d-slot');
    const P = await ensure3d();
    if (!P || !slot || !root.contains(slot)) return;
    slot.appendChild(P.el);
    P.setSize(Math.min(1.35, 0.85 + lvl * 0.06));
    P.setSleep(!!sleep);
    P.load(A.m).then(() => slot.classList.add('on')).catch(() => slot.classList.remove('on'));
    P.start();
  }
  // aksesoris & 💤 ngikutin kepala; sesekali sedih kalau lagi laper/kotor/bosen
  function followLoop() {
    follow = requestAnimationFrame(followLoop);
    if (!p3) return;
    const h = p3.headPos(); if (!h) return;
    const o = root.querySelector('#pet-outfit'), z = root.querySelector('#pet-zzz');
    if (o) o.style.transform = `translate(${h.x}px, ${h.y}px) translate(-50%, -78%)`;
    if (z) z.style.transform = `translate(${h.x + 30}px, ${h.y - 30}px)`;
    if (st && !st.sleep && !mode && (st.hunger < 30 || st.clean < 30 || st.fun < 30) && performance.now() - sadT > 9000) { sadT = performance.now(); p3.act('sad'); }
  }

  // ---- Mini: kasih makan (pilih makanan) ----
  function feed() {
    const layer = root.querySelector('#pet-layer');
    layer.innerHTML = `<div class="pet-picker">${FOODS.map((f, i) => `<button data-food="${i}">${f.em}<small>${f.name}</small></button>`).join('')}<button data-food="x" class="x">✖</button></div>`;
    mode = 'feed';
  }
  // ---- Mini: mandi (gosok pakai sabun sampai bersih) ----
  function bath() {
    const room = root.querySelector('#pet-room'), layer = root.querySelector('#pet-layer');
    layer.innerHTML = '<div class="pet-hint">Gosok-gosok pakai sabun 🧼 sampai bersih!</div><span class="pet-soap">🧼</span><div class="pet-prog"><b></b></div>';
    mode = 'bath';
    let rubbed = 0, lastPt = null;
    const soap = layer.querySelector('.pet-soap'), prog = layer.querySelector('.pet-prog b');
    const mv = (e) => {
      const r = room.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      soap.style.transform = `translate(${x - 20}px, ${y - 20}px)`;
      if (lastPt && e.buttons !== 0 || e.pointerType === 'touch') {
        if (lastPt) rubbed += Math.hypot(x - lastPt[0], y - lastPt[1]);
        if (Math.random() < 0.35) { const b = document.createElement('span'); b.className = 'pet-bub'; b.textContent = '🫧'; b.style.left = `${x + (Math.random() - 0.5) * 50}px`; b.style.top = `${y + (Math.random() - 0.5) * 40}px`; layer.append(b); setTimeout(() => b.remove(), 1200); }
      }
      lastPt = [x, y];
      prog.style.width = `${Math.min(100, rubbed / 14)}%`;
      if (rubbed > 1400 && mode === 'bath') { mode = null; cleanup(); sfx('win'); p3?.act('dance'); act('mandi', (s) => { s.clean = 100; s.fun = clamp(s.fun + 5); s.xp += 10; return `${s.name} wangi & bersih! ✨ +10 XP`; }); }
    };
    const down = (e) => { lastPt = null; room.setPointerCapture?.(e.pointerId); mv(e); };
    const up = () => { lastPt = null; };
    room.addEventListener('pointerdown', down); room.addEventListener('pointermove', mv); room.addEventListener('pointerup', up);
    cleanup = () => { room.removeEventListener('pointerdown', down); room.removeEventListener('pointermove', mv); room.removeEventListener('pointerup', up); };
  }
  // ---- Mini: main bola (tap bolanya, 12 detik) ----
  function play() {
    const room = root.querySelector('#pet-room'), layer = root.querySelector('#pet-layer');
    layer.innerHTML = '<div class="pet-hint">Tap bolanya sebanyak-banyaknya! <b id="pet-score">0</b> · <span id="pet-time">12</span></div><button class="pet-ball" id="pet-ball">⚽</button>';
    mode = 'play';
    p3?.act('run');
    const ball = layer.querySelector('#pet-ball'), r = room.getBoundingClientRect();
    let x = r.width / 2, y = r.height / 3, vx = 160, vy = -120, score = 0, t0 = performance.now(), last = t0;
    ball.addEventListener('pointerdown', (e) => { e.preventDefault(); score++; sfx('pop'); vy = -260 - Math.random() * 120; vx = (Math.random() - 0.5) * 420; layer.querySelector('#pet-score').textContent = score; });
    const tick = (now) => {
      if (mode !== 'play') return;
      const dt = Math.min(0.04, (now - last) / 1000); last = now;
      vy += 420 * dt; x += vx * dt; y += vy * dt;
      if (x < 24 || x > r.width - 24) { vx = -vx; x = Math.max(24, Math.min(r.width - 24, x)); }
      if (y > r.height - 40) { y = r.height - 40; vy = -Math.abs(vy) * 0.85 - 60; }
      if (y < 20) { y = 20; vy = Math.abs(vy); }
      ball.style.transform = `translate(${x - 26}px, ${y - 26}px)`;
      const left = 12 - (now - t0) / 1000;
      layer.querySelector('#pet-time').textContent = Math.max(0, Math.ceil(left));
      if (left <= 0) { mode = null; p3?.act('dance'); act('main', (s) => { s.fun = clamp(s.fun + 10 + score * 3); s.energy = clamp(s.energy - 8); s.xp += 4 + score; return `${s.name} seneng banget! Tap ${score}× ⚽ +${4 + score} XP`; }); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  let cleanup = () => {};

  root.addEventListener('pointerdown', (e) => {
    if (mode || !p3 || !st || st.sleep || !e.target.closest('#pet-room') || e.target.closest('button')) return;
    if (!p3.hit(e.clientX, e.clientY)) return;
    p3.act('happy'); sfx('pop');
    const room = root.querySelector('#pet-room'), r = room.getBoundingClientRect();
    for (let i = 0; i < 3; i++) { const b = document.createElement('span'); b.className = 'pet-bub'; b.textContent = '💖'; b.style.left = `${e.clientX - r.left + (Math.random() - 0.5) * 50}px`; b.style.top = `${e.clientY - r.top - 20 - Math.random() * 30}px`; room.append(b); setTimeout(() => b.remove(), 1200); }
  });
  root.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      sfx('click');
      if (pick.dataset.pick === 'batal') { choosing = false; render(); return; }
      const a = ANIMALS.find((x) => x.k === pick.dataset.pick);
      choosing = false;
      act('pilih', (s) => { const first = !s.kind; s.kind = a.k; if (first || !s.named) s.name = a.name; return first ? `Halo, ${s.name}! ${a.em} Rawat bareng yaa 💞` : `Sekarang peliharaan kalian ${a.label} ${a.em}`; });
      return;
    }
    const f = e.target.closest('[data-food]');
    if (f) {
      mode = null;
      if (f.dataset.food === 'x') { render(); return; }
      const food = FOODS[+f.dataset.food];
      sfx('good');
      if (st && st.hunger < 96) p3?.act('eat');
      act('makan', (s) => { if (s.hunger >= 96) { toast(`${s.name} udah kenyang 😋`); return false; } s.hunger = clamp(s.hunger + food.h); if (food.f) s.fun = clamp(s.fun + food.f); s.xp += 6; return `${s.name} makan ${food.em} nyam nyam! +6 XP`; });
      return;
    }
    const b = e.target.closest('[data-pet]');
    if (!b || busy) return;
    sfx('click');
    const k = b.dataset.pet;
    if (mode) { mode = null; cleanup(); cancelAnimationFrame(raf); render(); if (k !== 'tidur') return; }
    if (k === 'makan') feed();
    if (k === 'mandi') bath();
    if (k === 'main') play();
    if (k === 'tidur') act(st.sleep ? 'bangun' : 'tidur', (s) => { s.sleep = !s.sleep; s.xp += 3; return s.sleep ? `${s.name} bobo dulu 💤` : `${s.name} bangun! ☀️`; });
    if (k === 'outfit') act('outfit', (s) => { s.outfit = s.outfit === b.dataset.v ? null : b.dataset.v; return false; });
    if (k === 'rename') {
      const n = prompt('Kasih nama peliharaan kalian:', st.name);
      if (n && n.trim()) act('nama', (s) => { s.name = n.trim().slice(0, 16); s.named = true; return `Namanya sekarang ${s.name} 💕`; });
    }
    if (k === 'swap') { choosing = true; render(); }
  });

  return {
    async open() {
      ensure3d();
      cancelAnimationFrame(follow); followLoop();
      st = null; render();
      st = await load(); render();
      clearInterval(poll);
      poll = setInterval(async () => { if (mode || busy || choosing || document.hidden) return; st = await load(); render(); }, 20000);
    },
    close() { clearInterval(poll); mode = null; cleanup(); cancelAnimationFrame(raf); cancelAnimationFrame(follow); p3?.stop(); },
  };
}
