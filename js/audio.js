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
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SFX = {
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
      musicGain.gain.value = 0.35;
      musicGain.connect(ctx.destination);
    }
    return musicGain;
  },
);

function syncMusic() {
  const track = CONFIG.music;
  if (musicOff || document.hidden || !track || track === 'off') player.stop();
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

export function toggleMusic() {
  musicOff = !musicOff;
  try { localStorage.setItem('fq-music-off', musicOff ? '1' : '0'); } catch {}
  syncMusic();
  return musicOff;
}
