// Contoh "versi jadi" buat halaman depan: pasangan fiktif yang sudah di-custom lengkap.
// Dibuka lewat /?lihat=<id>. Semuanya lokal (tanpa database). Pakai foto asli (atas izin yang punya foto).
const IMG = '/img/contoh/';

export const SHOWCASES = {
  'kirana-arga': {
    tagline: 'Pakai foto asli · Tema Biru Langit · 🐹🦊 · lagu Lucu',
    names: { pasangan: 'Kirana', pengirim: 'Arga' },
    theme: 'sky',
    characters: { pasangan: 'hamster', pengirim: 'fox' },
    music: 'lucu',
    photo: 'kirana-arga.jpg',
    faces: { pasangan: 'kirana.jpg', pengirim: 'arga.jpg' },
    messages: {
      0: 'Level pertama beres! Liat deh, kartunya ada muka kita hehe 📸',
      2: 'Jago banget nge-tap muka Arga, kayak pas kamu nyubit pipi aku 😤',
    },
    finalLetter: `Hai Kirana,

Selamat udah namatin semua level! Tiap foto di game ini Arga pilih satu-satu, soalnya tiap foto ada ceritanya.

Makasih udah jadi tempat pulang paling nyaman. Masih banyak level yang mau aku lewatin bareng kamu 💙`,
  },
};

// Isi CONFIG dari contoh yang dipilih
export function applyShowcase(CONFIG, id) {
  const s = SHOWCASES[id];
  if (!s) return false;
  CONFIG.demo = false;
  CONFIG.showcase = id;
  CONFIG.slug = `contoh-${id}`;
  CONFIG.names = { ...s.names };
  CONFIG.theme = s.theme;
  CONFIG.characters = { ...s.characters };
  CONFIG.music = s.music;
  CONFIG.photos = {
    letter: IMG + s.photo,
    bonus: CONFIG.photos.bonus.map(() => IMG + s.photo),
    faces: { pasangan: IMG + s.faces.pasangan, pengirim: IMG + s.faces.pengirim },
  };
  CONFIG.messages = CONFIG.messages.map((m, i) => s.messages[i] ?? m);
  CONFIG.finalLetter = s.finalLetter;
  return true;
}
