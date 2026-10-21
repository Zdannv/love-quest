// Halaman Kenangan: lencana yang kebuka sendiri + linimasa kecil. Semua dihitung dari data yang udah ada di HP
// (progres level, streak, main berdua, Deep Talk, peliharaan, rekor), jadi nggak nambah kuota server.
import { esc } from './util.js';
import { getStats } from './stats.js';

// ctx dari main.js: { worlds: [{ name, icon, done, total }], stars, maxStars, levelsDone, levelsTotal, streak, duoDone, duoTotal, bests, names, faces }
function badges(c) {
  const st = getStats(), pet = st.pet || {};
  const B = [];
  const add = (group, icon, title, desc, cur, goal) => B.push({ group, icon, title, desc, cur: Math.min(cur, goal), goal, ok: cur >= goal });
  add('Petualangan', '🌱', 'Langkah pertama', 'Selesaiin 1 level', c.levelsDone, 1);
  c.worlds.forEach((w, i) => add('Petualangan', w.icon, `Tamat ${w.name}`, `Selesaiin semua level dunia ${i + 1}`, w.done, w.total));
  add('Petualangan', '⭐', 'Kolektor bintang', 'Kumpulin 100 bintang', c.stars, 100);
  add('Petualangan', '👑', 'Juara petualangan', `Dapet semua ${c.maxStars} bintang`, c.stars, c.maxStars);
  add('Streak', '🔥', 'Nyala 3 hari', 'Main berdua 3 hari berturut-turut', c.streak.longest, 3);
  add('Streak', '💪', 'Seminggu kompak', 'Streak 7 hari', c.streak.longest, 7);
  add('Streak', '🌟', 'Dua minggu', 'Streak 14 hari', c.streak.longest, 14);
  add('Streak', '💍', 'Sebulan nggak putus', 'Streak 30 hari', c.streak.longest, 30);
  add('Berdua', '💞', 'Main bareng pertama', 'Selesaiin 1 game berdua', st.duoGames, 1);
  add('Berdua', '🥊', 'Jagoan duel', 'Menang 10 kali main berdua', st.duoWins, 10);
  add('Berdua', '🗺️', 'Petualang berdua', `Tamatin ${c.duoTotal} level berdua`, c.duoDone, c.duoTotal);
  add('Deep Talk', '💬', 'Mulai ngobrol', 'Buka 10 kartu Deep Talk', st.talkCards, 10);
  add('Deep Talk', '🫶', 'Makin kenal', 'Buka 50 kartu Deep Talk', st.talkCards, 50);
  add('Deep Talk', '📚', 'Semua kartu', 'Buka 100 kartu Deep Talk', st.talkCards, 100);
  add('Peliharaan', '🐣', 'Orang tua baru', 'Pilih peliharaan kalian', pet.kind ? 1 : 0, 1);
  add('Peliharaan', '🍼', 'Tumbuh bareng', 'Peliharaan level 5', pet.lvl || 0, 5);
  add('Peliharaan', '🏅', 'Peliharaan juara', 'Peliharaan level 10', pet.lvl || 0, 10);
  add('Game', '🎮', 'Penjelajah game', 'Mainin 10 jenis game beda', st.types.length, 10);
  add('Game', '🏆', 'Pemecah rekor', 'Pecahin rekor di 3 game mode skor', Object.values(c.bests).filter((v) => v > 0).length, 3);
  return B;
}

const fmtDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

// Papan skor berdua: total menang tiap orang + per game (data dari server, diisi belakangan)
// all = { sumo: { pasangan, pengirim, draw }, ... } · names/faces/icons/gameName dari main.js
export function renderH2H(el, all, { names, faces, icon, gameName }) {
  if (!el) return;
  const games = Object.entries(all).filter(([, g]) => g.pasangan + g.pengirim + g.draw > 0).sort((a, b) => (b[1].pasangan + b[1].pengirim) - (a[1].pasangan + a[1].pengirim));
  const A = games.reduce((s, [, g]) => s + g.pasangan, 0), Bn = games.reduce((s, [, g]) => s + g.pengirim, 0), D = games.reduce((s, [, g]) => s + g.draw, 0);
  const ava = (r) => `<span class="h2h-ava ${(r === 'pasangan' ? A > Bn : Bn > A) ? 'lead' : ''}">${faces[r] ? `<img src="${esc(faces[r])}" alt="">` : '💖'}</span>`;
  el.hidden = false;
  el.innerHTML = `
    <h3 class="mem-h">Papan skor berdua 🏆</h3>
    <div class="h2h-top">
      <div class="h2h-side">${ava('pasangan')}<b>${esc(names.pasangan)}</b><em>${A}</em></div>
      <div class="h2h-mid"><small>menang</small><b>VS</b>${D ? `<small>seri ${D}</small>` : ''}</div>
      <div class="h2h-side">${ava('pengirim')}<b>${esc(names.pengirim)}</b><em>${Bn}</em></div>
    </div>
    ${games.length ? `<div class="h2h-list">${games.map(([k, g]) => {
      const tot = Math.max(1, g.pasangan + g.pengirim);
      return `<div class="h2h-row"><span class="h2h-gi">${icon(k)}</span><span class="h2h-gn">${esc(gameName(k))}</span>
        <span class="h2h-bar"><i style="width:${(g.pasangan / tot) * 100}%"></i></span><span class="h2h-sc">${g.pasangan}–${g.pengirim}</span></div>`;
    }).join('')}</div>` : '<p class="mem-empty">Belum ada duel. Main Sumo, Adu Hitung, atau Bom Cinta berdua, nanti skornya kecatat di sini 😆</p>'}`;
}

export function renderMemories(root, c) {
  const B = badges(c), got = B.filter((b) => b.ok).length, st = getStats();
  const first = [c.streak.firstDay, st.first].filter(Boolean).sort()[0];
  const daysSince = first ? Math.max(1, Math.round((Date.now() - new Date(`${first}T00:00:00+07:00`)) / 864e5) + 1) : 1;
  const face = (src, em) => (src ? `<img src="${esc(src)}" alt="">` : `<span>${em}</span>`);
  // linimasa: pencapaian yang udah kebuka, terbaru di atas (urut tingkat kesulitan)
  const tl = [
    first && { ic: '🎁', t: 'Pertama buka Love Quest', d: fmtDay(first) },
    c.levelsDone && { ic: '🗺️', t: `${c.levelsDone} level petualangan selesai`, d: `${c.stars} bintang terkumpul` },
    c.streak.bothDays && { ic: '🔥', t: `${c.streak.bothDays} hari main berdua`, d: `streak terpanjang ${c.streak.longest} hari` },
    st.duoGames && { ic: '💞', t: `${st.duoGames} game dimainin berdua`, d: `${st.duoWins} kali menang` },
    st.talkCards && { ic: '💬', t: `${st.talkCards} kartu Deep Talk dibuka`, d: 'obrolan dari hati ke hati' },
    st.pet?.kind && { ic: '🐾', t: `${esc(st.pet.name || 'Peliharaan')} udah level ${st.pet.lvl || 1}`, d: 'dirawat berdua' },
  ].filter(Boolean);
  const groups = [...new Set(B.map((b) => b.group))];
  root.innerHTML = `
    <div class="mem-hero">
      <div class="mem-faces">${face(c.faces.pasangan, c.names.pasanganEmoji)}<b>💖</b>${face(c.faces.pengirim, c.names.pengirimEmoji)}</div>
      <small>${esc(c.names.pasangan)} &amp; ${esc(c.names.pengirim)}</small>
      <div class="mem-day">Hari ke-<b>${daysSince}</b></div>
      <p>main Love Quest bareng</p>
      <div class="mem-strip">
        <div><b>${got}</b><small>/ ${B.length} lencana</small></div>
        <div><b>${c.stars}</b><small>bintang</small></div>
        <div><b>${c.streak.longest}</b><small>streak terlama</small></div>
      </div>
    </div>
    <div class="mem-prog"><i style="width:${Math.round((got / B.length) * 100)}%"></i></div>
    <section class="h2h-board" id="mem-h2h" hidden></section>
    ${groups.map((g) => `
      <h3 class="mem-h">${g}</h3>
      <div class="mem-grid">${B.filter((b) => b.group === g).map((b) => `
        <div class="badge ${b.ok ? 'ok' : ''}">
          <span class="bd-ic">${b.icon}</span>
          <b>${esc(b.title)}</b>
          <small>${esc(b.desc)}</small>
          ${b.ok ? '<em>✓ kebuka</em>' : `<span class="bd-bar"><i style="width:${Math.round((b.cur / b.goal) * 100)}%"></i></span><em class="lk">${b.cur}/${b.goal}</em>`}
        </div>`).join('')}</div>`).join('')}
    <h3 class="mem-h">Perjalanan kita</h3>
    ${tl.length ? `<ol class="mem-tl">${tl.map((x) => `<li><span>${x.ic}</span><div><b>${x.t}</b><small>${x.d}</small></div></li>`).join('')}</ol>` : '<p class="mem-empty">Mainin satu level dulu, nanti perjalanan kalian muncul di sini 💖</p>'}
    <p class="mem-tip">📸 Screenshot halaman ini terus pamerin ke story, tag pasanganmu!</p>`;
}
