import { CONFIG } from './config.js';
import { createPlayer } from './music.js';

// Efek suara kecil yang dibuat langsung dengan Web Audio (tanpa file audio).
let ctx = null;
let muted = false;      // efek suara game
let musicOff = false;   // lagu latar
try {
  muted = localStorage.getItem('fq-muted') === '1';
  musicOff = localStorage.getItem('fq-music-off') === '1';
} catch {}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Volume efek suara (0..1) lewat satu jalur bareng, diatur dari Pengaturan
let sfxBus = null, sfxVol = 0.8, musicVol = 0.6, vibrateOn = true;
try { const st = JSON.parse(localStorage.getItem('lq-settings') || '{}'); if (st.sfxVol != null) sfxVol = st.sfxVol; if (st.musicVol != null) musicVol = st.musicVol; if (st.vibrate != null) vibrateOn = st.vibrate; } catch {}
function bus(c) { if (!sfxBus) { sfxBus = c.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(c.destination); } return sfxBus; }
export function setVolumes({ sfx: a, music: m, vibrate: v } = {}) {
  if (a != null) { sfxVol = a; if (sfxBus) sfxBus.gain.value = a; }
  if (m != null) { musicVol = m; if (musicGain) musicGain.gain.value = 0.35 * m * 1.6; }
  if (v != null) vibrateOn = v;
}
// Getar kecil (Android) buat momen penting
const BUZZ = { bad: 60, lose: [80, 60, 80], win: [30, 40, 30, 40, 60], gold: 25, good: 12 };
function buzz(name) { if (vibrateOn && BUZZ[name] && navigator.vibrate) try { navigator.vibrate(BUZZ[name]); } catch {} }

function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, when = 0, slide = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus(c));
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Desis (noise) buat ledakan, whoosh, sorakan: buffer acak dibikin sekali, disaring sesuai kebutuhan
let noiseBuf = null;
function noise(dur = 0.3, { vol = 0.2, type = 'lowpass', f0 = 1200, f1 = 300, q = 0.8, when = 0 } = {}) {
  const c = ac(); if (!c) return;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = c.currentTime + when, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf; fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl).connect(g).connect(bus(c)); src.start(t); src.stop(t + dur + 0.05);
}

const SFX = {
  // suara khusus per game
  boom: () => { noise(0.7, { vol: 0.5, f0: 900, f1: 60 }); tone(70, 0.5, 'sine', 0.3, 0, 0.5); },
  thud: () => { tone(110, 0.16, 'sine', 0.35, 0, 0.55); noise(0.12, { vol: 0.18, f0: 600, f1: 150 }); },
  whoosh: () => noise(0.28, { vol: 0.16, type: 'bandpass', f0: 500, f1: 2600, q: 1.4 }),
  poof: () => { noise(0.22, { vol: 0.2, f0: 2200, f1: 400 }); tone(330, 0.1, 'triangle', 0.06, 0, 0.7); },
  kick: () => { tone(160, 0.1, 'sine', 0.32, 0, 0.4); noise(0.06, { vol: 0.15, f0: 3000, f1: 800 }); },
  cheer: () => { noise(1.2, { vol: 0.22, type: 'bandpass', f0: 1400, f1: 1100, q: 0.6 }); [784, 988, 1175].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, 0.15 + i * 0.09)); },
  ding: () => { tone(1568, 0.6, 'sine', 0.14); tone(2093, 0.5, 'sine', 0.07, 0.02); },
  boing: () => tone(180, 0.32, 'sine', 0.22, 0, 3.2),
  freeze: () => [2093, 1760, 2637, 2349].forEach((f, i) => tone(f, 0.16, 'sine', 0.07, i * 0.05)),
  coin: () => { tone(988, 0.07, 'square', 0.06); tone(1319, 0.16, 'square', 0.06, 0.06); },
  crash: () => { noise(0.45, { vol: 0.35, f0: 2500, f1: 200 }); tone(90, 0.3, 'square', 0.08, 0, 0.6); },
  chop: () => noise(0.05, { vol: 0.2, type: 'highpass', f0: 2500, f1: 2000 }),
  click: () => tone(660, 0.07, 'triangle', 0.1),
  flip: () => tone(520, 0.08, 'triangle', 0.08, 0, 1.3),
  good: () => { tone(784, 0.1, 'sine', 0.14); tone(1175, 0.12, 'sine', 0.1, 0.06); },
  gold: () => [880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.12, 'sine', 0.12, i * 0.05)),
  bad: () => tone(220, 0.25, 'sawtooth', 0.07, 0, 0.6),
  pop: () => tone(900, 0.06, 'square', 0.04, 0, 0.5),
  note0: () => tone(523, 0.28, 'triangle', 0.14),
  note1: () => tone(659, 0.28, 'triangle', 0.14),
  note2: () => tone(784, 0.28, 'triangle', 0.14),
  note3: () => tone(988, 0.28, 'triangle', 0.14),
  tick: () => tone(1000, 0.06, 'square', 0.05),
  go: () => { tone(1320, 0.18, 'triangle', 0.1); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, i * 0.11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.15)),
};

export function sfx(name) {
  buzz(name);
  if (muted) return;
  try { SFX[name]?.(); } catch {}
}

// Musik latar: lagu sintetis pilihan pasangan (CONFIG.music), lihat js/music.js
let musicGain = null;
const player = createPlayer(
  () => ac(),
  () => {
    if (!musicGain) {
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.35 * musicVol * 1.6;
      musicGain.connect(ctx.destination);
    }
    return musicGain;
  },
);

let musicHold = false; // lagi ada video yang diputar → lagu latar diem dulu

function syncMusic() {
  const track = CONFIG.music;
  if (musicOff || musicHold || document.hidden || !track || track === 'off') player.stop();
  else if (!player.playing) player.play(track);
}

const unlock = () => {
  syncMusic();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
document.addEventListener('visibilitychange', syncMusic);

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('fq-muted', muted ? '1' : '0'); } catch {}
  return muted;
}

export const isMusicOff = () => musicOff;

// Tahan lagu latar sementara (misal pas video tutorial diputar), tanpa ngubah setelan lagu
export function holdMusic(on) {
  musicHold = on;
  syncMusic();
}

export function toggleMusic() {
  musicOff = !musicOff;
  try { localStorage.setItem('fq-music-off', musicOff ? '1' : '0'); } catch {}
  syncMusic();
  return musicOff;
}
