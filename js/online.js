// Main Berdua (online): dua HP nyambung lewat Supabase Realtime (broadcast + presence), tanpa database.
// Game pasangan otomatis masuk room berdua. Bisa juga pakai kode 4 angka buat main sama temen.
// Isinya: peta 30 level kerja sama (duo-levels.js) + game bebas (balapan, gantian, Deep Talk bareng).
import { CONFIG } from './config.js';
import { getNames, getFace, getChars } from './personal.js';
import { esc } from './util.js';
import { ONLINE_GAMES } from './online-games.js';
import { whoAmI, askProfile, forget } from './profile.js';
import { LEVEL_MAP } from './level-map.js';
import { DUO_LEVELS, DUO_NAMES, DUO_ICONS, duoStars, duoUnlocked, mergeDuo } from './duo-levels.js';

const $ = (s) => document.querySelector(s);
const ID_KEY = 'lq-online-id';
const WORLD_THEME = ['w-flower', 'w-candy', 'w-beach', 'w-night', 'w-home'];

const myId = (() => {
  try {
    let v = sessionStorage.getItem(ID_KEY); // per tab, biar 2 tab di 1 HP tetap dianggap 2 pemain
    if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem(ID_KEY, v); }
    return v;
  } catch { return Math.random().toString(36).slice(2, 10); }
})();

// Room pasangan cuma buat game asli (bukan demo / contoh), biar pengunjung demo nggak nyasar ke room yang sama
const coupleRoom = () => (!CONFIG.demo && !CONFIG.showcase && CONFIG.slug ? `c-${CONFIG.slug}` : null);

const net = { code: null, channel: null, peer: null, status: 'off', listeners: {} };

function emitLocal(type, data) { (net.listeners[type] || []).slice().forEach((fn) => fn(data)); }
export function on(type, fn) {
  (net.listeners[type] ||= []).push(fn);
  return () => { net.listeners[type] = (net.listeners[type] || []).filter((f) => f !== fn); };
}
export function send(type, data = {}) {
  net.channel?.send({ type: 'broadcast', event: 'm', payload: { t: type, from: myId, ...data } });
}

// ---------- Siapa aku ----------
export const myRole = () => whoAmI();
export const nameOf = (role) => getNames()[role] || (role === 'pasangan' ? 'Pemain 1' : 'Pemain 2');
export const me = () => ({ id: myId, role: myRole(), name: nameOf(myRole()) });
export const peer = () => net.peer;
export function playerLook(role, fallbackName) {
  return { name: fallbackName || nameOf(role), face: getFace(role) || null, emoji: getChars()[role]?.emoji || '💖' };
}

// ---------- Koneksi ----------
let sbPromise = null;
function client() {
  return (sbPromise ||= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({ createClient }) =>
    createClient(CONFIG.cloud.url, CONFIG.cloud.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })));
}

async function leaveRoom() {
  const ch = net.channel;
  Object.assign(net, { channel: null, peer: null, code: null, status: 'off' });
  if (ch) { try { await ch.unsubscribe(); (await client()).removeChannel(ch); } catch {} }
}

async function joinRoom(code) {
  await leaveRoom();
  net.code = code;
  net.status = 'connecting';
  render();
  try {
    const sb = await client();
    const ch = sb.channel(`lq-room-${code}`, { config: { broadcast: { self: false }, presence: { key: myId } } });
    net.channel = ch;
    ch.on('presence', { event: 'sync' }, () => {
      const others = Object.entries(ch.presenceState()).filter(([k]) => k !== myId).map(([, v]) => v[0]);
      const before = net.peer?.id;
      net.peer = others[0] || null;
      if (before && !net.peer) emitLocal('peer-left');
      if (net.peer && net.peer.id !== before) send('duo-prog', { stars: duoStars() }); // samain progres level
      render();
    });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload?.from !== myId) emitLocal(payload.t, payload); });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 12000);
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); await ch.track(me()); resolve(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(status)); }
      });
    });
    net.status = 'on';
  } catch {
    net.status = 'error';
  }
  render();
}

// ---------- Tampilan ----------
let ui = null; // { sfx, toast, modal(html), closeModal(), startGame(game, seed), startLevel(idx, seed), openTalk() }
let pendingInvite = null;

function avatar(role, name, online) {
  const look = playerLook(role, name);
  const img = look.face ? `<img src="${esc(look.face)}" alt="">` : `<span>${look.emoji}</span>`;
  return `<div class="ol-player ${online ? 'on' : ''}"><div class="ol-ava">${img}</div><b>${esc(look.name)}</b><small>${online ? 'online' : 'belum masuk'}</small></div>`;
}

const ready = () => net.status === 'on' && net.peer && myRole() && net.peer.role !== myRole();

function render() {
  if (!ui) return;
  const role = myRole();
  const cr = coupleRoom();
  const p = net.peer;
  const clash = p && role && p.role === role;
  const other = role === 'pasangan' ? 'pengirim' : 'pasangan';
  let status = '';
  if (!role) status = 'Masuk ke profilmu dulu yaa';
  else if (net.status === 'connecting') status = 'Lagi nyambung…';
  else if (net.status === 'error') status = 'Gagal nyambung, cek internet terus coba lagi 🥺';
  else if (!net.code) status = 'Bikin room baru atau masukin kode dari temenmu 👇';
  else if (!p) status = cr && net.code === cr ? `Nunggu ${esc(nameOf(other))} buka game ini juga…` : 'Kirim kode ini ke temen / pasanganmu, terus tunggu dia gabung…';
  else if (clash) status = `Kalian masuk pakai profil yang sama. Salah satu ganti profil dulu yaa`;
  else status = `${esc(p.name)} udah masuk! Pilih level di bawah 🎮`;

  const codeOpen = !cr || net.code !== cr;
  $('#ol-room').innerHTML = `
    <div class="ol-players">
      ${avatar(role || 'pasangan', role ? nameOf(role) : 'Kamu', net.status === 'on')}
      <span class="ol-vs">💞</span>
      ${p ? avatar(p.role, p.name, true) : avatar(other, cr ? nameOf(other) : 'Temanmu', false)}
    </div>
    <p class="ol-status ${ready() ? 'ok' : ''}">${status}</p>
    ${role ? `<p class="ol-me">Masuk sebagai <b>${esc(nameOf(role))}</b> · <button class="link-btn" type="button" data-ol="switch">bukan kamu?</button></p>`
      : '<button class="btn small-btn" type="button" data-ol="profile">Masuk ke profil</button>'}
    <details class="ol-friends" ${codeOpen ? 'open' : ''}>
      <summary>👯 Main sama temen pakai kode</summary>
      ${net.code && net.code !== cr ? `<p class="ol-code">Kode room: <b>${esc(net.code)}</b></p>` : ''}
      <div class="ol-code-row">
        ${cr && net.code !== cr ? '<button type="button" class="btn ghost small-btn" data-ol="couple">Balik ke room berdua</button>' : ''}
        <button type="button" class="btn ghost small-btn" data-ol="new">Bikin room baru</button>
        <form class="ol-join" data-ol-join><input inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="Kode" aria-label="Kode room"><button class="btn small-btn" type="submit">Gabung</button></form>
      </div>
    </details>`;

  // Peta level berdua
  const stars = duoStars();
  const total = Object.values(stars).reduce((a, b) => a + b, 0);
  $('#ol-map').innerHTML = `<p class="ol-section">🗺️ Petualangan berdua <span>⭐ ${total}/${DUO_LEVELS.length * 3}</span></p>` + LEVEL_MAP.map((w, wi) => {
    const levels = DUO_LEVELS.filter((L) => L.world === wi);
    const open = duoUnlocked(levels[0], stars);
    return `
      <section class="world ${WORLD_THEME[wi]} ${open ? '' : 'locked'}">
        <div class="world-head">
          <span class="world-icon">${w.icon}</span>
          <div><small>Dunia ${wi + 1}</small><h2>${esc(w.name)}</h2></div>
        </div>
        <div class="levels">
          ${levels.map((L) => {
            const s = stars[L.id] || 0;
            const unlocked = duoUnlocked(L, stars);
            const current = unlocked && !s;
            return `<button class="lvl ${unlocked ? '' : 'locked'} ${s ? 'done' : ''} ${current ? 'current' : ''}" data-duo="${L.idx}" ${unlocked ? '' : 'disabled'}>
              <span class="lvl-type">${unlocked ? DUO_ICONS[L.type] : '🔒'}</span>
              <span class="lvl-num">${L.num}</span>
              <span class="lvl-stars">${[0, 1, 2].map((k) => (k < s ? '★' : '<i>★</i>')).join('')}</span>
            </button>`;
          }).join('')}
        </div>
      </section>`;
  }).join('');

  $('#ol-games').innerHTML = `<p class="ol-section">🎲 Main bebas</p>` + Object.entries(ONLINE_GAMES).map(([id, g]) => `
    <button type="button" class="ol-game" data-game="${id}">
      <span class="ol-game-icon">${g.icon}</span>
      <span><b>${esc(g.name)}</b><small>${esc(g.desc)}</small></span>
    </button>`).join('');
}

function needPartner() {
  if (!myRole()) { ui.toast('Masuk ke profilmu dulu yaa'); return true; }
  if (!ready()) { ui.toast(net.peer ? 'Kalian pakai profil yang sama 🤔' : 'Tunggu pasanganmu masuk dulu yaa 💞'); return true; }
  return false;
}

// Ajak main: game bebas (game) atau level (level = nomor urut)
export function inviteGame(game, level = null) {
  if (needPartner()) return;
  const seed = Math.floor(Math.random() * 1e9);
  pendingInvite = { game, seed, level };
  send('invite', { game, seed, level, name: me().name });
  ui.sfx('click');
  const title = level != null ? `Level ${DUO_LEVELS[level].num} · ${DUO_NAMES[DUO_LEVELS[level].type]}` : ONLINE_GAMES[game].name;
  const icon = level != null ? DUO_ICONS[DUO_LEVELS[level].type] : ONLINE_GAMES[game].icon;
  ui.modal(`
    <div class="modal-emoji">${icon}</div>
    <h2>Ngajak ${esc(net.peer?.name || '')}…</h2>
    <p class="detail">Nunggu dia pencet "Ayo" buat main <b>${esc(title)}</b></p>
    <div class="modal-actions"><button class="btn ghost" data-ol-act="cancel">Batal</button></div>`);
}

function start(inv) {
  pendingInvite = null;
  ui.closeModal();
  if (inv.level != null) ui.startLevel(inv.level, inv.seed);
  else if (inv.game === 'talk') ui.openTalk();
  else ui.startGame(inv.game, inv.seed);
}

export function mountOnline(opts) {
  ui = opts;
  $('#screen-online').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-ol]')?.dataset.ol;
    if (act === 'profile' || act === 'switch') {
      ui.sfx('click');
      if (act === 'switch') forget();
      const role = await askProfile({ sfx: ui.sfx });
      if (role) {
        if (net.channel && net.status === 'on') net.channel.track(me());
        else if (coupleRoom()) joinRoom(coupleRoom());
      }
      render();
      return;
    }
    if (act === 'new') { ui.sfx('click'); joinRoom(String(Math.floor(1000 + Math.random() * 9000))); }
    if (act === 'couple') { ui.sfx('click'); joinRoom(coupleRoom()); }
    const lvl = e.target.closest('[data-duo]');
    if (lvl && !lvl.disabled) inviteGame('level', +lvl.dataset.duo);
    const g = e.target.closest('[data-game]');
    if (g) inviteGame(g.dataset.game);
  });
  $('#screen-online').addEventListener('submit', (e) => {
    if (!e.target.matches('[data-ol-join]')) return;
    e.preventDefault();
    const code = e.target.querySelector('input').value.trim();
    if (!/^\d{4}$/.test(code)) { ui.toast('Kodenya 4 angka yaa'); return; }
    ui.sfx('click');
    joinRoom(code);
  });
  // Tombol di modal (ajakan main)
  $('#modal').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ol-act]');
    if (!btn) return;
    ui.sfx('click');
    const act = btn.dataset.olAct;
    if (act === 'cancel') { send('cancel'); pendingInvite = null; ui.closeModal(); }
    if (act === 'no') { send('decline'); ui.closeModal(); }
    if (act === 'yes') {
      const inv = JSON.parse(btn.dataset.inv || 'null');
      if (inv) { send('accept', inv); start(inv); }
    }
  });

  on('invite', (d) => {
    const isLevel = d.level != null && DUO_LEVELS[d.level];
    const g = isLevel ? null : ONLINE_GAMES[d.game];
    if (!isLevel && !g) return;
    const L = isLevel ? DUO_LEVELS[d.level] : null;
    ui.sfx('pop');
    navigator.vibrate?.(40);
    ui.modal(`
      <div class="modal-emoji bounce">${isLevel ? DUO_ICONS[L.type] : g.icon}</div>
      <h2>${esc(d.name)} ngajak main!</h2>
      <p class="detail"><b>${esc(isLevel ? `Level ${L.num} · ${DUO_NAMES[L.type]}` : g.name)}</b>${isLevel ? '' : ` · ${esc(g.desc)}`}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-ol-act="no">Nanti</button>
        <button class="btn" data-ol-act="yes" data-inv='${esc(JSON.stringify({ game: d.game, seed: d.seed, level: d.level ?? null }))}'>Ayo! 🎮</button>
      </div>`);
  });
  on('accept', (d) => { if (pendingInvite && d.game === pendingInvite.game && d.seed === pendingInvite.seed) start(d); });
  on('decline', () => { if (pendingInvite) { pendingInvite = null; ui.closeModal(); ui.toast(`${net.peer?.name || 'Dia'} lagi nggak bisa, nanti yaa 🥺`); } });
  on('cancel', () => ui.closeModal());
  on('peer-left', () => { if (pendingInvite) { pendingInvite = null; ui.closeModal(); } });
  on('duo-prog', (d) => { if (mergeDuo(d.stars)) render(); });
}

// Dipanggil tiap buka layar Main Berdua
export async function enterLobby() {
  render();
  if (!myRole()) {
    const role = await askProfile({ sfx: ui?.sfx });
    if (!role) { render(); return; }
  }
  if (!net.code && coupleRoom()) joinRoom(coupleRoom());
  render();
}
export const refreshLobby = () => render();
export const isOnline = () => net.status === 'on' && !!net.peer;
