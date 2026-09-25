// ============================================================
//  LOVE QUEST — VERSI DEMO
//  {pasangan} = nama yang main (diisi pengunjung di halaman depan)
//  {pengirim} = nama yang ngasih game ini
// ============================================================

export const CONFIG = {
  // true = halaman demo. Otomatis jadi false kalau game pasangan (/c/<kode>) dimuat.
  demo: true,
  defaultNames: { pasangan: 'Ayang', pengirim: 'Aku' },

  // Diisi dari CMS untuk tiap pasangan (lihat js/boot.js). Di demo pakai nilai bawaan ini.
  names: null,              // { pasangan, pengirim }
  music: 'ceria',           // id lagu dari js/audio.js (TRACKS) atau 'off'
  theme: 'pink',            // id tema dari js/themes.js (paket Premium)
  characters: { pasangan: 'owl', pengirim: 'cat' }, // id karakter dari js/themes.js (paket Premium)
  photos: { icon: null, letter: null, bonus: [null, null, null, null, null], faces: { pasangan: null, pengirim: null } },

  // Supabase untuk CMS (project khusus bisnis ini, terpisah dari project lain).
  cloud: {
    url: 'https://paymeqnshhmjqypergji.supabase.co',
    anonKey: 'sb_publishable_pDiStBz1jEdLO9q3AOB3Bw_RfeZP57y', // publishable key (aman ditaruh di sini)
    pushFunction: 'streak-push', // nama edge function pengirim notifikasi (harus sama persis dengan di Supabase)
    ownerFunction: 'owner-accounts', // nama edge function buat bikin/kelola akun pembeli dari /owner
    vapidPublicKey: 'BCcMyl6pfxXERZ0HZOe1KW2DpU3Egb5i1Jzj3eUmtA_PLs2S9i5v52oAxWBfRpjxaK051rZtJ0G4-2o9Cp4XYN0',
  },

  // Link pemesanan, contoh: 'https://wa.me/6281234567890?text=Halo%2C%20mau%20pesan%20Love%20Quest'
  // Kalau kosong, tombol pesan disembunyikan.
  orderUrl: 'https://wa.me/6285136086902?text=' + encodeURIComponent('Halo! Aku mau pesan Love Quest 💖'),
  whatsapp: '6285136086902', // dipakai juga di CMS buat bayar / upgrade paket

  // Model: sekali bayar, akses selamanya (nggak ada biaya bulanan).
  // Upgrade Love Quest → Premium = bayar selisihnya (Rp20.000).
  packages: [
    {
      name: 'Love Quest',
      price: 'Rp29.000',
      per: 'sekali bayar',
      note: 'Akses selamanya, tanpa biaya bulanan.',
      tag: 'Paling pas buat mulai',
      features: [
        'Akun CMS (halaman admin) pribadi buat ngelola isi game sendiri, kapan aja, langsung dari HP',
        'Yang bisa kamu ganti: nama kalian, pesan tiap level, kuis, surat, foto surat & 5 puzzle foto',
        'Perubahan langsung muncul di game pasanganmu, nggak perlu kirim link baru',
        '60 level + 5 bonus puzzle foto: 5 dunia, tiap dunia 12 game yang beda-beda',
        '13 jenis mini-game (terbang, lari, labirin, susun kue, lempar hati, dll.)',
        'Streak berdua + notifikasi pengingat jam 7 malam',
        'Bisa dipasang di home screen & tetap bisa dimainin offline',
      ],
    },
    {
      name: 'Love Quest Premium',
      price: 'Rp49.000',
      per: 'sekali bayar',
      note: 'Akses selamanya. Udah punya Love Quest? Upgrade ke Premium cukup Rp20.000.',
      tag: 'Tampilan khusus buat kalian',
      features: [
        'Semua isi paket Love Quest',
        'Muka, logo, tema, karakter & lagu juga bisa kamu atur dan ganti sendiri kapan aja di CMS',
        'Muka kalian jadi karakter game: yang terbang, lari, sampai target lempar hati',
        'Logo aplikasi di HP pakai foto kalian',
        'Tema warna pilihan kalian (6 pilihan)',
        'Karakter hewan kesukaan kalian (14 pilihan)',
        '4 pilihan lagu',
      ],
    },
  ],

  // Pesan untuk level utama (6 per dunia, urut dunia 1 → 5)
  messages: [
    "Level pertama beres! {pasangan} emang jago dari awal, kayak waktu {pasangan} bikin {pengirim} jatuh cinta 😳", // Dunia 1
    "{pasangan} jago nangkep yaa… kayak hati {pengirim} yang udah lama ketangkep sama {pasangan} hehe 🧺",
    "Gemes banget sih mainnya. Eh, tapi yang main lebih gemes lagii 🐰",
    "Ingatan {pasangan} hebat banget! Semoga selalu inget juga kalau {pengirim} sayang {pasangan} 💕",
    "{pasangan} makin jago aja! {pengirim} bangga banget punya {pasangan} ✨",
    "Dunia Taman Bunga selesai! Tapi bunga paling cantik ya tetep {pasangan} 🌸",
    "Permennya emang manis, tapi tetep {pasangan} yang paling manis buat {pengirim} 🍭", // Dunia 2
    "{pasangan} tuh kayak gula, bikin hari-hari {pengirim} jadi manis terus 🍬",
    "Tap tap tap! Kalau {pengirim} jadi {karakter2} itu, maunya dielus {pasangan} terus hehe",
    "Makasih ya udah sabar sama {pengirim} selama ini 🥹",
    "Skill {pasangan} naik terus, kayak rasa sayang {pengirim} yang naik tiap hari hehe 📈",
    "Kota Permen beres! {pasangan} itu hadiah paling manis yang pernah {pengirim} dapet 🎁",
    "Pantai Cinta! Pengen deh liat sunset bareng {pasangan} 🌅", // Dunia 3
    "Ombak aja kalah sama semangat {pasangan} 🌊",
    "Senyum {pasangan} itu vitamin buat {pengirim} ☀️",
    "Ayoo tinggal dikit lagi! {pengirim} tau {pasangan} bisa 💪",
    "Keren banget! {pasangan} emang hebat 🥹",
    "Pantai Cinta beres! Sama {pasangan}, ke mana pun rasanya jadi seru 🏝️",
    "Dari miliaran bintang, {pengirim} tetep milih {pasangan} ⭐", // Dunia 4
    "Kalau {pasangan} lagi capek, inget ya: ada {pengirim} yang selalu di sini 🌙",
    "{pasangan} bersinar banget, bintangnya sampe minder ✨",
    "Kuenya tinggi banget sampe ke bintang! {pasangan} emang jago 🎂✨",
    "Satu level lagi! Semangat {pasangan} 🔥",
    "Dunia Langit Bintang beres! Eits, masih ada satu dunia lagi: rumah kita 🏡",
    "Selamat datang di rumah kita! 🏡 Dunia terakhir, ayo {pasangan}!", // Dunia 5
    "Nangkepnya jago banget, kayak {pasangan} yang udah nangkep hati {pengirim} dari lama 🧺",
    "{karakter}{karakter2} muncul terus, soalnya mereka kangen {pasangan} hehe",
    "{pengirim} lari-lari terus, kayak {pengirim} yang lari ke {pasangan} tiap kangen 🏃",
    "Ingatan {pasangan} kuat banget, jangan lupa inget juga semua momen kita yaa 🎵",
    "Yeay tamat! Makasih udah main sampai habis, sekarang buka suratnya yaa 💖",
  ],

  // Pesan stage tambahan (6 per dunia, urut a–f; nomor level ada di komentar)
  stageMessages: [
    "Mata {pasangan} jeli banget! Di mata {pengirim}, {pasangan} yang paling beda sendiri, paling cantik 👀", // Dunia 1 · Level 4 · Cari yang Beda
    "{pasangan} nemu jalan ke {pengirim}! Emang dari awal jalannya ke sini hehe 💞", // Dunia 1 · Level 8 · Labirin Cinta
    "{pasangan} terbang tinggi, kayak perasaan {pengirim} tiap liat {pasangan} 🕊️", // Dunia 1 · Level 6 · Terbang Tinggi
    "Tepat sasaran! Panah cinta {pasangan} kena terus ke hati {pengirim} 💘", // Dunia 1 · Level 9 · Panah Cinta
    "Kuenya tinggi banget! Nanti kita makan kue beneran bareng yaa 🎂", // Dunia 1 · Level 10 · Susun Kue
    "{pengirim} kena lempar hati terus 😆 dari dulu emang udah kena hati {pasangan} sih 🎯", // Dunia 1 · Level 11 · Lempar Hati

    "{pasangan} gemesin banget pas terbang hehe 🕊️", // Dunia 2 · Level 16 · Terbang Tinggi
    "Nemu lagi! Hati {pengirim} juga udah lama ketemu sama {pasangan} kan 🔍", // Dunia 2 · Level 22 · Cari yang Beda
    "Urutannya hafal semua! Pinter banget sih 🎵", // Dunia 2 · Level 18 · Ingat Urutan
    "Lemparannya jago! Kena {pengirim} terus, gapapa kok rela 😝🎯", // Dunia 2 · Level 20 · Lempar Hati
    "Pas banget di tengah! {pasangan} emang selalu tepat, termasuk pas milih {pengirim} hehe 💘", // Dunia 2 · Level 21 · Panah Cinta
    "Labirinnya muter-muter tapi tetep ketemu, kayak takdir hehe 🧭💖", // Dunia 2 · Level 23 · Labirin Cinta

    "{karakter}{karakter2} aja seneng dipencet {pasangan}, apalagi {pengirim}", // Dunia 3 · Level 28 · Ingat Urutan
    "Satu lagi di dunia ini! {pengirim} tau {pasangan} pasti bisa 🔥", // Dunia 3 · Level 35 · Terbang Tinggi
    "Mata {pasangan} tajem banget, nggak ada yang lolos 🔍", // Dunia 3 · Level 30 · Cari yang Beda
    "Sejauh apa pun jalannya, {pasangan} pasti sampe ke {pengirim} 🥹", // Dunia 3 · Level 34 · Labirin Cinta
    "Ombak boleh ganti-ganti, tapi sayang {pengirim} ke {pasangan} tetep sama 🌊", // Dunia 3 · Level 32 · Lempar Hati
    "Bidikan {pasangan} tepat banget, kayak {pasangan} yang tepat sasaran di hati {pengirim} 💘", // Dunia 3 · Level 33 · Panah Cinta

    "Lucu yaa kalian berdua di foto ini 💖", // Dunia 4 · Level 40 · Puzzle Foto
    "{pasangan} jago banget, padahal levelnya udah susah loh 😳", // Dunia 4 · Level 45 · Ingat Urutan
    "{pasangan} terbang sampe ke bintang, kayak {pasangan} yang bikin hari {pengirim} bersinar ✨", // Dunia 4 · Level 41 · Terbang Tinggi
    "Dari semua bintang, yang paling bersinar tetep {pasangan} ⭐", // Dunia 4 · Level 42 · Cari yang Beda
    "{pengirim} kena lagi 😆 lempar terus, nggak bakal kabur kok 🎯", // Dunia 4 · Level 44 · Lempar Hati
    "Makin susah tapi tetep kena! {pasangan} emang jago banget 💘", // Dunia 4 · Level 43 · Panah Cinta

    "Kue di rumah kita tinggi banget! Nanti bikin kue beneran bareng yuk 🎂", // Dunia 5 · Level 52 · Susun Kue
    "Di rumah kita nanti nggak perlu labirin, tinggal peluk aja hehe 🤗🏡", // Dunia 5 · Level 54 · Labirin Cinta
    "Kena lagi! {pengirim} nyerah deh, emang dari awal udah kalah sama {pasangan} 😆🎯", // Dunia 5 · Level 55 · Lempar Hati
    "{pasangan} terbang tinggi banget! Lucu banget sih 🕊️", // Dunia 5 · Level 57 · Terbang Tinggi
    "Yang beda ketemu terus! Tapi buat {pengirim}, {pasangan} itu nggak ada duanya 🔍", // Dunia 5 · Level 58 · Cari yang Beda
    "Hampir beres nih… makasih udah mainin game dari {pengirim} 🥰", // Dunia 5 · Level 59 · Panah Cinta
  ],

  // Pesan setelah level Bonus Puzzle Foto di akhir tiap dunia
  bonusMessages: [
    "Fotonya udah utuh lagi! Kalian lucu banget sih 📸💖",
    "Puzzle foto kedua beres! {pengirim} seneng liat {pasangan} main 🥰",
    "Makin jago nyusun foto, kayak nyusun kenangan bareng {pengirim} 🧩",
    "Puzzle versi susah beres! {pasangan} emang juara 🏆",
    "Puzzle terakhir beres! Makasih udah main sampai habis, love you {pasangan} 💖",
  ],

  // Kuis di akhir tiap dunia. answer: -1 = semua jawaban benar 😆
  quiz: [
    [
      { q: 'Siapa yang paling lucu sedunia?', options: ['{pasangan}', '{pasangan} banget', '{pasangan} pastinya', '{pasangan} 💖'], answer: -1, yes: 'Nggak ada jawaban salah, semuanya {pasangan} 😝' },
      { q: 'Berapa persen {pengirim} sayang {pasangan}?', options: ['50%', '99%', '100%', 'Tak terhingga ♾️'], answer: 3, yes: 'Betul! Nggak bisa diukur pakai angka 🥰' },
      { q: 'Kalau {pasangan} lagi bad mood, {pengirim} harus ngapain?', options: ['Diemin aja', 'Beliin makanan 🍜', 'Peluk 🤗', 'Beliin makanan terus peluk'], answer: 3, yes: 'Paket komplit! Siap laksanakan 🫡' },
    ],
    [
      { q: 'Apa yang paling {pengirim} suka dari {pasangan}?', options: ['Senyumnya', 'Ketawanya', 'Semuanya 💕', 'Pas ngambek lucu'], answer: 2, yes: 'Iya, semuanya! 😚' },
      { q: 'Kalau {pasangan} minta dipeluk jam 2 pagi, {pengirim}…', options: ['Pura-pura tidur', 'Langsung datang 🏃', 'Kirim stiker peluk', 'Peluk guling'], answer: 1, yes: 'Langsung meluncur! 🚀' },
      { q: 'Kalau {pengirim} telat bales chat, artinya…', options: ['Lupa', 'Lagi sibuk tapi tetep mikirin {pasangan}', 'Ketiduran 😴', 'Lupa tapi boong'], answer: 1, yes: 'Selalu kepikiran kok 🧠💖' },
    ],
    [
      { q: 'Emoji yang paling cocok buat {pasangan}?', options: ['🐰', '🌸', '☀️', 'Semuanya!'], answer: 3, yes: 'Lucu, cantik, dan bikin hangat ✨' },
      { q: 'Cara paling ampuh baikan kalau lagi ngambek?', options: ['Minta maaf', 'Bawain jajan 🍰', 'Gombalin', 'Semua jurus sekaligus'], answer: 3, yes: 'Combo attack! 💥💖' },
      { q: 'Tempat terbaik di dunia menurut {pengirim}?', options: ['Pantai', 'Gunung', 'Di samping {pasangan} 🥹', 'Kasur'], answer: 2, yes: 'Di mana pun, asal sama {pasangan} 🥹' },
    ],
    [
      { q: 'Kita cocoknya disebut…', options: ['Temen', 'Partner in crime', 'Pasangan paling lucu', 'B dan C'], answer: 3, yes: 'Partner in crime paling lucu 😎💕' },
      { q: 'Seberapa beruntung {pengirim} punya {pasangan}?', options: ['Beruntung banget', 'Paling beruntung 🍀', 'Nggak bisa diukur', 'Semua di atas'], answer: -1, yes: 'Semuanya bener 🍀' },
      { q: 'Pertanyaan terakhir: mau terus bareng?', options: ['Iya 💖', 'Iya dong!!', 'Pastinya 🥰', 'Selamanya ♾️'], answer: -1, yes: 'Yeay!! 🥹💖' },
    ],

    [
      { q: 'Kalau kita punya rumah nanti, harus ada apa?', options: ['{karakter}', '{karakter2}', 'Dapur buat bikin kue 🎂', 'Semuanya dong!'], answer: 3, yes: 'Setuju! Rumah kita harus lengkap 🏡' },
      { q: 'Hal pertama yang {pengirim} lakuin kalau ketemu {pasangan}?', options: ['Say hi 👋', 'Peluk 🤗', 'Cubit pipi', 'Peluk terus cubit pipi'], answer: 3, yes: 'Hehe bener, dua-duanya wajib 😝' },
      { q: 'Seberapa sayang {pengirim} sama {pasangan}?', options: ['Sayang', 'Sayang banget', 'Sayang banget banget', 'Nggak bisa dihitung ♾️'], answer: -1, yes: 'Semuanya bener, sayangnya nggak ada ujungnya 💖' },
    ],  ],

  finalLetter: `Hai {pasangan} sayang,

Kalau kamu lagi baca ini, berarti kamu udah main game kecil yang {pengirim} bikin khusus buat kamu. Hebat banget! 🥳

Setiap level, setiap pesan, dan setiap hati yang kamu tangkep, semuanya {pengirim} siapin sambil mikirin kamu.

Makasih ya udah jadi orang yang bikin hari-hari {pengirim} lebih berwarna.

Sayang kamu, hari ini, besok, dan seterusnya 💖`,
};
