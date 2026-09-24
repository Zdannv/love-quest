// Lagu latar sintetis (dimainkan langsung pakai Web Audio, bebas hak cipta).
// Dipakai game dan CMS (buat preview).
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// Tiap lagu: 4 akor × 8 ketukan (1/8), melodi 32 langkah (null = diam)
export const TRACKS = {
  ceria: {
    name: 'Ceria 🌸', bpm: 108, lead: 'sine', bass: 'triangle',
    chords: [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]],
    melody: [76, null, 79, 76, 74, null, 72, null, 71, null, 74, 79, 74, null, null, null,
      72, null, 76, 72, 69, null, 72, 74, 72, null, 69, null, 72, null, null, null],
  },
  santai: {
    name: 'Santai ☕', bpm: 84, lead: 'triangle', bass: 'sine',
    chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]],
    melody: [72, null, null, 76, 74, null, 72, null, 69, null, null, 72, 71, null, null, null,
      67, null, 72, null, 76, null, 74, 72, 71, null, null, null, 67, null, null, null],
  },
  romantis: {
    name: 'Romantis 💞', bpm: 72, lead: 'sine', bass: 'sine',
    chords: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]],
    melody: [79, null, 76, null, 77, null, 74, null, 76, null, 72, null, 74, null, null, null,
      72, null, 74, 76, 77, null, 76, 74, 74, null, null, null, 71, null, null, null],
  },
  lucu: {
    name: 'Lucu 🐱', bpm: 132, lead: 'square', bass: 'triangle', leadVol: 0.05,
    chords: [[48, 52, 55], [53, 57, 60], [43, 47, 50], [48, 52, 55]],
    melody: [72, 74, 76, 72, 76, null, 79, null, 77, 76, 74, 77, 76, null, 72, null,
      74, 74, 79, 79, 77, 76, 74, 72, 71, null, 67, null, 72, null, null, null],
  },
};

// getCtx() → AudioContext, getOut() → node tujuan (misal GainNode)
export function createPlayer(getCtx, getOut) {
  let timer = 0;
  let next = 0;
  let step = 0;
  let track = null;

  function note(ctx, freq, time, dur, type, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g).connect(getOut());
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  function tick() {
    const ctx = getCtx();
    const stepLen = 60 / track.bpm / 2;
    while (next < ctx.currentTime + 0.25) {
      const chord = track.chords[Math.floor(step / 8) % track.chords.length];
      if (step % 2 === 0) note(ctx, midi(chord[(step / 2) % 3] - 12), next, stepLen * 1.8, track.bass, track.bassVol ?? 0.16);
      const m = track.melody[step];
      if (m) note(ctx, midi(m), next, stepLen * 1.6, track.lead, track.leadVol ?? 0.12);
      next += stepLen;
      step = (step + 1) % track.melody.length;
    }
  }

  return {
    play(id) {
      this.stop();
      track = TRACKS[id];
      const ctx = getCtx();
      if (!track || !ctx) return;
      step = 0;
      next = ctx.currentTime + 0.1;
      timer = setInterval(tick, 60);
      tick();
    },
    stop() {
      clearInterval(timer);
      timer = 0;
    },
    get playing() { return Boolean(timer); },
  };
}
