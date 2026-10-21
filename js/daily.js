// Tantangan harian berdua: 3 misi kecil tiap hari. Misinya sama buat pasangan (dipilih dari tanggal + kode game),
// progres dihitung di HP masing-masing. Tiap misi selesai: +5 koin 🪙 ke dompet peliharaan bareng; 3-3nya: bonus +15.
// Jumlah misi yang udah beres ikut dicatat di data peliharaan (yang disimpen di server), jadi bisa liat progres pasangan.
import { CONFIG } from './config.js';
import { esc } from './util.js';

const scope = () => CONFIG.slug || (CONFIG.showcase ? `contoh-${CONFIG.showcase}` : 'demo');
const KEY = () => `lq-daily-${scope()}`;
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const TASK_COIN = 5, BONUS_COIN = 15;

let opts = { types: [], name: (t) => t, icon: () => '🎮', onDone: null, partner: null };
export function initDaily(o) { opts = { ...opts, ...o }; }

// Pilih 3 misi hari ini: 1 berdua · 1 petualangan/rekor · 1 santai (deep talk / peliharaan / game hari ini)
export function todays(d = today()) {
  let seed = hash(`${d}|${scope()}`);
  const rnd = () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const types = opts.types.length ? opts.types : ['sumo'];
  const gt = pick(types);
  const A = [
    { id: 'duo', ic: '💞', t: 'Main 1 game Berdua', ev: 'duo', need: 1, go: 'duo' },
    { id: 'duo', ic: '💞', t: 'Main 1 game Berdua', ev: 'duo', need: 1, go: 'duo' },
    { id: 'duoWin', ic: '🏆', t: 'Menang 1x lawan pasanganmu', ev: 'duoWin', need: 1, go: 'duo' },
  ];
  const B = [
    { id: 'level', ic: '🗺️', t: 'Selesaiin 1 level Petualangan', ev: 'level', need: 1, go: 'map' },
    { id: 'stars3', ic: '⭐', t: 'Dapet ⭐⭐⭐ di 1 level', ev: 'stars3', need: 1, go: 'map' },
    { id: 'endless', ic: '🏅', t: 'Main mode skor 2x', ev: 'endless', need: 2, go: 'per' },
  ];
  const C = [
    { id: 'talk', ic: '💬', t: 'Tarik 2 kartu Deep Talk', ev: 'talk', need: 2, go: 'talk' },
    { id: 'pet', ic: '🐾', t: 'Rawat peliharaan 3x', ev: 'pet', need: 3, go: 'pet' },
    { id: `g-${gt}`, ic: opts.icon(gt), t: `Main ${opts.name(gt)}`, ev: `type:${gt}`, need: 1, go: `game:${gt}` },
    { id: `g-${gt}`, ic: opts.icon(gt), t: `Main ${opts.name(gt)}`, ev: `type:${gt}`, need: 1, go: `game:${gt}` },
  ];
  return [pick(A), pick(B), pick(C)];
}

function load() {
  const d = today();
  try { const s = JSON.parse(localStorage.getItem(KEY())); if (s && s.d === d) return s; } catch {}
  return { d, prog: {}, done: {}, bonus: false };
}
function save(s) { try { localStorage.setItem(KEY(), JSON.stringify(s)); } catch {} }
export const dailyState = () => { const s = load(); const tasks = todays(s.d); return { ...s, tasks, count: tasks.filter((t) => s.done[t.id]).length }; };

// Catat kejadian (dipanggil dari game / deep talk / peliharaan). Balikin misi yang barusan selesai.
export function track(ev, n = 1) {
  const s = load(), tasks = todays(s.d), fresh = [];
  for (const t of tasks) {
    if (t.ev !== ev || s.done[t.id]) continue;
    s.prog[t.id] = Math.min(t.need, (s.prog[t.id] || 0) + n);
    if (s.prog[t.id] >= t.need) { s.done[t.id] = true; fresh.push(t); }
  }
  if (!fresh.length) { save(s); return []; }
  const all = tasks.every((t) => s.done[t.id]);
  const bonus = all && !s.bonus;
  if (bonus) s.bonus = true;
  save(s);
  const coins = fresh.length * TASK_COIN + (bonus ? BONUS_COIN : 0);
  opts.onDone?.({ tasks: fresh, coins, bonus, count: tasks.filter((t) => s.done[t.id]).length });
  return fresh;
}

// Kartu di beranda
export function renderDaily(el) {
  if (!el) return;
  const s = dailyState();
  const left = (() => { const now = new Date(); const j = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })); return 24 - j.getHours() - (j.getMinutes() ? 1 : 0); })();
  const all = s.count === s.tasks.length;
  el.hidden = false;
  el.className = `daily-card ${all ? 'all' : ''}`;
  el.innerHTML = `
    <div class="dc-head">
      <span class="dc-ic">${all ? '🎉' : '🎯'}</span>
      <div><b>${all ? 'Tantangan hari ini beres!' : 'Tantangan hari ini'}</b><small>${all ? `+${s.tasks.length * TASK_COIN + BONUS_COIN} 🪙 masuk ke dompet peliharaan` : `Tiap misi +${TASK_COIN} 🪙 · beres semua bonus +${BONUS_COIN} 🪙`}</small></div>
      <span class="dc-count">${s.count}/${s.tasks.length}</span>
    </div>
    <div class="dc-list">${s.tasks.map((t) => {
      const ok = s.done[t.id], prog = s.prog[t.id] || 0;
      return `<button type="button" class="dc-task ${ok ? 'ok' : ''}" data-daily-go="${esc(t.go)}" ${ok ? 'disabled' : ''}>
        <span class="dc-tic">${t.ic}</span><span class="dc-t">${esc(t.t)}${t.need > 1 && !ok ? ` <em>${prog}/${t.need}</em>` : ''}</span>
        <span class="dc-chk">${ok ? '✓' : '›'}</span></button>`;
    }).join('')}</div>
    <p class="dc-foot"><span class="dc-partner" data-daily-partner></span><span>Ganti misi baru ±${Math.max(1, left)} jam lagi</span></p>`;
  // progres pasangan (dari data peliharaan bareng) — diisi belakangan biar beranda nggak nunggu internet
  opts.partner?.().then((txt) => { const p = el.querySelector('[data-daily-partner]'); if (p && txt) p.textContent = txt; }).catch(() => {});
}
