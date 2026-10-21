// Adu Hitung: soal hitungan pilihan ganda (4 jawaban), makin lama makin susah:
// tambah kecil → tambah/kurang → kali → bagi → campuran 3 angka.
// Sendiri: jawab `target` soal benar sebelum waktu habis, salah = -1 nyawa (3 nyawa). Mode skor (p.endless): sampai nyawa habis.
// Berdua (p.duel): soal sama di dua HP (seed). Yang duluan benar dapet poin. HP "pasangan" jadi wasit yang mutusin
// siapa duluan, terus ngumumin ke dua HP. Salah jawab = nggak bisa jawab soal itu lagi.
const seeded = (s) => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// Bikin soal tingkat d (0..6) pakai rng → { q: '7 + 5', a: 12, opts: [..4] }
export function makeQuestion(rng, d) {
  const R = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  let q, a;
  const kind = d <= 0 ? 0 : d === 1 ? R(0, 1) : d === 2 ? R(0, 2) : d === 3 ? R(1, 3) : d === 4 ? R(2, 4) : R(2, 5);
  if (kind === 0) { const x = R(1, 9 + d * 3), y = R(1, 9 + d * 3); q = `${x} + ${y}`; a = x + y; }
  else if (kind === 1) { const x = R(5, 15 + d * 6), y = R(1, x - 1); q = `${x} − ${y}`; a = x - y; }
  else if (kind === 2) { const x = R(2, d >= 4 ? 12 : 9), y = R(2, d >= 4 ? 12 : 9); q = `${x} × ${y}`; a = x * y; }
  else if (kind === 3) { const y = R(2, 9), a0 = R(2, d >= 5 ? 12 : 9); q = `${a0 * y} ÷ ${y}`; a = a0; }
  else if (kind === 4) { const x = R(10, 40 + d * 10), y = R(10, 40 + d * 10); const plus = rng() < 0.5; q = plus ? `${x} + ${y}` : `${Math.max(x, y)} − ${Math.min(x, y)}`; a = plus ? x + y : Math.abs(x - y); }
  else { const x = R(2, 9), y = R(2, 9), z = R(1, 15); const plus = rng() < 0.5; q = `${x} × ${y} ${plus ? '+' : '−'} ${z}`; a = x * y + (plus ? z : -z); }
  // pilihan pengecoh: deket-deket jawabannya biar nggak bisa nebak asal
  const set = new Set([a]);
  const near = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5];
  while (set.size < 4) { const v = a + near[Math.floor(rng() * near.length)] * (rng() < 0.3 ? 2 : 1); if (v >= 0) set.add(v); }
  const opts = [...set];
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return { q, a, opts };
}

export function startMath(stage, p, api) {
  const duel = p.duel || null;
  const host = duel ? duel.role === 'pasangan' : true;
  const rng = seeded(p.seed || Math.floor(Math.random() * 1e9));
  const TOTAL = duel ? 10 : Infinity;
  const wrap = document.createElement('div');
  wrap.className = 'mt-wrap';
  wrap.innerHTML = `
    ${duel ? `<div class="mt-vs"><span class="mt-p me"><b>${p.name || 'Kamu'}</b><em data-s="me">0</em></span><span class="mt-x">VS</span><span class="mt-p opp"><em data-s="opp">0</em><b>${p.oppName || 'Lawan'}</b></span></div>` : ''}
    <div class="mt-card"><small class="mt-lvl"></small><div class="mt-q"></div><div class="mt-bar"><i></i></div></div>
    <div class="mt-opts"></div>
    <p class="mt-msg" aria-live="polite"></p>`;
  stage.appendChild(wrap);
  const qEl = wrap.querySelector('.mt-q'), optsEl = wrap.querySelector('.mt-opts'), msgEl = wrap.querySelector('.mt-msg'), lvlEl = wrap.querySelector('.mt-lvl'), barEl = wrap.querySelector('.mt-bar i');

  let i = 0, cur = null, locked = false, done = false, lives = 3, correct = 0, score = { me: 0, opp: 0 };
  let qStart = performance.now(), timeLeft = p.time || 60, iv = 0;
  const decided = new Set(); // wasit: soal yang udah ada pemenangnya
  const offs = [];
  const diffOf = (n) => (duel ? Math.min(6, Math.floor(n / 2)) : Math.min(6, Math.floor(n / (p.endless ? 4 : 3)) + (p.start || 0)));
  const LVL = ['Pemanasan ➕', 'Tambah & kurang', 'Mulai ada kali ✖️', 'Ada bagi juga ➗', 'Angka puluhan 🔥', 'Campuran 🧠', 'Jago banget 🧠🔥'];
  const PER_Q = duel ? 9 : 0; // detik per soal (berdua)

  function show() {
    const d = diffOf(i);
    cur = makeQuestion(rng, d);
    locked = false; qStart = performance.now();
    lvlEl.textContent = `${duel ? `Soal ${i + 1}/${TOTAL} · ` : ''}${LVL[d]}`;
    qEl.textContent = `${cur.q} = ?`;
    qEl.classList.remove('pop'); void qEl.offsetWidth; qEl.classList.add('pop');
    optsEl.innerHTML = cur.opts.map((v) => `<button type="button" class="mt-opt" data-v="${v}">${v}</button>`).join('');
    msgEl.textContent = '';
    stats();
  }
  function stats() {
    if (duel) { wrap.querySelector('[data-s="me"]').textContent = score.me; wrap.querySelector('[data-s="opp"]').textContent = score.opp; api.setStats(`🧮 ${score.me} - ${score.opp} · soal ${Math.min(i + 1, TOTAL)}/${TOTAL}`); return; }
    const hearts = '❤️'.repeat(Math.max(0, lives)) + '🤍'.repeat(3 - Math.max(0, lives));
    api.setStats(p.endless ? `🧮 Benar ${correct} · 🏆 ${Math.max(p.best || 0, correct)} · ${hearts}` : `⏱ ${Math.ceil(timeLeft)}s · ✅ ${correct}/${p.target} · ${hearts}`);
  }
  function mark(v, cls) { optsEl.querySelector(`[data-v="${v}"]`)?.classList.add(cls); }

  optsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.mt-opt'); if (!b || locked || done) return;
    const v = Number(b.dataset.v), ok = v === cur.a;
    if (duel) {
      locked = true;
      if (!ok) { mark(v, 'bad'); mark(cur.a, 'dim'); api.sfx('bad'); msgEl.textContent = 'Salah 😬 tunggu soal berikutnya…'; duel.send('mans', { i, ok: false }); return; }
      mark(v, 'good'); api.sfx('click');
      if (host) decide(i, 'me'); else duel.send('mans', { i, ok: true });
      msgEl.textContent = host ? '' : 'Bener! Nunggu wasit… ⏳';
      return;
    }
    if (ok) {
      mark(v, 'good'); correct++; api.sfx('good'); api.streak(true);
      locked = true; i++;
      if (!p.endless && correct >= p.target) { end(true); return; }
      setTimeout(() => !done && show(), 380);
    } else {
      mark(v, 'bad'); mark(cur.a, 'good'); lives--; api.sfx('bad'); api.streak(false);
      locked = true; i++;
      msgEl.textContent = `Jawabannya ${cur.a}`;
      if (lives <= 0) { setTimeout(() => end(false), 700); return; }
      setTimeout(() => !done && show(), 900);
    }
    stats();
  });

  // ---- Berdua: wasit (HP pasangan) mutusin siapa yang duluan benar ----
  function decide(n, who) { // who dari sudut pandang wasit: 'me' / 'opp' / null (nggak ada yang bener)
    if (!host || decided.has(n) || n !== i) return;
    decided.add(n);
    duel.send('mwin', { i: n, who: who === 'me' ? 'pasangan' : who === 'opp' ? 'pengirim' : null });
    applyWin(n, who);
  }
  const wrongs = {};
  function applyWin(n, who) {
    if (n !== i || done) return;
    locked = true;
    if (who) score[who]++;
    mark(cur.a, 'good');
    msgEl.textContent = who === 'me' ? 'Kamu duluan! +1 ⚡' : who === 'opp' ? `${p.oppName || 'Dia'} lebih cepet! 😤` : `Nggak ada yang bener 😆 jawabannya ${cur.a}`;
    api.sfx(who === 'me' ? 'good' : 'pop');
    stats();
    setTimeout(() => { if (done) return; i++; if (i >= TOTAL) end(); else show(); }, 1300);
  }
  if (duel) {
    offs.push(duel.on('mans', (d) => {
      if (!host || d.i !== i) return;
      if (d.ok) decide(d.i, 'opp');
      else { wrongs[d.i] = (wrongs[d.i] || 0) + 1; if (locked && wrongs[d.i] && !decided.has(d.i) && optsEl.querySelector('.bad')) decide(d.i, null); }
    }));
    offs.push(duel.on('mwin', (d) => { if (host) return; applyWin(d.i, d.who == null ? null : d.who === 'pengirim' ? 'me' : 'opp'); }));
  }

  iv = setInterval(() => {
    if (done) return;
    if (duel) {
      const left = PER_Q - (performance.now() - qStart) / 1000;
      barEl.style.width = `${Math.max(0, (left / PER_Q) * 100)}%`;
      // wasit: waktu habis atau dua-duanya salah → lanjut
      if (host && !decided.has(i) && (left <= 0 || (optsEl.querySelector('.bad') && wrongs[i]))) decide(i, null);
      return;
    }
    if (p.endless) { barEl.style.width = '100%'; return; }
    timeLeft = Math.max(0, timeLeft - 0.1);
    barEl.style.width = `${(timeLeft / (p.time || 60)) * 100}%`;
    if (Math.round(timeLeft * 10) % 5 === 0) stats();
    if (timeLeft <= 0) end(false);
  }, 100);

  show();
  api.say(duel ? 'Soal sama di dua HP, yang duluan bener dapet poin! ⚡' : 'Tap jawaban yang bener! Makin lama soalnya makin susah 🧮', 'happy');
  if (window.__lqTest) window.__math = { get cur() { return cur; }, get i() { return i; }, get score() { return score; }, get correct() { return correct; }, get lives() { return lives; } };

  function end(win) {
    if (done) return;
    done = true; clearInterval(iv);
    if (duel) { api.finish({ win: score.me >= score.opp, draw: score.me === score.opp, my: score.me, opp: score.opp }); return; }
    if (p.endless) { api.finish({ win: true, score: correct, detail: `Bener ${correct} soal, sampai tingkat "${LVL[diffOf(i)]}" 🧮` }); return; }
    api.finish({ win: Boolean(win), stars: win ? (lives === 3 ? 3 : lives === 2 ? 2 : 1) : 0, detail: win ? `${correct} soal bener, sisa nyawa ${lives} 🧮` : lives <= 0 ? 'Nyawanya habis, coba lagi!' : 'Waktunya habis ⏰' });
  }
  return { destroy() { done = true; clearInterval(iv); offs.forEach((f) => f()); } };
}
