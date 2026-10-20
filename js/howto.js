// Kartu "Cara Main" sebelum game mulai: 2–3 langkah bergambar (animasi jari di HP, tombol keyboard di laptop).
// Muncul otomatis pertama kali tiap jenis game, habis itu bisa dibuka lagi lewat tombol ❓ di atas.
// Main Berdua: dua-duanya pencet "Siap!" dulu baru hitung mundur (ada batas waktu biar nggak nyangkut).
import { isDesktop, esc } from './util.js';

// g = gerakan yang dianimasiin: tap · tap2 · swipe (kiri-kanan) · hold (tahan) · flick (tarik ke atas) · stick (joystick) · btn (tombol bulat) · draw (gambar garis)
// k = tombol keyboard pengganti di laptop (kalau kosong: pakai mouse, gambarnya tetap jari)
const S = (g, t, k, td) => ({ g, t, k, td }); // td = teks khusus laptop (kalau beda)
export const HOWTO = {
  memory: { goal: 'Temuin semua pasangan kartu yang sama', steps: [S('tap2', 'Tap 2 kartu buat dibuka'), S('ok', 'Gambarnya sama? Kartunya tetap kebuka'), S('clock', 'Selesaiin sebelum waktunya habis')] },
  catch: { goal: 'Tangkap yang bagus, hindari yang jelek', steps: [S('swipe', 'Geser jari kiri-kanan buat gerakin keranjang', 'A D / ← →', 'Gerakin keranjang kiri-kanan (atau pakai mouse)'), S('ok', 'Tangkap 💖 & 🍓, hindari 💔'), S('star', 'Kejar targetnya sebelum waktu habis')] },
  pop: { goal: 'Tap yang muncul secepat mungkin', steps: [S('tap', 'Tap yang nongol dari lubang'), S('star', 'Yang emas = +3 poin'), S('no', 'Jangan tap yang jelek, poinnya berkurang')] },
  puzzle: { goal: 'Susun lagi foto kalian sampai utuh', steps: [S('tap2', 'Tap 2 kepingan buat tukar tempat'), S('hold', 'Tahan tombol 👀 buat intip fotonya'), S('ok', 'Semua di tempatnya = menang!')] },
  odd: { goal: 'Cari satu yang beda', steps: [S('eye', 'Perhatiin semua gambarnya'), S('tap', 'Tap yang beda sendiri'), S('no', 'Salah tap = waktu dipotong 3 detik')] },
  simon: { goal: 'Ingat & ulangi urutannya', steps: [S('eye', 'Perhatiin urutan tombol yang nyala'), S('tap', 'Tap tombolnya dengan urutan yang sama'), S('star', 'Tiap ronde urutannya nambah satu')] },
  fly: { goal: 'Terbang lewatin celah bunga', steps: [S('tap', 'Tap buat naik, lepas buat turun', 'Spasi / ↑', 'Tekan buat naik, lepas buat turun'), S('no', 'Jangan nabrak tiang bunga'), S('ok', 'Ambil 💖 buat bonus')] },
  stack: { goal: 'Susun kue setinggi mungkin', steps: [S('tap', 'Tap pas lapisannya di atas kue', 'Spasi', 'Tekan pas lapisannya di atas kue'), S('no', 'Yang kelebihan kepotong, kuenya makin kecil'), S('star', 'Pas banget = Perfect ✨')] },
  runner: { goal: 'Lari & lompatin rintangan', steps: [S('tap', 'Tap buat lompat', 'Spasi / ↑', 'Tekan buat lompat'), S('tap2', 'Tap lagi di udara = lompat dua kali', 'Spasi 2x', 'Tekan lagi di udara = lompat dua kali'), S('clock', 'Bertahan sampai waktunya habis')] },
  throw: { goal: 'Lempar 💖 kena target', steps: [S('eye', 'Targetnya gerak kiri-kanan'), S('tap', 'Tap buat lempar lurus ke atas', 'Spasi', 'Tekan buat lempar lurus ke atas'), S('star', 'Lemparannya terbatas, pas-in waktunya!')] },
  maze: { goal: 'Bawa dia ketemu pasangannya', steps: [S('draw', 'Tarik garis dari karakter lewat jalan labirin'), S('no', 'Jangan nembus tembok'), S('clock', 'Sampai tujuan sebelum waktu habis')] },
  timing: { goal: 'Tap pas di zona 💖', steps: [S('eye', 'Jarumnya muter terus'), S('tap', 'Tap pas jarumnya di zona pink', 'Spasi', 'Tekan pas jarumnya di zona pink'), S('star', 'Tiap kena, zonanya makin kecil')] },
  quiz: { goal: 'Jawab pertanyaan tentang kalian', steps: [S('tap', 'Tap jawaban yang menurutmu benar'), S('heart', 'Ada pesan manis tiap jawaban')] },
  race: { goal: 'Ngebut sampai finish', steps: [S('hold', 'Tahan jari di layar = ngebut', '↑ / Spasi', 'Tahan buat ngebut'), S('swipe', 'Geser kiri-kanan buat nyetir', '← →', 'Nyetir kiri-kanan, hindari mobil'), S('star', 'Salip mepet = bonus · nabrak 3x = selesai')] },
  fight: { goal: 'Kalahin lawannya', steps: [S('btn', 'Tombol kiri buat jalan, kanan buat pukul / tendang', 'A D · J pukul · K tendang', 'A D jalan, J pukul, K tendang'), S('hold', 'Tahan 🛡️ buat nangkis', 'L / ↓', 'Tahan L buat nangkis'), S('star', 'Bar kuning penuh? Pencet 💖 buat jurus!', 'Spasi', 'Bar kuning penuh? Tekan Spasi buat jurus!')] },
  penalty: { goal: 'Cetak gol & tepis tendangan', steps: [S('flick', 'Nendang: tarik dari bola ke arah gawang'), S('ok', 'Tarik makin jauh = bola makin tinggi'), S('tap', 'Jaga gawang: tap kotak buat lompat ke situ')] },
  pillow: { goal: 'Lempar bantal ke lawan', steps: [S('stick', 'Geser joystick buat jalan', 'W A S D', 'Jalan pakai W A S D / panah'), S('btn', 'Pencet 🛏️ buat lempar (otomatis ngarah)', 'Spasi', 'Lempar bantal (otomatis ngarah) · K buat ngebut'), S('ok', 'Sembunyi di balik kasur & sofa')] },
  cook: { goal: 'Sajiin pesanan pelanggan', steps: [S('stick', 'Geser joystick buat jalan', 'W A S D', 'Jalan pakai W A S D / panah'), S('btn', 'Pencet ✋ buat ambil / taruh bahan', 'Spasi', 'Ambil / taruh bahan · tahan K buat motong'), S('ok', 'Potong / masak, terus antar ke 🛎️ SAJI. Ikutin panah 👇')] },
  bomb: { goal: 'Ledakin lawan pakai bom', steps: [S('stick', 'Geser joystick buat jalan', 'W A S D', 'Jalan pakai W A S D / panah'), S('btn', 'Pencet 💣 buat taruh bom, terus kabur!', 'Spasi', 'Taruh bom, terus kabur!'), S('star', 'Ledakin peti buat dapet power-up')] },
  coop: { goal: 'Bawa dua-duanya sampai rumah', steps: [S('btn', '◀ ▶ jalan, ⬆️ lompat', 'A D · W / Spasi', 'A D jalan, W / Spasi lompat'), S('swap', 'Pencet Ganti buat gantian gerakin karakter', 'Q', 'Tekan Q buat gantian gerakin karakter'), S('ok', 'Api 🔥 aman di lava, Air 💧 aman di air')] },
};
// Versi Main Berdua (beda dikit dari sendirian)
const DUO = {
  coop: { goal: 'Bawa dua-duanya sampai rumah', steps: [S('btn', '◀ ▶ jalan, ⬆️ lompat', 'A D · W / Spasi', 'A D jalan, W / Spasi lompat'), S('heart', 'Kamu gerakin karaktermu, pasanganmu gerakin punyanya'), S('ok', 'Injek tombol buat bukain jalan pasanganmu')] },
  memory: { goal: 'Kumpulin pasangan kartu terbanyak', steps: [S('tap2', 'Giliranmu: tap 2 kartu'), S('ok', 'Kembar = dapet poin & jalan lagi'), S('heart', 'Nggak kembar = gantian pasanganmu')] },
};
const base = (t) => (HOWTO[t] ? t : t.replace(/co$/, ''));
export const hasHowto = (type) => Boolean(HOWTO[base(type)]);
const KEY = (type) => `lq-howto-${base(type)}`;
export const seenHowto = (type) => { try { return Boolean(localStorage.getItem(KEY(type))); } catch { return true; } };

const ICON = { ok: '✅', no: '🚫', star: '⭐', clock: '⏱️', eye: '👀', heart: '💞', swap: '🔄' };
const HAND = '<svg class="hw-hand" viewBox="0 0 32 32" aria-hidden="true"><path d="M12.5 3.5a2.3 2.3 0 0 1 2.3 2.3v8.1l1.2-.3a2.2 2.2 0 0 1 2.6 1.4l.1.3 1.4-.2a2.1 2.1 0 0 1 2.3 1.5l1.1-.1a2.1 2.1 0 0 1 2.3 2.1v4.2c0 4.4-3.3 7.7-7.6 7.7h-2.4a7 7 0 0 1-5.4-2.6l-4.6-5.6a2.2 2.2 0 0 1 3.1-3.1l1.4 1.2V5.8a2.3 2.3 0 0 1 2.3-2.3z" fill="#fff" stroke="#3d1f3a" stroke-width="1.6" stroke-linejoin="round"/></svg>';

function gesture(s, desk) {
  if (desk && s.k) return `<div class="hw-g hw-keys">${s.k.split(' · ').map((grp) => `<span>${grp.split(' / ').map((x) => `<kbd>${esc(x)}</kbd>`).join('<i>/</i>')}</span>`).join('')}</div>`;
  if (ICON[s.g]) return `<div class="hw-g hw-ic">${ICON[s.g]}</div>`;
  const extra = { stick: '<b class="hw-stick"><i></i></b>', btn: '<b class="hw-btn"></b>', draw: '<svg class="hw-path" viewBox="0 0 64 64"><path d="M12 50 L12 30 L34 30 L34 14 L54 14"/></svg>', tap2: '<b class="hw-dot a"></b><b class="hw-dot b"></b>', swipe: '<b class="hw-track"></b>', flick: '<b class="hw-ball">⚽</b>' }[s.g] || '<b class="hw-ring"></b>';
  return `<div class="hw-g hw-${s.g}">${extra}${HAND}</div>`;
}
const word = (t, desk) => (desk ? t.replace(/\bTap\b/g, 'Klik').replace(/\btap\b/g, 'klik').replace(/Geser jari/g, 'Geser mouse').replace(/Tahan jari di layar/g, 'Tahan klik') : t);

// Tampilkan kartu. opts: { name, icon, color, mission, duo, waitPeer } → Promise selesai pas pemain pencet tombol
export function showHowto(stage, type, opts = {}) {
  const H = (opts.duo && DUO[base(type)]) || HOWTO[base(type)];
  if (!H) return Promise.resolve();
  const desk = isDesktop();
  const el = document.createElement('div');
  el.className = 'howto';
  el.innerHTML = `
    <div class="hw-card" role="dialog" aria-label="Cara main ${esc(opts.name || '')}" style="--g:${opts.color || '#ff6f9f'}">
      <div class="hw-top"><span class="hw-app">${opts.icon || '🎮'}</span><div><small>Cara main</small><b>${esc(opts.name || '')}</b></div></div>
      <p class="hw-goal">🎯 ${esc(H.goal)}</p>
      <ol class="hw-steps">${H.steps.map((s, i) => `<li style="--d:${i * 0.12}s">${gesture(s, desk)}<span><em>${i + 1}</em>${esc(desk && s.k && s.td ? s.td : word(s.t, desk))}</span></li>`).join('')}</ol>
      ${opts.mission ? `<p class="hw-mission"><b>Misi level ini</b>${esc(opts.mission)}</p>` : ''}
      <button class="btn hw-go" type="button">${opts.cta || (opts.duo ? 'Siap! 💞' : 'Ngerti, mulai! ▶')}</button>
      <small class="hw-wait" hidden></small>
    </div>`;
  stage.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  return new Promise((resolve) => {
    const btn = el.querySelector('.hw-go');
    btn.addEventListener('click', () => {
      try { localStorage.setItem(KEY(type), '1'); } catch {}
      if (opts.waitPeer) { // Main Berdua: tunggu pasangan juga siap
        btn.disabled = true; btn.textContent = 'Siap ✓';
        const w = el.querySelector('.hw-wait'); w.hidden = false; w.textContent = `Nunggu ${opts.peerName || 'pasanganmu'} siap… ⏳`;
        opts.waitPeer().then(() => close(resolve));
        return;
      }
      close(resolve);
    });
  });
  function close(done) { el.classList.remove('show'); setTimeout(() => el.remove(), 250); done(); }
}
