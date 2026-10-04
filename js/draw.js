// Gambar Udara: gambar pakai jari di depan kamera (deteksi tangan MediaPipe), coretannya live di HP pasangan.
// Telunjuk diangkat = gambar, jari dikepal / dua jari / dicubit = berhenti. Bisa juga gambar pakai sentuhan layar.
// Yang dikirim ke pasangan cuma titik-titik coretan (bukan video), lewat room Main Berdua.
import { on as onNet, send as sendNet, peer as peerNet, me as meNet, inviteGame } from './online.js';
import { seeded } from './online-games.js';

const $ = (s) => document.querySelector(s);
const MP_VER = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const COLORS = ['#ff4f8b', '#8a5cff', '#22b8a7', '#ffb020', '#2b1b33', '#ffffff'];
const WORDS = ['kucing', 'rumah', 'matahari', 'bunga', 'hati', 'ikan', 'pohon', 'mobil', 'bintang', 'bulan', 'kue', 'payung',
  'pelangi', 'balon', 'es krim', 'kupu-kupu', 'gunung', 'apel', 'topi', 'kacamata', 'burung', 'kado', 'cincin', 'kopi',
  'pizza', 'awan', 'perahu', 'sepeda', 'kelinci', 'stetoskop', 'jam', 'gitar', 'bola', 'donat', 'semangka', 'pesawat',
  'rumah sakit', 'jarum suntik', 'boneka', 'kamera', 'lilin', 'pantai', 'kereta', 'sepatu', 'surat', 'mahkota', 'robot',
  'anjing', 'gajah', 'jerapah', 'singa', 'ular', 'pisang', 'wortel', 'roti', 'mie', 'piano', 'buku', 'pensil', 'televisi',
  'kasur', 'bantal', 'gelas', 'sendok', 'tenda', 'api unggun', 'roket', 'hantu', 'monyet', 'pinguin', 'panda', 'stroberi'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

export function initDraw({ sfx, toast, onClose }) {
  const screen = $('#screen-draw');
  const video = $('#draw-video');
  const canvas = $('#draw-canvas');
  const ctx = canvas.getContext('2d');
  const cursor = $('#draw-cursor');
  let color = COLORS[0], size = 6, sync = false, camOn = true, running = false;
  let stream = null, landmarker = null, raf = 0, lastDetect = 0;
  let pen = { down: false, id: 0, x: 0, y: 0, sx: null, sy: null };
  let outbox = [], flushT = 0;
  let game = null; // mode Tebak Gambar: { words, r, ok, drawer, left, timer }
  const iDraw = () => !game || game.drawer === meNet().role; // pas Tebak Gambar, yang nebak nggak boleh nyoret
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

  // ---------- Pena (dipakai tangan & sentuhan) ----------
  const myKey = () => `${meNet().id}-${pen.id}`;
  function penDown(x, y) {
    if (!iDraw()) return;
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

  // ---------- Sentuhan layar (cadangan kalau kamera nggak ada) ----------
  const rel = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); penDown(...rel(e)); });
  canvas.addEventListener('pointermove', (e) => { if (pen.down && !handActive) penMove(...rel(e)); });
  canvas.addEventListener('pointerup', () => { if (!handActive) penUp(); });
  canvas.addEventListener('pointercancel', () => { if (!handActive) penUp(); });

  // ---------- Kamera + deteksi tangan ----------
  let handActive = false;
  async function loadLandmarker() {
    if (landmarker) return landmarker;
    const { FilesetResolver, HandLandmarker } = await import(`${MP_URL}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
    const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 1 });
    try { landmarker = await HandLandmarker.createFromOptions(files, opts('GPU')); }
    catch { landmarker = await HandLandmarker.createFromOptions(files, opts('CPU')); }
    return landmarker;
  }
  async function startCamera() {
    setStatus('Nyalain kamera…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      video.srcObject = stream;
      await video.play();
    } catch {
      setStatus('Kamera nggak bisa dibuka. Gambar pakai jari di layar aja yaa ✍️');
      return;
    }
    try {
      setStatus('Nyiapin deteksi tangan…');
      await loadLandmarker();
      setStatus('Angkat telunjuk buat gambar ☝️ · kepal / dua jari buat berhenti');
      loop();
    } catch {
      setStatus('Deteksi tangan gagal dimuat. Gambar pakai jari di layar aja yaa ✍️');
    }
  }
  function stopCamera() {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }
  function setStatus(t) { $('#draw-status').textContent = t; }

  // Telunjuk lurus & jari tengah ditekuk = gambar
  function gesture(lm) {
    const up = (tip, pip) => lm[tip].y < lm[pip].y - 0.02;
    const index = up(8, 6), middle = up(12, 10), ring = up(16, 14);
    const pinch = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) < 0.05;
    return index && !middle && !ring && !pinch;
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!running || !landmarker || video.readyState < 2) return;
    const now = performance.now();
    if (now - lastDetect < 45) return; // ±20 kali per detik, biar HP nggak panas
    lastDetect = now;
    let res;
    try { res = landmarker.detectForVideo(video, now); } catch { return; }
    const lm = res?.landmarks?.[0];
    if (!lm) {
      handActive = false;
      cursor.hidden = true;
      if (pen.down) penUp();
      pen.sx = null;
      return;
    }
    handActive = true;
    // Kamera depan ditampilin kayak cermin → x dibalik
    let x = 1 - lm[8].x, y = lm[8].y;
    // Haluskan gerakan biar garisnya nggak goyang
    if (pen.sx == null) { pen.sx = x; pen.sy = y; }
    pen.sx += (x - pen.sx) * 0.55; pen.sy += (y - pen.sy) * 0.55;
    x = pen.sx; y = pen.sy;
    const drawing = gesture(lm) && iDraw();
    const r = canvas.getBoundingClientRect();
    cursor.hidden = false;
    cursor.style.transform = `translate(${x * r.width}px, ${y * r.height}px)`;
    cursor.classList.toggle('on', drawing);
    cursor.style.setProperty('--c', color);
    if (drawing && !pen.down) penDown(x, y);
    else if (drawing) penMove(x, y);
    else if (pen.down) penUp();
  }

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
  $('#draw-clear').addEventListener('click', () => { sfx('pop'); clearAll(); });
  $('#draw-cam').addEventListener('click', () => {
    sfx('click');
    camOn = !camOn;
    screen.classList.toggle('cam-off', !camOn);
    $('#draw-cam').textContent = camOn ? '🙈 Sembunyiin muka' : '📷 Tampilin muka';
  });
  $('#draw-save').addEventListener('click', savePhoto);

  // Simpan foto: muka (kalau kamera nyala) + coretan, jadi satu gambar
  async function savePhoto() {
    sfx('click');
    const r = canvas.getBoundingClientRect();
    const out = document.createElement('canvas');
    out.width = Math.round(r.width * 2); out.height = Math.round(r.height * 2);
    const o = out.getContext('2d');
    o.fillStyle = '#fff4f8'; o.fillRect(0, 0, out.width, out.height);
    if (camOn && video.videoWidth) {
      // sama kayak tampilan: video dipotong pas kotak (cover) & dicerminin
      const vr = video.videoWidth / video.videoHeight, cr = out.width / out.height;
      const sw = vr > cr ? video.videoHeight * cr : video.videoWidth, sh = vr > cr ? video.videoHeight : video.videoWidth / cr;
      o.save(); o.translate(out.width, 0); o.scale(-1, 1);
      o.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, out.width, out.height);
      o.restore();
    }
    o.drawImage(canvas, 0, 0, out.width, out.height);
    o.font = `600 ${Math.round(out.width * 0.035)}px Fredoka, sans-serif`;
    o.fillStyle = 'rgba(255,255,255,.85)';
    o.fillText('Gambar Udara 💞', out.width * 0.04, out.height - out.width * 0.04);
    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    const file = new File([blob], `gambar-udara-${Date.now()}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Gambar Udara' }); return; } catch {}
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Fotonya kesimpen 📸');
  }

  // ---------- Mode Tebak Gambar: gantian gambar, pasangan nebak ----------
  // Urutan kata sama di dua HP (seed dari ajakan). HP yang lagi gambar jadi patokan waktu & yang nentuin bener/salah.
  const ROUNDS = 6, ROUND_TIME = 60;
  const guessBox = $('#draw-guess');
  const banner = $('#draw-secret');
  const roleOf = (r) => (r % 2 === 0 ? 'pasangan' : 'pengirim');
  const blanks = (w) => w.split('').map((ch) => (ch === ' ' ? '&nbsp;&nbsp;' : ch === '-' ? '-' : '_')).join(' ');
  function startGame(seed) {
    const rng = seeded(seed);
    const words = [...WORDS];
    for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
    game = { words: words.slice(0, ROUNDS), r: 0, ok: 0 };
    startRound();
  }
  function startRound() {
    clearInterval(game.timer);
    strokes.length = 0;
    redraw();
    penUp();
    game.drawer = roleOf(game.r);
    game.left = ROUND_TIME;
    const mine = iDraw();
    guessBox.hidden = mine;
    guessBox.querySelector('input').value = '';
    banner.hidden = false;
    renderBanner();
    $('#draw-who').textContent = `🎨 Ronde ${game.r + 1}/${ROUNDS} · ✅ ${game.ok}`;
    sfx('go');
    if (!mine) toast(`${peerNet()?.name || 'Pasangan'} lagi gambar, tebak yaa! 🤔`);
    game.timer = setInterval(() => {
      if (!game) return;
      game.left = Math.max(0, game.left - 1);
      renderBanner();
      if (game.left === 0 && iDraw()) finishRound(false);
    }, 1000);
  }
  function renderBanner() {
    const w = game.words[game.r];
    banner.innerHTML = iDraw()
      ? `Giliran kamu gambar 🤫 <b>${w}</b><small>⏱ ${game.left} detik · jangan tulis hurufnya yaa</small><button class="link-btn" type="button" data-pg-skip>lewati kata ini</button>`
      : `Tebak gambar ${peerNet()?.name || 'pasangan'}! <b>${blanks(w)}</b><small>${w.replace(/[^a-z]/gi, '').length} huruf · ⏱ ${game.left} detik</small>`;
  }
  function finishRound(ok) { // cuma dipanggil di HP yang lagi gambar
    if (!game) return;
    const r = game.r;
    sendNet('pg-next', { r, ok });
    applyNext(r, ok);
  }
  function applyNext(r, ok) {
    if (!game || r !== game.r) return;
    clearInterval(game.timer);
    const w = game.words[r];
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
    if (e.target.closest('[data-pg-skip]') && game && iDraw()) { sfx('click'); finishRound(false); }
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
    if (!sync || !game || !iDraw() || d.r !== game.r) return;
    if (norm(d.g) === norm(game.words[game.r])) finishRound(true);
    else { sendNet('pg-wrong', { g: d.g }); toast(`${peerNet()?.name || 'Pasangan'} nebak "${d.g}"… salah 😆`); }
  });
  onNet('pg-wrong', (d) => { if (sync) { sfx('bad'); toast(`"${d.g}" salah, coba lagi 🤭`); } });
  onNet('pg-next', (d) => { if (sync) applyNext(d.r, d.ok); });

  // ---------- Buka / tutup ----------
  window.addEventListener('resize', () => { if (running) fit(); });
  return {
    async open(withPartner, seed = null) {
      sync = !!withPartner && !!peerNet();
      running = true;
      if (game) clearInterval(game.timer);
      game = null;
      banner.hidden = true;
      guessBox.hidden = true;
      $('#draw-who').textContent = sync ? `💞 Bareng ${peerNet().name}` : '✍️ Gambar Udara';
      requestAnimationFrame(fit);
      if (seed != null && sync) requestAnimationFrame(() => startGame(seed));
      if (!stream) await startCamera();
      else loop();
    },
    close() {
      running = false;
      sync = false;
      if (game) clearInterval(game.timer);
      game = null;
      penUp();
      stopCamera();
      onClose?.();
    },
  };
}
