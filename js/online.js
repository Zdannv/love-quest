// Main Bareng online: dua HP nyambung lewat Supabase Realtime (broadcast + presence), tanpa database.
// Game pasangan otomatis masuk room berdua. Bisa juga pakai kode 4 angka buat main sama temen.
import { CONFIG } from './config.js';
import { getNames, getFace, getChars } from './personal.js';
import { getPlayer } from './streak.js';
import { esc } from './util.js';
import { ONLINE_GAMES } from './online-games.js';

const $ = (s) => document.querySelector(s);
const ROLE_KEY = 'lq-online-role';
const ID_KEY = 'lq-online-id';

const myId = (() => {
  try {
    let v = sessionStorage.getItem(ID_KEY); // per tab, biar 2 tab di 1 HP tetap dianggap 2 pemain
    if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem(ID_KEY, v); }
    return v;
  } catch { return Math.random().toString(36).slice(2, 10); }
})();

// Room pasangan cuma buat game asli (bukan demo / contoh), biar pengunjung demo nggak nyasar ke room yang sama
const coupleRoom = () => (!CONFIG.demo && !CONFIG.showcase && CONFIG.slug ? `c-${CONFIG.slug}` : null);

const net = {
  code: null,
  channel: null,
  peer: null,
  status: 'off', // off | connecting | on | error
  listeners: {},
};

function emitLocal(type, data) { (net.listeners[type] || []).slice().forEach((fn) => fn(data)); }
export function on(type, fn) {
  (net.listeners[type] ||= []).push(fn);
  return () => { net.listeners[type] = (net.listeners[type] || []).filter((f) => f !== fn); };
}
export function send(type, data = {}) {
  net.channel?.send({ type: 'broadcast', event: 'm', payload: { t: type, from: myId, ...data } });
}

// ---------- Siapa aku ----------
export function myRole() {
  try {
    const r = localStorage.getItem(ROLE_KEY);
    if (r === 'pasangan' || r === 'pengirim') return r;
  } catch {}
  const p = !CONFIG.demo && !CONFIG.showcase ? getPlayer() : null;
  return p || null;
}
function setRole(r) { try { localStorage.setItem(ROLE_KEY, r); } catch {} }
export const nameOf = (role) => getNames()[role] || (role === 'pasangan' ? 'Pemain 1' : 'Pemain 2');
export const me = () => ({ id: myId, role: myRole(), name: nameOf(myRole()) });
export const peer = () => net.peer;
export function playerLook(role, fallbackName) {
  const chars = getChars();
  const f = getFace(role);
  return { name: fallbackName || nameOf(role), face: f || null, emoji: chars[role]?.emoji || '💖' };
}

// ---------- Koneksi ----------
let sbPromise = null;
function client() {
  return (sbPromise ||= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({ createClient }) =>
    createClient(CONFIG.cloud.url, CONFIG.cloud.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })));
}

async function leaveRoom() {
  const ch = net.channel;
  net.channel = null;
  net.peer = null;
  net.code = null;
  net.status = 'off';
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

// ---------- Tampilan lobby ----------
let ui = null; // { sfx, toast, startGame(game, seed), openTalk() }
let pendingInvite = null;

function avatar(role, name, online) {
  const look = playerLook(role, name);
  const img = look.face ? `<img src="${esc(look.face)}" alt="">` : `<span>${look.emoji}</span>`;
  return `<div class="ol-player ${online ? 'on' : ''}"><div class="ol-ava">${img}</div><b>${esc(look.name)}</b><small>${online ? 'online' : 'belum masuk'}</small></div>`;
}

function render() {
  if (!ui) return;
  const role = myRole();
  const names = getNames();
  // Pilih: aku yang mana
  $('#ol-who').innerHTML = `
    <p class="ol-label">Kamu siapa?</p>
    <div class="ol-who-btns">
      ${['pasangan', 'pengirim'].map((r) => `<button type="button" class="ol-who-btn ${role === r ? 'on' : ''}" data-role="${r}">${esc(names[r] || nameOf(r))}</button>`).join('')}
    </div>`;

  const cr = coupleRoom();
  const p = net.peer;
  const clash = p && role && p.role === role;
  let status = '';
  if (!role) status = 'Pilih dulu kamu yang mana 👆';
  else if (net.status === 'connecting') status = 'Lagi nyambung…';
  else if (net.status === 'error') status = 'Gagal nyambung, cek internet terus coba lagi 🥺';
  else if (!net.code) status = cr ? '' : 'Bikin room baru atau masukin kode dari temenmu 👇';
  else if (!p) status = cr ? `Nunggu ${esc(nameOf(role === 'pasangan' ? 'pengirim' : 'pasangan'))} buka game ini juga…` : 'Kirim kode ini ke temen / pasanganmu, terus tunggu dia gabung…';
  else if (clash) status = 'Kalian milih nama yang sama, salah satu ganti dulu yaa 👆';
  else status = `${esc(p.name)} udah masuk! Pilih game di bawah 🎮`;

  const other = role === 'pasangan' ? 'pengirim' : 'pasangan';
  $('#ol-room').innerHTML = `
    <div class="ol-players">
      ${avatar(role || 'pasangan', role ? nameOf(role) : 'Kamu', net.status === 'on')}
      <span class="ol-vs">💞</span>
      ${p ? avatar(p.role, p.name, true) : avatar(other, cr ? nameOf(other) : 'Temanmu', false)}
    </div>
    <p class="ol-status ${p && !clash ? 'ok' : ''}">${status}</p>
    ${net.code && !(cr && net.code === cr) ? `<p class="ol-code">Kode room: <b>${esc(net.code)}</b></p>` : ''}
    <div class="ol-code-row">
      ${cr && net.code !== cr ? '<button type="button" class="btn ghost small-btn" data-ol="couple">Balik ke room berdua</button>' : ''}
      <button type="button" class="btn ghost small-btn" data-ol="new">${cr ? 'Main sama temen (kode baru)' : 'Bikin room baru'}</button>
      <form class="ol-join" data-ol-join><input inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="Kode" aria-label="Kode room"><button class="btn small-btn" type="submit">Gabung</button></form>
    </div>`;

  const ready = net.status === 'on' && p && !clash && role;
  $('#ol-games').innerHTML = Object.entries(ONLINE_GAMES).map(([id, g]) => `
    <button type="button" class="ol-game" data-game="${id}" ${ready ? '' : 'disabled'}>
      <span class="ol-game-icon">${g.icon}</span>
      <span><b>${esc(g.name)}</b><small>${esc(g.desc)}</small></span>
    </button>`).join('');
}

export function inviteGame(game) {
  const seed = Math.floor(Math.random() * 1e9);
  pendingInvite = { game, seed };
  send('invite', { game, seed, name: me().name });
  ui.sfx('click');
  ui.modal(`
    <div class="modal-emoji">${ONLINE_GAMES[game].icon}</div>
    <h2>Ngajak ${esc(net.peer?.name || '')}…</h2>
    <p class="detail">Nunggu dia pencet "Ayo" buat main <b>${esc(ONLINE_GAMES[game].name)}</b></p>
    <div class="modal-actions"><button class="btn ghost" data-ol-act="cancel">Batal</button></div>`);
}

function start(game, seed) {
  pendingInvite = null;
  ui.closeModal();
  if (game === 'talk') ui.openTalk();
  else ui.startGame(game, seed);
}

export function mountOnline(opts) {
  ui = opts;
  $('#screen-online').addEventListener('click', (e) => {
    const r = e.target.closest('[data-role]');
    if (r) {
      ui.sfx('click');
      setRole(r.dataset.role);
      if (net.channel && net.status === 'on') net.channel.track(me());
      else if (!net.code && coupleRoom()) joinRoom(coupleRoom());
      render();
      return;
    }
    const act = e.target.closest('[data-ol]')?.dataset.ol;
    if (act === 'new') { ui.sfx('click'); joinRoom(String(Math.floor(1000 + Math.random() * 9000))); }
    if (act === 'couple') { ui.sfx('click'); joinRoom(coupleRoom()); }
    const g = e.target.closest('[data-game]');
    if (g && !g.disabled) inviteGame(g.dataset.game);
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
  document.querySelector('#modal').addEventListener('click', (e) => {
    const act = e.target.closest('[data-ol-act]')?.dataset.olAct;
    if (!act) return;
    ui.sfx('click');
    const inv = JSON.parse(e.target.closest('[data-ol-act]').dataset.inv || 'null');
    if (act === 'cancel') { send('cancel'); pendingInvite = null; ui.closeModal(); }
    if (act === 'no') { send('decline'); ui.closeModal(); }
    if (act === 'yes' && inv) { send('accept', inv); start(inv.game, inv.seed); }
  });

  on('invite', (d) => {
    const g = ONLINE_GAMES[d.game];
    if (!g) return;
    ui.sfx('pop');
    navigator.vibrate?.(40);
    ui.modal(`
      <div class="modal-emoji bounce">${g.icon}</div>
      <h2>${esc(d.name)} ngajak main!</h2>
      <p class="detail"><b>${esc(g.name)}</b> · ${esc(g.desc)}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-ol-act="no">Nanti</button>
        <button class="btn" data-ol-act="yes" data-inv='${esc(JSON.stringify({ game: d.game, seed: d.seed }))}'>Ayo! 🎮</button>
      </div>`);
  });
  on('accept', (d) => { if (pendingInvite && d.game === pendingInvite.game) start(d.game, d.seed); });
  on('decline', () => { if (pendingInvite) { pendingInvite = null; ui.closeModal(); ui.toast(`${net.peer?.name || 'Dia'} lagi nggak bisa, nanti yaa 🥺`); } });
  on('cancel', () => ui.closeModal());
  on('peer-left', () => { if (pendingInvite) { pendingInvite = null; ui.closeModal(); } });
}

// Dipanggil tiap buka layar Main Bareng
export function enterLobby() {
  if (!net.code && myRole() && coupleRoom()) joinRoom(coupleRoom());
  render();
}
export const isOnline = () => net.status === 'on' && !!net.peer;
