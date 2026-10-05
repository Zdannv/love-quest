// Tebak Gambar: gantian gambar pakai jari di layar, pasangan nebak katanya.
// Versi ini TANPA kamera / deteksi tangan — murni coret-coret di layar. Yang dikirim ke pasangan
// cuma titik-titik coretan (bukan video), lewat room Main Berdua.
import { on as onNet, send as sendNet, peer as peerNet, me as meNet, inviteGame } from './online.js';
import { seeded } from './online-games.js';

const $ = (s) => document.querySelector(s);
const COLORS = ['#ff4f8b', '#8a5cff', '#22b8a7', '#ffb020', '#2b1b33', '#ffffff'];
const WORDS = ['kucing', 'rumah', 'matahari', 'bunga', 'hati', 'ikan', 'pohon', 'mobil', 'bintang', 'bulan', 'kue', 'payung',
  'pelangi', 'balon', 'es krim', 'kupu-kupu', 'gunung', 'apel', 'topi', 'kacamata', 'burung', 'kado', 'cincin', 'kopi',
  'pizza', 'awan', 'perahu', 'sepeda', 'kelinci', 'stetoskop', 'jam', 'gitar', 'bola', 'donat', 'semangka', 'pesawat',
  'rumah sakit', 'jarum suntik', 'boneka', 'kamera', 'lilin', 'pantai', 'kereta', 'sepatu', 'surat', 'mahkota', 'robot',
  'anjing', 'gajah', 'jerapah', 'singa', 'ular', 'pisang', 'wortel', 'roti', 'mie', 'piano', 'buku', 'pensil', 'televisi',
  'kasur', 'bantal', 'gelas', 'sendok', 'tenda', 'api unggun', 'roket', 'hantu', 'monyet', 'pinguin', 'panda', 'stroberi'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

export function initDraw({ sfx, toast, onClose }) {
  const canvas = $('#draw-canvas');
  const ctx = canvas.getContext('2d');
  let color = COLORS[0], size = 6, sync = false, running = false;
  let pen = { down: false, id: 0 };
  let eraserMode = false, touchDown = false;
  let outbox = [], flushT = 0, eraseOut = [], eraseT = 0;
  let game = null; // mode Tebak Gambar: { pool, r, ok, drawer, phase, answer, mask, left, timer }
  const iDraw = () => !game || game.drawer === meNet().role; // yang nebak nggak boleh nyoret
  const canDraw = () => iDraw() && (!game || game.phase === 'draw'); // nggak bisa nyoret pas lagi milih kata
  const strokes = []; // semua coretan (punya kita & pasangan), buat digambar ulang pas ukuran berubah

  // ---------- Kanvas ----------
  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  function seg(s, a, b) {
    const r = canvas.getBoundingClientRect();
    ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a[0] * r.width, a[1] * r.height); ctx.lineTo(b[0] * r.width, b[1] * r.height); ctx.stroke();
  }
  function redraw() {
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    for (const s of strokes) for (let i = 1; i < s.pts.length; i++) seg(s, s.pts[i - 1], s.pts[i]);
  }
  const findStroke = (key) => strokes.find((s) => s.key === key);
  function addPoint(key, c, w, p) {
    let s = findStroke(key);
    if (!s) { s = { key, c, w, pts: [] }; strokes.push(s); }
    s.pts.push(p);
    if (s.pts.length > 1) seg(s, s.pts[s.pts.length - 2], p);
  }
  function clearAll(local = true) {
    strokes.length = 0;
    redraw();
    if (local && sync) sendNet('draw-clear', {});
  }

  // ---------- Penghapus sebagian: hapus coretan di sekitar jari, bukan semua ----------
  function eraseAt(x, y, broadcast = true) {
    const r = canvas.getBoundingClientRect();
    const rad = r.width * 0.09; // seukuran ujung jari
    let changed = false, n = 0;
    const next = [];
    for (const s of strokes) {
      let run = [];
      const push = () => { if (run.length > 1) next.push({ key: `${s.key}~${n++}`, c: s.c, w: s.w, pts: run }); };
      for (const p of s.pts) {
        const dx = (p[0] - x) * r.width, dy = (p[1] - y) * r.height;
        if (Math.hypot(dx, dy) <= rad) { changed = true; push(); run = []; }
        else run.push(p);
      }
      if (run.length === s.pts.length) next.push(s); // nggak kesentuh
      else push();
    }
    if (changed) { strokes.length = 0; strokes.push(...next); redraw(); }
    if (broadcast && sync) { eraseOut.push([+x.toFixed(4), +y.toFixed(4)]); if (!eraseT) eraseT = setTimeout(flushErase, 60); }
  }
  function flushErase() { clearTimeout(eraseT); eraseT = 0; if (eraseOut.length && sync) sendNet('draw-erase', { pts: eraseOut }); eraseOut = []; }
  onNet('draw-erase', (d) => { if (sync) for (const q of d.pts || []) eraseAt(q[0], q[1], false); });

  // ---------- Pena ----------
  const myKey = () => `${meNet().id}-${pen.id}`;
  function penDown(x, y) {
    if (!canDraw()) return;
    pen.down = true; pen.id++;
    addPoint(myKey(), color, size, [x, y]);
    queue([x, y], true);
  }
  function penMove(x, y) {
    if (!pen.down) return;
    const s = findStroke(myKey());
    const last = s?.pts[s.pts.length - 1];
    if (last && Math.hypot(last[0] - x, last[1] - y) < 0.004) return; // abaikan getaran kecil
    addPoint(myKey(), color, size, [x, y]);
    queue([x, y]);
  }
  function penUp() { pen.down = false; flush(); }
  function queue(p, start = false) {
    if (!sync) return;
    outbox.push({ k: pen.id, c: color, w: size, p: [+p[0].toFixed(4), +p[1].toFixed(4)], s: start ? 1 : 0 });
    if (!flushT) flushT = setTimeout(flush, 60); // kirim per ~60 ms biar hemat
  }
  function flush() {
    clearTimeout(flushT); flushT = 0;
    if (!outbox.length || !sync) { outbox = []; return; }
    sendNet('draw-pts', { pts: outbox });
    outbox = [];
  }
  onNet('draw-pts', (d) => {
    if (!sync) return;
    for (const q of d.pts || []) addPoint(`${d.from}-${q.k}`, q.c, q.w, q.p);
  });
  onNet('draw-clear', () => { if (sync) { strokes.length = 0; redraw(); toast(`${peerNet()?.name || 'Pasangan'} ngehapus kanvas 🧽`); } });

  // ---------- Sentuhan layar ----------
  const rel = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {} touchDown = true; if (eraserMode) { if (canDraw()) eraseAt(...rel(e)); } else penDown(...rel(e)); });
  canvas.addEventListener('pointermove', (e) => { if (!touchDown) return; if (eraserMode) { if (canDraw()) eraseAt(...rel(e)); } else if (pen.down) penMove(...rel(e)); });
  canvas.addEventListener('pointerup', () => { touchDown = false; if (!eraserMode) penUp(); flushErase(); });
  canvas.addEventListener('pointercancel', () => { touchDown = false; if (!eraserMode) penUp(); });

  // ---------- Toolbar ----------
  $('#draw-colors').innerHTML = COLORS.map((c, i) => `<button type="button" class="draw-color ${i === 0 ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Warna"></button>`).join('');
  $('#draw-colors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    sfx('click');
    color = b.dataset.color;
    document.querySelectorAll('.draw-color').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#draw-size').addEventListener('input', (e) => { size = +e.target.value; });
  $('#draw-mode').addEventListener('click', () => {
    sfx('click');
    eraserMode = !eraserMode;
    $('#draw-mode').textContent = eraserMode ? '✏️ Pena' : '🩹 Hapus';
    $('#draw-mode').classList.toggle('on', eraserMode);
  });
  $('#draw-clear').addEventListener('click', () => { sfx('pop'); clearAll(); });

  // ---------- Mode Tebak Gambar: gantian gambar, pasangan nebak ----------
  // Urutan kata sama di dua HP (seed dari ajakan). HP yang lagi gambar jadi patokan waktu & yang nentuin bener/salah.
  const ROUNDS = 6, ROUND_TIME = 60;
  const guessBox = $('#draw-guess');
  const banner = $('#draw-secret');
  const roleOf = (r) => (r % 2 === 0 ? 'pasangan' : 'pengirim');
  const blanks = (w) => w.split('').map((ch) => (ch === ' ' ? '&nbsp;&nbsp;' : ch === '-' ? '-' : '_')).join(' ');
  const PICK = 3; // berapa pilihan kata tiap ronde
  const optsFor = (r) => game.pool.slice(r * PICK, r * PICK + PICK);
  function startGame(seed) {
    const rng = seeded(seed);
    const pool = [...WORDS];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    game = { pool, r: 0, ok: 0 };
    startRound();
  }
  function startRound() {
    clearInterval(game.timer); game.timer = 0;
    strokes.length = 0; redraw(); penUp();
    game.drawer = roleOf(game.r);
    game.phase = 'pick'; // milih kata dulu, baru gambar
    game.answer = null; game.mask = null; game.left = ROUND_TIME;
    guessBox.hidden = true;
    banner.hidden = false;
    renderBanner();
    $('#draw-who').textContent = `🎨 Ronde ${game.r + 1}/${ROUNDS} · ✅ ${game.ok}`;
    sfx('go');
    if (!iDraw()) toast(`${peerNet()?.name || 'Pasangan'} lagi milih kata 🤔`);
  }
  function startTimer() {
    clearInterval(game.timer);
    game.timer = setInterval(() => {
      if (!game || game.phase !== 'draw') return;
      game.left = Math.max(0, game.left - 1);
      renderBanner();
      if (game.left === 0 && iDraw()) finishRound(false);
    }, 1000);
  }
  function pickWord(i) {
    if (!game || game.phase !== 'pick' || !iDraw()) return;
    const w = optsFor(game.r)[i];
    if (!w) return;
    sfx('click');
    game.answer = w;
    game.mask = w.replace(/[^\s-]/g, '*'); // cuma kerangka kata, hurufnya nggak ikut dikirim
    game.phase = 'draw';
    sendNet('pg-pick', { r: game.r, mask: game.mask });
    renderBanner(); startTimer();
  }
  function renderBanner() {
    const mine = iDraw();
    if (game.phase === 'pick') {
      banner.innerHTML = mine
        ? `Pilih yang mau kamu gambar 🎨<div class="pg-opts">${optsFor(game.r).map((w, i) => `<button class="btn small-btn" type="button" data-pg-pick="${i}">${w}</button>`).join('')}</div>`
        : `Tebak gambar ${peerNet()?.name || 'pasangan'}! <small>⏳ lagi milih kata buat digambar…</small>`;
      return;
    }
    const letters = (mine ? game.answer : game.mask || '').replace(/[^a-z*]/gi, '').length;
    banner.innerHTML = mine
      ? `Giliran kamu gambar 🤫 <b>${game.answer}</b><small>⏱ ${game.left} detik · gambar pakai jari, jangan tulis hurufnya yaa</small><button class="link-btn" type="button" data-pg-skip>lewati kata ini</button>`
      : `Tebak gambar ${peerNet()?.name || 'pasangan'}! <b>${blanks(game.mask || '')}</b><small>${letters} huruf · ⏱ ${game.left} detik</small>`;
  }
  function finishRound(ok) { // cuma dipanggil di HP yang lagi gambar
    if (!game) return;
    const r = game.r;
    sendNet('pg-next', { r, ok, w: game.answer });
    applyNext(r, ok, game.answer);
  }
  function applyNext(r, ok, w) {
    if (!game || r !== game.r) return;
    clearInterval(game.timer); game.timer = 0;
    game.phase = 'done';
    w = w || game.answer || '';
    if (ok) { game.ok++; sfx('win'); toast(`Bener! Jawabannya "${w}" 🎉`); }
    else { sfx('lose'); toast(`Jawabannya "${w}" 😆`); }
    game.r++;
    $('#draw-who').textContent = `🎨 Ronde ${Math.min(game.r + 1, ROUNDS)}/${ROUNDS} · ✅ ${game.ok}`;
    if (game.r >= ROUNDS) { setTimeout(endGame, 1200); return; }
    setTimeout(() => { if (game) startRound(); }, 1800);
  }
  function endGame() {
    if (!game) return;
    const ok = game.ok;
    clearInterval(game.timer);
    game = null;
    guessBox.hidden = true;
    const label = ok >= 5 ? 'Sehati parah! 💍' : ok >= 3 ? 'Kompak! 💞' : 'Seru juga ya 😆';
    if (ok >= 3) sfx('win');
    banner.hidden = false;
    banner.innerHTML = `Selesai! Kalian bener <b>${ok}/${ROUNDS}</b><small>${label}</small><button class="btn small-btn" type="button" data-pg-again>Main lagi 🔁</button>`;
    $('#draw-who').textContent = `💞 Bareng ${peerNet()?.name || ''}`;
  }
  banner.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pg-pick]');
    if (pick) { pickWord(+pick.dataset.pgPick); return; }
    if (e.target.closest('[data-pg-skip]') && game && iDraw() && game.phase === 'draw') { sfx('click'); finishRound(false); }
    if (e.target.closest('[data-pg-again]')) { sfx('click'); inviteGame('pictio'); }
  });
  guessBox.addEventListener('submit', (e) => {
    e.preventDefault();
    const g = guessBox.querySelector('input').value.trim();
    if (!g || !game) return;
    sendNet('draw-guess', { g, r: game.r });
    guessBox.querySelector('input').value = '';
  });
  onNet('draw-guess', (d) => {
    if (!sync || !game || !iDraw() || game.phase !== 'draw' || d.r !== game.r) return;
    if (norm(d.g) === norm(game.answer)) finishRound(true);
    else { sendNet('pg-wrong', { g: d.g }); toast(`${peerNet()?.name || 'Pasangan'} nebak "${d.g}"… salah 😆`); }
  });
  onNet('pg-wrong', (d) => { if (sync) { sfx('bad'); toast(`"${d.g}" salah, coba lagi 🤭`); } });
  onNet('pg-pick', (d) => {
    if (!sync || !game || iDraw() || d.r !== game.r) return;
    game.mask = d.mask; game.phase = 'draw'; game.left = ROUND_TIME;
    guessBox.hidden = false;
    renderBanner(); startTimer();
  });
  onNet('pg-next', (d) => { if (sync) applyNext(d.r, d.ok, d.w); });

  // ---------- Buka / tutup ----------
  window.addEventListener('resize', () => { if (running) fit(); });
  return {
    open(withPartner, seed = null) {
      sync = !!withPartner && !!peerNet();
      running = true;
      if (game) clearInterval(game.timer);
      game = null;
      banner.hidden = true;
      guessBox.hidden = true;
      eraserMode = false;
      $('#draw-mode').textContent = '🩹 Hapus';
      $('#draw-mode').classList.remove('on');
      $('#draw-who').textContent = sync ? `💞 Bareng ${peerNet().name}` : '🎨 Tebak Gambar';
      setStatus('Gambar pakai jari di layar ✍️');
      requestAnimationFrame(fit);
      if (seed != null && sync) requestAnimationFrame(() => startGame(seed));
    },
    close() {
      running = false;
      sync = false;
      if (game) clearInterval(game.timer);
      game = null;
      penUp();
      onClose?.();
    },
  };

  function setStatus(t) { const el = $('#draw-status'); if (el) el.textContent = t; }
}
