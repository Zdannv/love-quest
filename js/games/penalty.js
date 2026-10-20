// Adu Penalti: gantian nendang & jaga gawang. Penendang tarik jari dari bola ke arah gawang
// (makin jauh tarikannya, makin tinggi bolanya). Kiper tap salah satu dari 6 kotak gawang buat lompat ke situ.
// Sendiri (p.endless): lawan bot, 3 nyawa (gagal gol / kebobolan = -1), skor = gol + tepisan.
// Berdua (p.duel): pilihan penendang & kiper dikunci barengan lalu diputar di dua HP, jadi aman walau sinyal lemot.
import { drawEmoji, drawFace, loadImage } from '../util.js';
import { drawToon, toonLoad } from '../toon.js';
import { makeFx } from '../scene.js';

const AIM_TIME = 6, ROUNDS = 5;
// angka acak 0..1 yang sama di dua HP buat giliran tertentu
const hash01 = (n) => { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };

export function startPenalty(stage, p, api) {
  const canvas = document.createElement('canvas');
  canvas.className = 'catch-canvas';
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, k = 1;
  const G = {}; // kotak gawang di layar
  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    k = Math.min(1.3, Math.max(0.75, Math.min(W / 380, H / 600)));
    G.l = W * 0.1; G.r = W * 0.9; G.t = H * 0.17; G.b = H * 0.42; G.w = G.r - G.l; G.h = G.b - G.t; G.cx = W / 2;
  }
  resize();

  const duel = p.duel || null;
  const myRole = duel ? duel.role : 'pasangan';
  const look = {
    me: { img: loadImage(p.face), emoji: p.emoji || '😊', name: p.name || 'Kamu', toon: p.toon || 'f' },
    opp: { img: loadImage(p.oppFace), emoji: p.oppEmoji || '😈', name: p.oppName || 'Lawan', toon: p.oppToon || 'm' },
  };
  toonLoad(look.me.toon, look.opp.toon);
  const shooterRole = (i) => (i % 2 === 0 ? 'pasangan' : 'pengirim');
  const iShoot = (i) => (duel ? shooterRole(i) === myRole : i % 2 === 0);

  let turn = 0, phase = 'aim', phaseT = 0, done = false, raf = 0, last = performance.now(), lastStats = '';
  let lives = 3, level = p.botLevel || 0, score = 0;
  const goalMode = !duel && !p.endless && p.goal;
  const goals = { me: [], opp: [] }; // hasil tiap tendangan: true gol / false gagal
  let mine = null, theirs = null; // pilihan kita & lawan buat giliran ini
  let anim = null; // { shot, dive, saved, goal, t }
  let swipe = null, msg = null, cheered = false;
  const fx = makeFx();
  const offs = [];

  // ---- Koordinat gawang: gx -1..1 (kiri-kanan tiang), gy 0..1 (tanah-mistar) ----
  const toScreen = (gx, gy) => ({ x: G.cx + gx * G.w / 2, y: G.b - gy * G.h });
  const zoneOf = (gx, gy) => ({ col: gx < -0.33 ? 0 : gx > 0.33 ? 2 : 1, row: gy > 0.5 ? 1 : 0 });
  const inGoal = (s) => Math.abs(s.gx) <= 1 && s.gy <= 1 && s.gy >= 0;

  function resolve(shot, dive, i) {
    if (!inGoal(shot)) return { saved: false, goal: false, wide: true };
    const z = zoneOf(shot.gx, shot.gy);
    let saved = dive.col === z.col && (dive.row === z.row || z.col === 1);
    // pojok atas susah banget ditepis walau kiper udah nebak arah yang bener
    if (saved && Math.abs(shot.gx) > 0.82 && shot.gy > 0.8) saved = hash01(((p.seed || 7) * 31 + i * 97) >>> 0) < 0.35;
    return { saved, goal: !saved, wide: false };
  }

  // ---- Bot ----
  function botShot() {
    const miss = Math.random() < Math.max(0.04, 0.14 - level * 0.015);
    return { gx: (Math.random() * 2 - 1) * (miss ? 1.25 : 0.95), gy: miss ? 1.12 : 0.05 + Math.random() * 0.9 };
  }
  function botDive(shot) {
    const z = zoneOf(shot.gx, shot.gy);
    const smart = Math.random() < Math.min(0.55, 0.22 + level * 0.04);
    return smart ? { col: z.col, row: z.row } : { col: Math.floor(Math.random() * 3), row: Math.random() < 0.5 ? 0 : 1 };
  }

  // ---- Pilihan kita ----
  function choose(c) {
    if (phase !== 'aim' || mine) return;
    mine = c;
    api.sfx(iShoot(turn) ? 'flip' : 'click');
    if (duel) duel.send('pk', { i: turn, c });
    else theirs = iShoot(turn) ? botDive(c) : null;
    if (!duel && !iShoot(turn)) theirs = pendingBotShot;
    tryStart();
  }
  let pendingBotShot = null;
  function tryStart() {
    if (!mine || !theirs) return;
    const shot = iShoot(turn) ? mine : theirs;
    const dive = iShoot(turn) ? theirs : mine;
    anim = { shot, dive, ...resolve(shot, dive, turn), t: 0 };
    phase = 'fly'; phaseT = 0;
    api.sfx('pop');
  }
  if (duel) offs.push(duel.on('pk', (d) => { if (d.i === turn && !theirs) { theirs = d.c; tryStart(); } else if (d.i === turn + 1) early = d.c; }));
  let early = null;

  function startTurn() {
    mine = null; theirs = null; anim = null; phase = 'aim'; phaseT = 0; msg = null;
    if (early) { theirs = early; early = null; }
    if (!duel && !iShoot(turn)) pendingBotShot = botShot();
    api.say(iShoot(turn) ? 'Giliran kamu nendang! Geser bola ke arah gawang ⚽' : 'Giliran kamu jaga gawang! Tap kotak buat lompat 🧤', 'happy');
  }

  // ---- Input ----
  const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (phase !== 'aim' || mine) return;
    const q = pt(e);
    if (iShoot(turn)) { if (q.y > H * 0.55) { swipe = { a: q, b: q }; try { canvas.setPointerCapture(e.pointerId); } catch {} } return; }
    // kiper: tap kotak gawang (agak dilebihin biar gampang)
    if (q.x < G.l - 20 || q.x > G.r + 20 || q.y < G.t - 30 || q.y > G.b + 30) return;
    choose({ col: Math.max(0, Math.min(2, Math.floor(((q.x - G.l) / G.w) * 3))), row: q.y < G.t + G.h / 2 ? 1 : 0 });
  });
  canvas.addEventListener('pointermove', (e) => { if (swipe) swipe.b = pt(e); });
  canvas.addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const a = swipe.a, b = pt(e); swipe = null;
    const dx = b.x - a.x, dy = a.y - b.y;
    if (dy < 30 * k) return; // harus ke atas
    // Arah: garis geseran diterusin sampai gawang. Tinggi: makin jauh ditarik ke arah gawang, makin tinggi.
    // (Nggak pakai kecepatan lagi: di laptop, geser mouse dikit aja kecepatannya kegedean & bola mental ke atas.)
    const midY = G.b - G.h / 2, xg = a.x + dx * ((a.y - midY) / dy);
    const reach = dy / Math.max(1, a.y - G.t);
    choose({ gx: +Math.max(-1.35, Math.min(1.35, (xg - G.cx) / (G.w / 2))).toFixed(3), gy: +Math.max(0, Math.min(1.08, reach * 1.1 - 0.06)).toFixed(3) });
  });
  window.addEventListener('resize', resize);

  // ---- Jalannya ----
  function update(dt) {
    phaseT += dt;
    if (phase === 'aim') {
      if (!mine && phaseT > AIM_TIME) choose(iShoot(turn) ? { gx: (Math.random() - 0.5) * 0.6, gy: 0.2 } : { col: 1, row: 0 });
      if (duel && mine && !theirs && phaseT > AIM_TIME + 8) { theirs = iShoot(turn) ? { col: 1, row: 0 } : { gx: 0, gy: 0.2 }; tryStart(); }
    } else if (phase === 'fly') {
      anim.t += dt;
      if (anim.t > 1.0) {
        phase = 'result'; phaseT = 0;
        const myKick = iShoot(turn);
        (myKick ? goals.me : goals.opp).push(anim.goal);
        msg = anim.wide ? 'Meleset! 😬' : anim.saved ? 'Ditepis! 🧤' : 'GOOOL! ⚽';
        api.sfx(anim.goal === myKick ? 'win' : 'bad');
        if (!duel) {
          const good = myKick ? anim.goal : !anim.goal;
          if (good) { score++; api.streak(true); } else { if (!goalMode) lives--; api.streak(false); }
          if (turn % 2 === 1) level++;
        }
      }
    } else if (phase === 'result' && phaseT > 1.5) {
      if (!duel && lives <= 0) return end();
      if (goalMode && turn >= 9) return end();
      if (duel && decided()) return end();
      turn++;
      startTurn();
    }
  }
  const tally = (a) => a.filter(Boolean).length;
  function decided() {
    const a = tally(goals.me), b = tally(goals.opp), na = goals.me.length, nb = goals.opp.length;
    if (na <= ROUNDS && nb <= ROUNDS) {
      if (a + (ROUNDS - na) < b || b + (ROUNDS - nb) < a) return true; // udah nggak kekejar
      return na === ROUNDS && nb === ROUNDS && a !== b;
    }
    return na === nb && (a !== b || na >= ROUNDS + 5); // adu tendangan tambahan
  }

  // ---- Gambar ----
  function keeperPose() {
    if (!anim) return { x: G.cx + Math.sin(performance.now() / 380) * 10 * k, y: G.b, rot: 0 };
    const d = anim.dive, f = Math.min(1, Math.max(0, (anim.t - 0.12) / 0.32));
    const tx = G.cx + (d.col - 1) * G.w * 0.33, lift = d.row ? G.h * 0.45 : G.h * 0.05;
    return { x: G.cx + (tx - G.cx) * f, y: G.b - lift * Math.sin(f * Math.PI * 0.5), rot: (d.col - 1) * 1.15 * f };
  }
  function drawKeeper(who) {
    const ps = keeperPose(), h = G.h * 1.18;
    const diving = anim && anim.t > 0.12;
    const dir = anim && anim.dive.col === 0 ? -1 : 1;
    drawToon(ctx, who.toon, diving ? 'jump' : 'cheer1', ps.x, ps.y + h * 0.06, h, dir, who.img, who.emoji, '#fff', ps.rot);
    if (!diving) { drawEmoji(ctx, '🧤', ps.x - h * 0.27, ps.y - h * 0.83, h * 0.16); drawEmoji(ctx, '🧤', ps.x + h * 0.27, ps.y - h * 0.83, h * 0.16); }
  }
  function drawGoal() {
    // jaring: sisi belakang lebih kecil biar kelihatan dalem
    const d = 12 * k;
    ctx.fillStyle = 'rgba(30,40,70,.28)'; ctx.fillRect(G.l, G.t, G.w, G.h);
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(G.l + d, G.t + d, G.w - d * 2, G.h - d);
    for (const [x0, x1] of [[G.l, G.l + d], [G.r, G.r - d]]) { ctx.beginPath(); ctx.moveTo(x0, G.t); ctx.lineTo(x1, G.t + d); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    for (let x = G.l; x <= G.r; x += 14 * k) { ctx.beginPath(); ctx.moveTo(x, G.t); ctx.lineTo(x, G.b); ctx.stroke(); }
    for (let y = G.t; y <= G.b; y += 14 * k) { ctx.beginPath(); ctx.moveTo(G.l, y); ctx.lineTo(G.r, y); ctx.stroke(); }
    ctx.lineJoin = 'round';
    for (const [col, wd, off] of [['rgba(0,0,0,.18)', 9, 3], ['#fff', 8, 0], ['#dfe6f2', 2.5, 2]]) { ctx.strokeStyle = col; ctx.lineWidth = wd * k; ctx.beginPath(); ctx.moveTo(G.l + off * k, G.b); ctx.lineTo(G.l + off * k, G.t + off * k); ctx.lineTo(G.r + off * k, G.t + off * k); ctx.lineTo(G.r + off * k, G.b); ctx.stroke(); }
  }
  function drawBall() {
    const start = { x: W / 2, y: H * 0.84 };
    let x = start.x, y = start.y, s = 1;
    if (anim) {
      const sh = anim.shot, f = Math.min(1, anim.t / 0.55), e = 1 - (1 - f) ** 2;
      const end = toScreen(sh.gx, sh.gy);
      x = start.x + (end.x - start.x) * e; y = start.y + (end.y - start.y) * e - Math.sin(f * Math.PI) * 40 * k; s = 1 - 0.55 * e;
      if (anim.saved && anim.t > 0.55) { const g = anim.t - 0.55; x += (sh.gx < 0 ? -1 : 1) * g * 260 * k; y += g * 300 * k; }
      if (anim.wide && anim.t > 0.55) { const g = anim.t - 0.55; x += sh.gx * g * 200 * k; y -= g * 160 * k; s *= Math.max(0.3, 1 - g); }
    }
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, (anim ? Math.max(y, G.b) : y) + 18 * k * s, 20 * k * s, 6 * k * s, 0, 0, Math.PI * 2); ctx.fill();
    if (anim && anim.t < 0.6) fx.puff(x, y, 'rgba(255,255,255,.75)', 7 * k * s);
    fx.draw(ctx);
    ctx.save(); ctx.translate(x, y); ctx.rotate((anim?.t || 0) * 14); drawEmoji(ctx, '⚽', 0, 0, 44 * k * s); ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const tnow = performance.now() / 1000, line = G.b + 6, cheer = msg && msg.startsWith('GOO') ? 1 : 0;
    // langit + tribun penonton
    const sk = ctx.createLinearGradient(0, 0, 0, line); sk.addColorStop(0, '#8fd3ff'); sk.addColorStop(1, '#dff3ff');
    ctx.fillStyle = sk; ctx.fillRect(0, 0, W, line);
    const st0 = Math.max(10 * k, G.t - 62 * k), st1 = line - 24 * k;
    const sg = ctx.createLinearGradient(0, st0, 0, st1); sg.addColorStop(0, '#6a58a8'); sg.addColorStop(1, '#8f7bd0');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(0, st0 + 10 * k); ctx.quadraticCurveTo(W / 2, st0 - 14 * k, W, st0 + 10 * k); ctx.lineTo(W, st1); ctx.lineTo(0, st1); ctx.fill();
    const CC = ['#ff8fb7', '#ffd166', '#8fd3ff', '#fff', '#b9f0d2', '#ffb38a'];
    for (let r = 0, y = st0 + 16 * k; y < st1 - 4 * k; r++, y += 11 * k) {
      for (let c = 0, x = (r % 2) * 5 * k + 4 * k; x < W; c++, x += 10.5 * k) {
        const h = Math.sin(r * 12.9 + c * 78.2) * 43758.5; const u = h - Math.floor(h);
        ctx.fillStyle = CC[Math.floor(u * 6)];
        ctx.beginPath(); ctx.arc(x, y - (cheer ? Math.abs(Math.sin(tnow * 11 + u * 9)) * 5 * k : Math.sin(tnow * 2 + u * 9) * 0.8 * k), 3.6 * k, 0, Math.PI * 2); ctx.fill();
      }
    }
    // papan iklan di pinggir lapangan
    const AD = [['#ff6f9f', 'LOVE QUEST'], ['#7f63f0', '💖 GOL 💖'], ['#ffb020', 'AYO SAYANG!'], ['#2fbf71', '⚽ PENALTI']];
    const aw = W / 3;
    ctx.font = `700 ${Math.round(11 * k)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) { const ax = i * aw - aw * 0.35; ctx.fillStyle = AD[i][0]; ctx.fillRect(ax, st1, aw - 3, 24 * k); ctx.fillStyle = '#fff'; ctx.fillText(AD[i][1], ax + aw / 2, st1 + 12.5 * k); }
    // rumput belang (makin lebar ke arah kita)
    const pg = ctx.createLinearGradient(0, line, 0, H); pg.addColorStop(0, '#5fc470'); pg.addColorStop(1, '#3fa456');
    ctx.fillStyle = pg; ctx.fillRect(0, line, W, H - line);
    ctx.fillStyle = 'rgba(255,255,255,.09)';
    for (let i = 0; i < 7; i += 2) { const y0 = line + (H - line) * (i / 7) ** 1.5, y1 = line + (H - line) * ((i + 1) / 7) ** 1.5; ctx.fillRect(0, y0, W, y1 - y0); }
    const vg = ctx.createRadialGradient(W / 2, H * 0.8, H * 0.1, W / 2, H * 0.8, H * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,40,20,.22)');
    ctx.fillStyle = vg; ctx.fillRect(0, line, W, H - line);
    // kotak penalti
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, line); ctx.lineTo(W, line); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * 0.2, line); ctx.lineTo(W * 0.1, line + H * 0.14); ctx.lineTo(W * 0.9, line + H * 0.14); ctx.lineTo(W * 0.8, line); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.84 + 22 * k, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (cheer && !cheered) { cheered = true; for (let i = 0; i < 5; i++) fx.burst(W * (0.15 + 0.175 * i), G.t - 6 * k, { n: 16, colors: ['#ff8fb7', '#ffd166', '#8fd3ff', '#fff', '#b9f0d2'], speed: 230, life: 1.1, gravity: 320, up: 0.7 }); }
    if (!msg) cheered = false;
    drawGoal();
    const keeper = iShoot(turn) ? look.opp : look.me, shooter = iShoot(turn) ? look.me : look.opp;
    drawKeeper(keeper);
    // pilihan kiper (kita) sebelum ditendang
    if (phase === 'aim' && !iShoot(turn)) {
      for (let c = 0; c < 3; c++) for (let r = 0; r < 2; r++) {
        const on = mine && mine.col === c && mine.row === r;
        ctx.fillStyle = on ? 'rgba(255,111,159,.55)' : 'rgba(255,255,255,.32)';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        const x = G.l + (G.w / 3) * c, y = G.t + (r ? 0 : G.h / 2);
        ctx.fillRect(x + 3, y + 3, G.w / 3 - 6, G.h / 2 - 6); ctx.strokeRect(x + 3, y + 3, G.w / 3 - 6, G.h / 2 - 6);
      }
    }
    drawBall();
    // penendang (dari belakang), di samping bola
    const kicking = anim && anim.t < 0.35;
    drawToon(ctx, shooter.toon, kicking ? 'kick' : 'idle', W / 2 - (kicking ? 40 : 70) * k, H * 0.9, 150 * k, 1, shooter.img, shooter.emoji, '#fff');
    // arah geseran
    if (swipe && swipe.a.y - swipe.b.y > 20 * k) { // titik bidik: kelihatan bola bakal ke mana sebelum dilepas
      const sa = swipe.a, sb = swipe.b, ddy = sa.y - sb.y, midY = G.b - G.h / 2;
      const gx = Math.max(-1.35, Math.min(1.35, (sa.x + (sb.x - sa.x) * ((sa.y - midY) / ddy) - G.cx) / (G.w / 2)));
      const gy = Math.max(0, Math.min(1.08, (ddy / Math.max(1, sa.y - G.t)) * 1.1 - 0.06)), tp = toScreen(gx, gy);
      const ok = Math.abs(gx) <= 1 && gy <= 1;
      ctx.strokeStyle = ok ? '#fff' : '#ff6b6b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tp.x, tp.y, 16 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tp.x - 24 * k, tp.y); ctx.lineTo(tp.x + 24 * k, tp.y); ctx.moveTo(tp.x, tp.y - 24 * k); ctx.lineTo(tp.x, tp.y + 24 * k); ctx.stroke();
    }
    if (swipe) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 6; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(swipe.a.x, swipe.a.y); ctx.lineTo(swipe.b.x, swipe.b.y); ctx.stroke(); ctx.setLineDash([]); }
    // papan skor
    const row = (arr, y, who) => {
      ctx.save(); ctx.translate(18, y); drawFace(ctx, who.img, 0, 0, 11 * k, who.emoji); ctx.restore();
      const n = Math.max(ROUNDS, arr.length);
      for (let i = 0; i < n; i++) { ctx.fillStyle = i < arr.length ? (arr[i] ? '#2fbf71' : '#ff4d6d') : 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(40 + i * 16, y, 6, 0, Math.PI * 2); ctx.fill(); }
    };
    if (duel) { row(goals.me, 16, look.me); row(goals.opp, 36, look.opp); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // teks tengah
    const big = (t, y, size, color) => { ctx.font = `700 ${Math.round(size * k)}px Fredoka, sans-serif`; ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeText(t, W / 2, y); ctx.fillStyle = color; ctx.fillText(t, W / 2, y); };
    if (phase === 'aim') {
      const left = Math.ceil(AIM_TIME - phaseT);
      if (!mine) big(iShoot(turn) ? `Geser ⚽ ke gawang · ${left}` : `Tap kotak buat lompat · ${left}`, H * 0.62, 19, '#c2306f');
      else if (!theirs) big(`Nunggu ${look.opp.name}… 👀`, H * 0.62, 19, '#8a3f6e');
      if (iShoot(turn) && !mine) big('tarik makin jauh = makin tinggi', H * 0.67, 14, '#8a3f6e');
    }
    if (msg) big(msg, H * 0.58, 38, msg.startsWith('GOO') ? '#ff6f9f' : '#5b3fa8');
    const s = duel ? `⚽ ${look.me.name} ${tally(goals.me)} - ${tally(goals.opp)} ${look.opp.name}` : goalMode ? `⚽ Berhasil ${score} · target ${p.goal} · giliran ${Math.min(10, turn + 1)}/10` : `⚽ Skor ${score} · 🏆 ${Math.max(p.best || 0, score)} · ${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(3 - Math.max(0, lives))}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (!done) update(dt);
    fx.step(dt);
    draw();
  }
  startTurn();
  raf = requestAnimationFrame(loop);

  function end() {
    if (done) return;
    done = true;
    if (goalMode) { const win = score >= p.goal; api.finish({ win, stars: win ? (score >= p.goal + 2 ? 3 : score >= p.goal + 1 ? 2 : 1) : 0, detail: `${score}/10 berhasil (gol + tepisan) · target ${p.goal}` }); return; }
    if (!duel) { api.finish({ win: true, score, detail: `${score} kali berhasil (gol + tepisan)` }); return; }
    const a = tally(goals.me), b = tally(goals.opp);
    api.finish({ win: a > b, draw: a === b, myGoals: a, oppGoals: b });
  }

  return {
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
      offs.forEach((f) => f());
      window.removeEventListener('resize', resize);
    },
  };
}
