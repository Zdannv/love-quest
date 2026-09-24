// Susunan level tiap dunia. Dipakai game (js/main.js) dan CMS (label "Level 4 · Cari yang Beda").
// Tiap dunia 12 level, semuanya jenis game beda.
// Angka 0–5 = level utama (pesan di `messages`); slot 3 & 4 bisa diganti jenis game lain lewat `slots`.
// Huruf a–f = stage tambahan (pesan di `stageMessages`).
export const PATTERN = ['memory', 'catch', 'pop', 'memory', 'catch', 'quiz'];
export const EXTRA_SLOTS = ['a', 'b', 'c', 'd', 'e', 'f'];

export const TYPE_NAME = {
  memory: 'Kartu Kembar', catch: 'Tangkap Cinta', pop: 'Tap si Imut', quiz: 'Kuis Sayang',
  puzzle: 'Puzzle Foto', odd: 'Cari yang Beda', simon: 'Ingat Urutan', fly: 'Terbang Tinggi',
  stack: 'Susun Kue', runner: 'Lari Lompat', throw: 'Lempar Hati', maze: 'Labirin Cinta', timing: 'Panah Cinta',
};

export const LEVEL_MAP = [
  { name: 'Taman Bunga', icon: '🌸', layout: [0, 1, 2, 'a', 3, 'c', 4, 'b', 'd', 'e', 'f', 5],
    slots: { 3: 'simon', 4: 'runner' },
    extras: { a: 'odd', b: 'maze', c: 'fly', d: 'timing', e: 'stack', f: 'throw' } },
  { name: 'Kota Permen', icon: '🍭', layout: [0, 1, 2, 'a', 3, 'c', 4, 'd', 'e', 'b', 'f', 5],
    slots: { 3: 'stack', 4: 'runner' },
    extras: { a: 'fly', b: 'odd', c: 'simon', d: 'throw', e: 'timing', f: 'maze' } },
  { name: 'Pantai Cinta', icon: '🏖️', layout: [0, 1, 2, 'a', 3, 'c', 4, 'e', 'f', 'd', 'b', 5],
    slots: { 3: 'runner', 4: 'stack' },
    extras: { a: 'simon', b: 'fly', c: 'odd', d: 'maze', e: 'throw', f: 'timing' } },
  { name: 'Langit Bintang', icon: '🌙', layout: [0, 1, 2, 'a', 'c', 'd', 'f', 'e', 'b', 3, 4, 5],
    slots: { 3: 'stack', 4: 'runner' },
    extras: { a: 'puzzle', b: 'simon', c: 'fly', d: 'odd', e: 'throw', f: 'timing' } },
  { name: 'Rumah Kita', icon: '🏡', layout: [0, 1, 2, 'a', 3, 'b', 'c', 4, 'd', 'e', 'f', 5],
    slots: { 3: 'runner', 4: 'simon' },
    extras: { a: 'stack', b: 'maze', c: 'throw', d: 'fly', e: 'odd', f: 'timing' } },
];

// Jenis game di satu slot
export function typeOf(wi, slot) {
  const w = LEVEL_MAP[wi];
  return typeof slot === 'number' ? (w.slots[slot] || PATTERN[slot]) : w.extras[slot];
}

// Daftar semua level berurutan + posisi pesannya, buat CMS.
export function levelList() {
  const out = [];
  let num = 0;
  LEVEL_MAP.forEach((w, wi) => {
    w.layout.forEach((slot) => {
      num++;
      if (typeof slot === 'number') {
        out.push({ num, world: wi, type: typeOf(wi, slot), field: 'messages', index: wi * 6 + slot });
      } else {
        out.push({ num, world: wi, type: typeOf(wi, slot), field: 'stageMessages', index: wi * 6 + EXTRA_SLOTS.indexOf(slot) });
      }
    });
    out.push({ num: null, world: wi, type: 'puzzle', field: 'bonusMessages', index: wi, bonus: true });
  });
  return out;
}
