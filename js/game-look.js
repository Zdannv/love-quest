// Tampilan kartu game di menu (Pilih game & Main Berdua): warna khas tiap game, ikon 3D besar, label singkat.
export const GAME_COLOR = {
  bomb: '#ff4d4d', coop: '#3fa9f5', sumo: '#ff8a5c', math: '#4c8dff', balloon: '#ff7aa8',
  race: '#ff7a45', fight: '#ff4f8b', penalty: '#22b573', pillow: '#9b7bff', cook: '#ff9f1c',
  fly: '#3fa9f5', runner: '#ff8f3f', stack: '#ec5fa6', catch: '#ff5c8a', timing: '#f2456b', simon: '#6c74ff',
  memory: '#2fb3e6', pop: '#f0a500', puzzle: '#2fb36f', odd: '#14b3a3', throw: '#ff6f91', maze: '#a66bff', quiz: '#ff70b8',
  flyco: '#3fa9f5', tebak: '#ff5c8a', samaan: '#ec5fa6', memoryco: '#2fb3e6', simonco: '#6c74ff', popco: '#f0a500',
  catchco: '#ff5c8a', stackco: '#ec5fa6', throwco: '#ff6f91', pictio: '#ff8f3f', draw: '#14b3a3', talk: '#9b7bff',
};
export const GAME_SUB = {
  bomb: 'Taruh bom, kabur, menang!', coop: 'Api & air, kerja sama', sumo: 'Dorong lawan keluar matras', math: 'Adu cepet ngitung', balloon: 'Terbang bareng, harus kompak',
  race: 'Balapan motor', fight: 'Duel gelut', penalty: 'Tendang & jaga gawang', pillow: 'Lempar-lemparan bantal', cook: 'Masak & sajiin pesanan',
  fly: 'Tap buat terbang', runner: 'Lompatin rintangan', stack: 'Susun setinggi-tingginya', catch: 'Tangkap yang jatuh', timing: 'Tap pas di zona',
  simon: 'Ingat urutannya', memory: 'Cari kartu kembar', pop: 'Tap secepatnya', puzzle: 'Susun foto kalian', odd: 'Cari yang beda',
  throw: 'Lempar ke target', maze: 'Cari jalan keluar', quiz: 'Jawab soal tentang kalian',
  flyco: 'Terbang bareng', tebak: 'Seberapa kenal?', samaan: 'Jawaban kalian sama?', memoryco: 'Buka kartu gantian', simonco: 'Ingat urutan bareng',
  popco: 'Skor dijumlah', catchco: 'Skor dijumlah', stackco: 'Skor dijumlah', throwco: 'Skor dijumlah',
  pictio: 'Gambar, pasangan nebak', draw: 'Gambar di udara', talk: 'Kartu obrolan',
};
const PALETTE = ['#ff5c8a', '#6c74ff', '#2fb3e6', '#ff9f1c', '#22b573', '#a66bff'];
export const gameColor = (id) => GAME_COLOR[id] || PALETTE[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

// attr = atribut data-* buat tombolnya (yang dipakai click handler)
export function gameTile({ id, attr, icon, name, sub, tag, disabled }) {
  return `<button type="button" class="gt" ${attr} style="--g:${gameColor(id)}" ${disabled ? 'disabled' : ''}>
    <span class="gt-icon">${icon}</span>
    <b class="gt-name">${name}</b>
    <small class="gt-sub">${sub ?? GAME_SUB[id] ?? ''}</small>
    ${tag ? `<span class="gt-tag">${tag}</span>` : ''}
  </button>`;
}
export const gameHead = (title, sub) => `<div class="gt-head"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
