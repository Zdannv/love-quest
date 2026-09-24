// Contoh "versi jadi" buat halaman depan: pasangan fiktif yang sudah di-custom lengkap.
// Dibuka lewat /?lihat=<id>. Semuanya lokal (tanpa database), muka & foto pakai gambar kartun.
const IMG = '/img/contoh/';

export const SHOWCASES = {
  'nadia-raka': {
    tagline: 'Tema Lavender · 🐰🐻 · lagu Romantis',
    names: { pasangan: 'Nadia', pengirim: 'Raka' },
    theme: 'lavender',
    characters: { pasangan: 'rabbit', pengirim: 'bear' },
    music: 'romantis',
    photo: 'nadia-raka.jpg',
    faces: { pasangan: 'nadia.jpg', pengirim: 'raka.jpg' },
    messages: {
      0: 'Level pertama beres! Inget nggak pertama kali kita ketemu di kafe deket kampus? ☕',
      5: 'Taman Bunga beres! Kayak bunga matahari yang kamu kasih pas aku sidang 🌻',
    },
    finalLetter: `Hai Nadia,

Makasih udah main sampai habis. Setiap level ini Raka bikin sambil inget semua hal kecil tentang kamu: kopi susu kesukaanmu, lagu yang kamu nyanyiin pas macet, dan cara kamu ketawa.

Selamat 2 tahun ya, sayang. Masih banyak level yang mau aku jalanin bareng kamu 💜`,
  },
  'salsa-dimas': {
    tagline: 'Tema Mint · 🐱🐶 · lagu Ceria',
    names: { pasangan: 'Salsa', pengirim: 'Dimas' },
    theme: 'mint',
    characters: { pasangan: 'cat', pengirim: 'dog' },
    music: 'ceria',
    photo: 'salsa-dimas.jpg',
    faces: { pasangan: 'salsa.jpg', pengirim: 'dimas.jpg' },
    messages: {
      0: 'Level pertama beres! Jago banget, kayak kamu pas nebak plot twist film horor 🍿',
      1: 'Nangkepnya jago! Kayak kamu yang selalu nangkep kode-kode aku hehe 🧺',
    },
    finalLetter: `Hai Salsa,

Happy birthday! 🎂 Game ini hadiah kecil dari Dimas biar kamu senyum tiap hari, walaupun kita lagi LDR.

Tiap kamu main, anggap aja aku lagi nemenin di sebelahmu. Sebentar lagi kita ketemu ya 💚`,
  },
  'ayu-bima': {
    tagline: 'Tema Peach Sunset · 🐼🐧 · lagu Santai',
    names: { pasangan: 'Ayu', pengirim: 'Bima' },
    theme: 'peach',
    characters: { pasangan: 'panda', pengirim: 'penguin' },
    music: 'santai',
    photo: 'ayu-bima.jpg',
    faces: { pasangan: 'ayu.jpg', pengirim: 'bima.jpg' },
    messages: {
      0: 'Level pertama beres! Semangat kayak kamu pas lari pagi di GBK 🏃‍♀️',
      11: 'Kota Permen beres! Nanti kita beli martabak manis kesukaanmu ya 🥞',
    },
    finalLetter: `Hai Ayu,

Maaf ya kemarin aku bikin kamu kesel. Game ini cara aku bilang: aku sayang kamu, dan aku mau terus belajar jadi lebih baik buat kamu.

Kalau udah tamat, kabarin aku. Martabaknya aku yang traktir 🧡`,
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
