// Bank soal game berdua.
// TEBAK: satu orang jawab tentang dirinya, pasangannya nebak.
// SAMAAN: dua-duanya pilih tanpa ngobrol, sehati kalau jawabannya sama.
// Soal yang udah keluar diingat, jadi nggak cepet keulang.

export const TEBAK = [
  ['Kalau aku lagi ngambek, yang paling ampuh bikin baikan', ['Dipeluk 🤗', 'Dibeliin makanan 🍜', 'Didiemin dulu 🤐', 'Digombalin 😚']],
  ['Love language aku yang paling kerasa', ['Kata-kata manis 💬', 'Pelukan 🫂', 'Waktu bareng ⏳', 'Hadiah kecil 🎁']],
  ['Hal yang paling bikin aku salting', ['Dipuji 🥹', 'Diliatin lama 👀', 'Dichat tiba-tiba 📱', 'Digandeng 🤝']],
  ['Kebiasaan aku pas lagi gabut', ['Scroll TikTok 📱', 'Tidur 😴', 'Ngemil 🍿', 'Nge-chat kamu 💌']],
  ['Hal yang paling aku takutin', ['Kecoa 🪳', 'Gelap 🌑', 'Ketinggian 🎢', 'Kehilangan kamu 🥺']],
  ['Momen favorit aku sama kamu', ['Jalan-jalan 🚶', 'Ngobrol malem 🌙', 'Makan bareng 🍱', 'Pas pertama ketemu ✨']],
  ['Kalau dapet duit kaget sejuta, aku bakal', ['Nabung 🐷', 'Jajan 🧋', 'Beliin kamu sesuatu 🎁', 'Checkout keranjang 🛒']],
  ['Kalau lagi sedih, aku biasanya', ['Diem aja 😶', 'Nangis 😭', 'Cerita ke kamu 💬', 'Tidur 😴']],
  ['Hadiah yang paling bikin aku seneng', ['Surat tulisan tangan ✉️', 'Bunga 💐', 'Makanan 🍫', 'Waktu kamu ⏰']],
  ['Hal yang paling nggak aku suka dari kamu', ['Telat bales chat 📵', 'Lupa makan 🍽️', 'Begadang 🌚', 'Cuek 🙄']],
  ['Kalau aku marah, aku biasanya', ['Langsung ngomong 🗣️', 'Diem 🤐', 'Ngambek 😤', 'Nangis 🥲']],
  ['Emoji yang paling sering aku pakai', ['😭', '🤣', '🥺', '🙂']],
  ['Aku paling gampang cemburu sama', ['Mantan kamu 👀', 'Temen deket kamu 👯', 'Idol / artis 🎤', 'Game kamu 🎮']],
  ['Jam tidur aku biasanya', ['Sebelum jam 10 😇', 'Jam 10–12 🌙', 'Lewat tengah malem 🦉', 'Nggak tentu 🤷']],
  ['Aku paling pengen dikasih kejutan pas', ['Ulang tahun 🎂', 'Anniversary 💍', 'Hari biasa aja 🌼', 'Pas lagi sedih 🫂']],
  ['Kalau kita berantem, yang biasanya minta maaf duluan', ['Aku 🙋', 'Kamu 🙇', 'Barengan 🤝', 'Pura-pura lupa aja 😆']],
  ['Kalau lagi di motor / mobil bareng, aku suka', ['Nyanyi 🎤', 'Ngobrol 💬', 'Diem liatin jalan 🌆', 'Foto-foto 📸']],
  ['Panggilan dari kamu yang paling aku suka', ['Sayang 💗', 'Namaku 😊', 'Panggilan lucu 🐣', 'Beb / ay 😚']],
  ['Makanan yang bisa bikin mood aku balik', ['Mie 🍜', 'Martabak 🥞', 'Es krim 🍦', 'Ayam geprek 🍗']],
  ['Aku lebih suka kencan', ['Pagi ☀️', 'Siang 🌤️', 'Sore 🌇', 'Malem 🌙']],
  ['Hal yang paling sering aku lupa', ['Naruh HP 📱', 'Makan 🍽️', 'Minum air 💧', 'Bales chat 💬']],
  ['Kalau aku jadi hewan, aku jadi', ['Kucing 🐱', 'Kelinci 🐰', 'Beruang 🐻', 'Rubah 🦊']],
  ['Film yang paling aku suka ditonton bareng', ['Horor 👻', 'Romantis 💕', 'Komedi 😂', 'Kartun 🎨']],
  ['Aku paling nggak tahan kalau', ['Laper 😫', 'Ngantuk 😪', 'Kepanasan 🥵', 'Dicuekin 😶']],
  ['Kalau dikasih bunga, aku maunya', ['Mawar 🌹', 'Tulip 🌷', 'Matahari 🌻', 'Mending makanan 😆']],
  ['Hal yang aku pikirin sebelum tidur', ['Kamu 💭', 'Tugas / kerjaan 📚', 'Besok makan apa 🍱', 'Hal random 🌀']],
  ['Kalau liburan, aku tim', ['Pantai 🏖️', 'Gunung ⛰️', 'Kota 🏙️', 'Rebahan di rumah 🛋️']],
  ['Cara aku nunjukin kangen', ['Spam chat 📱', 'Kirim stiker 🧸', 'Minta video call 📹', 'Diem tapi stalking 👀']],
  ['Minuman pesenan wajib aku', ['Kopi susu ☕', 'Matcha 🍵', 'Boba 🧋', 'Es teh 🧊']],
  ['Aku lebih suka dikasih kabar lewat', ['Chat panjang 📝', 'Voice note 🎙️', 'Telepon 📞', 'Foto random 📸']],
  ['Hal yang bikin aku ngerasa disayang', ['Didengerin 👂', 'Diingetin makan 🍚', 'Dijemput 🛵', 'Dipuji 🥰']],
  ['Kalau aku lagi capek banget, aku butuh', ['Dipeluk 🫂', 'Ditinggal tidur 😴', 'Dibeliin makan 🍜', 'Diajak jalan 🚶']],
  ['Superpower yang aku pengen', ['Teleport ✨', 'Baca pikiran 🧠', 'Ngilang 👻', 'Balik ke masa lalu ⏪']],
  ['Pas pertama kenal kamu, aku mikirnya', ['Lucu juga 😳', 'Kok nyebelin 😤', 'Biasa aja 😐', 'Kayaknya cocok 💘']],
  ['Kebiasaan aku pas nunggu kamu', ['Main HP 📱', 'Ngemil 🍫', 'Ngaca 🪞', 'Nge-spam chat 💬']],
  ['Kalau kita punya rumah, ruangan favorit aku', ['Kamar 🛏️', 'Dapur 🍳', 'Ruang TV 📺', 'Balkon 🌿']],
  ['Yang paling aku kangenin pas kita jauh', ['Suara kamu 🎧', 'Pelukan 🫂', 'Ketawa bareng 😂', 'Makan bareng 🍱']],
  ['Aku lebih pilih', ['Dikasih surprise 🎉', 'Direncanain bareng 🗓️', 'Dua-duanya 😆', 'Yang penting sama kamu 💗']],
  ['Kalau hujan, aku paling suka', ['Tidur 😴', 'Makan mie 🍜', 'Dengerin lagu 🎧', 'Hujan-hujanan 🌧️']],
  ['Hal kecil dari kamu yang paling aku suka', ['Senyum kamu 😊', 'Cara kamu ketawa 😂', 'Perhatian kamu 🥹', 'Suara kamu 🎶']],
];

export const SAMAAN = [
  ['Kencan impian kita', ['Piknik 🧺', 'Nonton konser 🎤', 'Staycation 🏨', 'Kulineran malem 🍢']],
  ['Kalau pelihara kucing, namanya', ['Mochi 🍡', 'Oyen 🧡', 'Boba 🧋', 'Cimol 🍥']],
  ['Kalau menang undian, pertama beli', ['Rumah 🏡', 'Mobil 🚗', 'Tiket liburan ✈️', 'Buat orang tua 💐']],
  ['Kalau kita jadi band, namanya', ['Duo Bucin 💞', 'Sayang Squad 🎸', 'Cinta Cenat Cenut 😆', 'Love Quest Band 🎮']],
  ['Kalau bisa teleport sekarang, ke', ['Tokyo 🗼', 'Paris 🥐', 'Bali 🌴', 'Rumah pasangan 🏠']],
  ['Kalau kisah kita jadi film, genrenya', ['Romcom 💕', 'Drama 😭', 'Horor komedi 👻', 'Action 💥']],
  ['Weekend paling ideal', ['Rebahan seharian 🛋️', 'Jalan pagi 🌅', 'Ngemall 🛍️', 'Maraton film 🍿']],
  ['Hadiah anniversary paling bermakna', ['Surat tangan ✉️', 'Album foto 📔', 'Barang couple 💍', 'Trip berdua 🧳']],
  ['Kalau bikin usaha bareng', ['Kafe ☕', 'Toko online 📦', 'Bakery 🥐', 'Jadi konten kreator 🎥']],
  ['Rumah impian kita', ['Minimalis di kota 🏙️', 'Rumah kayu di gunung 🏔️', 'Rumah deket pantai 🏖️', 'Apartemen tinggi 🌃']],
  ['Hewan peliharaan bareng', ['Kucing 🐱', 'Anjing 🐶', 'Kelinci 🐰', 'Ikan 🐠']],
  ['Makanan buat nemenin nonton', ['Popcorn 🍿', 'Martabak 🥞', 'Seblak 🌶️', 'Pizza 🍕']],
  ['Olahraga bareng yang paling asik', ['Jogging 🏃', 'Badminton 🏸', 'Renang 🏊', 'Sepedaan 🚴']],
  ['Kalau kita masak bareng, menunya', ['Nasi goreng 🍳', 'Pasta 🍝', 'Mie instan 😆', 'Kue 🎂']],
  ['Foto couple paling kita banget', ['Photobox 📸', 'Mirror selfie 🪞', 'Candid 🤳', 'Foto di pantai 🌅']],
  ['Tempat kencan pertama yang ideal', ['Kafe ☕', 'Taman 🌳', 'Bioskop 🎬', 'Pasar malam 🎡']],
  ['Kalau bikin tradisi tiap tahun', ['Liburan bareng ✈️', 'Nulis surat ✉️', 'Foto di tempat sama 📸', 'Nanem pohon 🌱']],
  ['Kalau kita tukeran badan sehari', ['Tidur aja 😴', 'Ngerjain tugas dia 📚', 'Jail ke temennya 😈', 'Makan sepuasnya 🍔']],
  ['Lagu buat nikahan nanti', ['Akustik 🎸', 'Jazz 🎷', 'Pop Indo 🇮🇩', 'K-pop 💜']],
  ['Pilih jajanan', ['Cilok 🍡', 'Batagor 🥟', 'Cireng 🍘', 'Telur gulung 🥚']],
  ['Kalau nonton konser bareng, konser', ['Band indie 🎸', 'Idol K-pop 💜', 'Penyanyi pop 🎤', 'Orkestra 🎻']],
  ['Kegiatan pas malem minggu', ['Nongkrong 🍻', 'Nonton di rumah 📺', 'Jalan-jalan 🚗', 'Video call aja 📱']],
  ['Kalau kita punya anak, kita jadi orang tua yang', ['Santai 😌', 'Disiplin 📏', 'Lucu 🤪', 'Protektif 🛡️']],
  ['Destinasi honeymoon', ['Maldives 🏝️', 'Swiss 🏔️', 'Jepang 🌸', 'Labuan Bajo 🐉']],
  ['Kalau cuma boleh bawa satu barang ke pulau kosong', ['HP 📱', 'Makanan 🍫', 'Pasangan 💑', 'Kasur 🛏️']],
  ['Hal paling romantis', ['Makan malam lilin 🕯️', 'Surat cinta ✉️', 'Dansa di dapur 💃', 'Liat bintang bareng 🌌']],
  ['Kalau lagi LDR, cara paling asik', ['Video call sambil tidur 📹', 'Nonton bareng online 🎬', 'Kirim paket 📦', 'Main game online 🎮']],
  ['Kalau dapet libur seminggu', ['Road trip 🚗', 'Rebahan 🛋️', 'Staycation 🏨', 'Main ke rumah keluarga 🏡']],
  ['Hadiah ultah paling seru', ['Kue buatan sendiri 🎂', 'Barang incaran 🛍️', 'Kejutan rame-rame 🎉', 'Makan berdua 🍽️']],
  ['Kalau kita jadi karakter game, kita', ['Petualang 🗡️', 'Petani 🌾', 'Penyihir 🪄', 'Koki 🍳']],
  ['Kalau ada waktu 1 jam lagi bareng, kita', ['Ngobrol 💬', 'Pelukan 🫂', 'Makan 🍜', 'Foto-foto 📸']],
  ['Minuman buat kencan sore', ['Es kopi ☕', 'Jus buah 🧃', 'Teh manis 🍵', 'Soda 🥤']],
  ['Cuaca buat jalan-jalan', ['Cerah ☀️', 'Mendung adem ☁️', 'Abis hujan 🌈', 'Malem dingin 🌙']],
  ['Cara ngerayain hari jadian', ['Makan di tempat pertama ketemu 🍽️', 'Tuker surat ✉️', 'Staycation 🏨', 'Main seharian 🎡']],
  ['Hobi baru yang mau dicoba bareng', ['Masak 🍳', 'Melukis 🎨', 'Main musik 🎸', 'Berkebun 🌱']],
  ['Kalau bikin playlist berdua, isinya', ['Lagu galau 🥲', 'Lagu semangat 💪', 'Lagu jadul 📻', 'Lagu cinta 💕']],
  ['Kalau kita jadi makanan, kita', ['Nasi & lauk 🍛', 'Roti & selai 🍞', 'Mie & telur 🍜', 'Es krim & cone 🍦']],
  ['Tempat paling nyaman buat ngobrol', ['Kamar 🛏️', 'Mobil 🚗', 'Kafe ☕', 'Teras rumah 🏡']],
  ['Kalau kita bisa ngulang satu hari', ['Hari pertama ketemu ✨', 'Hari jadian 💘', 'Liburan pertama 🧳', 'Hari biasa yang seru 🌼']],
  ['Pilih kekuatan buat pasangan', ['Selalu tau aku laper 🍔', 'Selalu tau aku sedih 🥺', 'Bisa teleport ke aku ✨', 'Nggak pernah telat 🕐']],
];

// Pilih n soal yang belum lama keluar (riwayat disimpan di HP ini)
const HIST = (kind) => `lq-q-${kind}`;
export function pickQuestions(kind, n) {
  const bank = kind === 'samaan' ? SAMAAN : TEBAK;
  let used = [];
  try { used = JSON.parse(localStorage.getItem(HIST(kind)) || '[]'); } catch {}
  let fresh = bank.map((_, i) => i).filter((i) => !used.includes(i));
  if (fresh.length < n) { used = []; fresh = bank.map((_, i) => i); }
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  return fresh.slice(0, n);
}
export function markQuestions(kind, ids) {
  const bank = kind === 'samaan' ? SAMAAN : TEBAK;
  let used = [];
  try { used = JSON.parse(localStorage.getItem(HIST(kind)) || '[]'); } catch {}
  used = [...used, ...ids].filter((v, i, a) => a.indexOf(v) === i);
  if (used.length >= bank.length) used = ids.slice();
  try { localStorage.setItem(HIST(kind), JSON.stringify(used)); } catch {}
}
export const questionOf = (kind, i) => (kind === 'samaan' ? SAMAAN : TEBAK)[i];
