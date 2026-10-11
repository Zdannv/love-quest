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
  race: 'Ngebut Pulang', fight: 'Gelut Sayang', penalty: 'Adu Penalti', pillow: 'Perang Bantal', cook: 'Masak Bareng',
  bomb: 'Bom Cinta', coop: 'Jalan Pulang Berdua',
};

// Tiap dunia 12 game beda, nggak ada yang dobel. Game seru yang baru lebih sering muncul.
// Urutan main: 0, 1, 2, a, 3, b, 4, c, d, e, f, 5 (5 = Kuis, isinya dari CMS).
const ORDER = [0, 1, 2, 'a', 3, 'b', 4, 'c', 'd', 'e', 'f', 5];
export const LEVEL_MAP = [
  { name: 'Taman Bunga', icon: '🌸', layout: ORDER,
    slots: { 0: 'memory', 1: 'race', 2: 'catch', 3: 'fight', 4: 'penalty' },
    extras: { a: 'coop', b: 'pop', c: 'cook', d: 'fly', e: 'bomb', f: 'pillow' } },
  { name: 'Kota Permen', icon: '🍭', layout: ORDER,
    slots: { 0: 'race', 1: 'stack', 2: 'fight', 3: 'penalty', 4: 'cook' },
    extras: { a: 'coop', b: 'odd', c: 'throw', d: 'bomb', e: 'timing', f: 'pillow' } },
  { name: 'Pantai Cinta', icon: '🏖️', layout: ORDER,
    slots: { 0: 'penalty', 1: 'memory', 2: 'bomb', 3: 'coop', 4: 'pillow' },
    extras: { a: 'race', b: 'simon', c: 'fight', d: 'cook', e: 'runner', f: 'maze' } },
  { name: 'Langit Bintang', icon: '🌙', layout: ORDER,
    slots: { 0: 'cook', 1: 'fight', 2: 'race', 3: 'bomb', 4: 'pillow' },
    extras: { a: 'puzzle', b: 'coop', c: 'penalty', d: 'catch', e: 'fly', f: 'stack' } },
  { name: 'Rumah Kita', icon: '🏡', layout: ORDER,
    slots: { 0: 'fight', 1: 'cook', 2: 'memory', 3: 'bomb', 4: 'pillow' },
    extras: { a: 'race', b: 'penalty', c: 'pop', d: 'throw', e: 'odd', f: 'timing' } },
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
