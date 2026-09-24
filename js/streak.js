// Streak berdua.
// - Demo: disimulasikan di browser (pengirim "sudah main" 7 hari, pengunjung tinggal nyalain hari ini).
// - Game pasangan: disimpan di Supabase per pasangan, lewat fungsi record_play/get_plays/save_push.
import { CONFIG } from './config.js';

const PLAYERS = ['pasangan', 'pengirim'];
const { url = '', anonKey = '', vapidPublicKey = '', pushFunction = '' } = CONFIG.cloud || {};
const base = url.replace(/\/$/, '');

export const streakEnabled = CONFIG.demo || Boolean(url && anonKey && CONFIG.slug);

const WHO_KEY = CONFIG.demo ? 'lq-demo-player' : `lq-player-${CONFIG.slug}`;
export function getPlayer() {
  if (CONFIG.demo) return 'pasangan';
  try {
    const p = localStorage.getItem(WHO_KEY);
    return PLAYERS.includes(p) ? p : null;
  } catch { return null; }
}
export function setPlayer(p) {
  if (!CONFIG.demo) try { localStorage.setItem(WHO_KEY, p); } catch {}
}
export function clearPlayer() {
  try { localStorage.removeItem(WHO_KEY); } catch {}
}

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
const today = () => fmt.format(new Date());
function shiftDay(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function rpc(name, body) {
  return fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => {
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    return res.json();
  });
}

// ---------- Hitung streak dari daftar {player, day} ----------
function summarize(rows) {
  const t = today();
  const byDay = new Map();
  for (const { player, day } of rows) {
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day).add(player);
  }
  const both = (d) => PLAYERS.every((p) => byDay.get(d)?.has(p));
  // Kalau hari ini belum lengkap, streak masih hidup dari kemarin
  let count = 0;
  let d = both(t) ? t : shiftDay(t, -1);
  while (both(d)) { count++; d = shiftDay(d, -1); }
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const day = shiftDay(t, -i);
    week.push({ day, pasangan: !!byDay.get(day)?.has('pasangan'), pengirim: !!byDay.get(day)?.has('pengirim') });
  }
  return {
    count,
    litToday: both(t),
    today: { pasangan: !!byDay.get(t)?.has('pasangan'), pengirim: !!byDay.get(t)?.has('pengirim') },
    week,
  };
}

// ---------- Demo ----------
const DEMO_KEY = 'lq-demo-played';
function demoRows() {
  const t = today();
  const rows = [];
  for (let i = 1; i <= 7; i++) PLAYERS.forEach((player) => rows.push({ player, day: shiftDay(t, -i) }));
  rows.push({ player: 'pengirim', day: t });
  try { if (localStorage.getItem(DEMO_KEY) === t) rows.push({ player: 'pasangan', day: t }); } catch {}
  return rows;
}

// ---------- API yang dipakai main.js ----------
// ---------- Main offline (game pasangan) ----------
// Catatan "sudah main" masuk antrean di HP dulu, lalu dikirim begitu ada internet.
const QUEUE_KEY = () => `lq-pending-${CONFIG.slug}`;
const ROWS_KEY = () => `lq-streak-rows-${CONFIG.slug}`;
function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export const pendingPlays = () => (CONFIG.demo ? 0 : readJSON(QUEUE_KEY(), []).length);

// Kirim semua catatan main yang masih nunggu. Balikannya jumlah yang berhasil terkirim.
export async function flushPlays() {
  if (CONFIG.demo || !streakEnabled) return 0;
  const queue = readJSON(QUEUE_KEY(), []);
  if (!queue.length) return 0;
  const left = [];
  let sent = 0;
  for (let i = 0; i < queue.length; i++) {
    const { player, day } = queue[i];
    try {
      await rpc('record_play', { p_slug: CONFIG.slug, p_player: player, p_day: day });
      sent++;
    } catch (err) {
      const status = Number(String(err.message).match(/\d+/)?.[0]);
      if (!status) { left.push(...queue.slice(i)); break; } // masih offline
      // Server lama (belum jalanin migration-3.sql) belum kenal p_day: kirim tanpa tanggal kalau main-nya hari ini
      if (status === 404 && day === today()) {
        try { await rpc('record_play', { p_slug: CONFIG.slug, p_player: player }); sent++; } catch { left.push(queue[i]); }
      } else if (status >= 500) left.push(queue[i]);
      // status lain (ditolak) → dibuang, jangan dicoba terus
    }
  }
  writeJSON(QUEUE_KEY(), left);
  return sent;
}

export async function recordPlay() {
  const player = getPlayer();
  if (!streakEnabled || !player) return false;
  const t = today();
  const key = CONFIG.demo ? DEMO_KEY : `lq-played-${CONFIG.slug}-${player}`;
  try { if (localStorage.getItem(key) === t) return false; } catch {}
  try { localStorage.setItem(key, t); } catch {}
  if (!CONFIG.demo) {
    const queue = readJSON(QUEUE_KEY(), []);
    if (!queue.some((q) => q.player === player && q.day === t)) queue.push({ player, day: t });
    writeJSON(QUEUE_KEY(), queue);
    await flushPlays();
  }
  return true;
}

export async function loadStreak() {
  if (CONFIG.demo) return summarize(demoRows());
  let rows;
  let offline = false;
  try {
    rows = await rpc('get_plays', { p_slug: CONFIG.slug });
    writeJSON(ROWS_KEY(), rows);
  } catch (err) {
    rows = readJSON(ROWS_KEY(), null);
    if (!rows) throw err; // belum pernah online sama sekali
    offline = true;
  }
  // Main yang belum terkirim tetap dihitung di tampilan
  return { ...summarize([...rows, ...readJSON(QUEUE_KEY(), [])]), offline };
}

// Kabari pasangan lewat notifikasi (edge function). Gagal pun nggak apa-apa.
export function notifyPlayed() {
  const player = getPlayer();
  if (CONFIG.demo || !pushFunction || !player) return Promise.resolve();
  return fetch(`${base}/functions/v1/${pushFunction}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'played', slug: CONFIG.slug, player }),
  }).catch(() => {});
}

// ---------- Notifikasi (web push) ----------
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 'ok' | 'on' | 'denied' | 'ios-install' | 'unsupported'
export async function pushState() {
  if (CONFIG.demo || !vapidPublicKey || !pushFunction || !('serviceWorker' in navigator)) return 'unsupported';
  if (isIOS && !isStandalone()) return 'ios-install';
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'ok';
}

function keyBytes(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function enablePush() {
  const player = getPlayer();
  if (!player) return 'ok';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'ok';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }));
  const { endpoint, keys } = sub.toJSON();
  const ok = await rpc('save_push', { p_slug: CONFIG.slug, p_player: player, p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
  if (!ok) throw new Error('save_push gagal');
  return 'on';
}

// Angka streak di ikon aplikasi (kalau HP-nya dukung)
export function setBadge(count) {
  if (CONFIG.demo) return;
  try {
    if (!('setAppBadge' in navigator)) return;
    if (count > 0) navigator.setAppBadge(count).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  } catch {}
}
