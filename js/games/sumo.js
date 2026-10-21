// Sumo Gemoy: dua pesumo bulat di atas matras melayang. Joystick buat jalan (licin, ada momentum), 💥 Seruduk buat
// dorong kenceng. Yang keluar dari lingkaran jatuh & kalah ronde. Matrasnya makin lama makin kecil.
// Kadang muncul 🍔 (jadi gendut & berat 6 detik, susah didorong) atau 🌶️ (seruduk tanpa jeda 6 detik).
// Sendiri: lawan bot (p.botLevel), menang 2 ronde duluan; mode skor (p.endless): lawan makin jago, skor = menang beruntun.
// Berdua (p.duel): tiap HP ngurus badannya sendiri. Dorongan dihitung di HP yang didorong (posisi & kecepatan lawan dikirim),
// HP yang jatuh yang ngabarin. Item muncul pakai seed yang sama di dua HP.
import { drawEmoji, drawFace, loadImage, keyHint } from '../util.js';

const AW = 1000, AH = 1000, CX = 500, CY = 500, R = 84;
const ACC = 1600, MAXV = 380, FRICTION = 2.2, DASH_V = 880, DASH_T = 0.28, DASH_CD = 1.3;
const RING0 = 420, RING_MIN = 260, SHRINK_FROM = 12, SHRINK_TO = 50; // detik
const WIN_ROUNDS = 2;
const TILT = 0.58; // kamera miring: lantai dipipihin biar keliatan 3D
const hash = (a, b) => { let n = (a * 374761393 + b * 668265263) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

function body(x, y, look) { return { x, y, vx: 0, vy: 0, dash: 0, dashCd: 0, big: 0, hot: 0, out: 0, face: 1, ...look }; }

export function startSumo(stage, p, api) {
  const wrap = document.createElement('div'); wrap.className = 'fight-wrap'; stage.appendChild(wrap);
  const view = document.createElement('div'); view.className = 'fight-view'; wrap.appendChild(view);
  const canvas = document.createElement('canvas'); canvas.className = 'catch-canvas'; view.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const pad = document.createElement('div'); pad.className = 'fight-pad pw-pad';
  pad.innerHTML = '<div class="pw-stick"><span></span></div><div class="fp-act"><button data-k="dash" data-label="Seruduk" class="sm-dash" aria-label="Seruduk">💥</button></div>';
  wrap.appendChild(pad);
  keyHint(wrap, [['W A S D / ←↑↓→', 'jalan'], ['Spasi / J', 'seruduk']]);
  const knob = pad.querySelector('.pw-stick span');

  let W = 0, H = 0, sc = 1, ox = 0, oy = 0;
  function resize() {
    const r = view.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const span = (RING0 + 70) * 2;
    sc = Math.min((W - 10) / span, (H - 70) / (span * TILT + 230)); ox = W / 2; oy = 40 + (H - 40) * 0.56;
  }
  resize();

  const duel = p.duel || null;
  const flip = duel && duel.role === 'pengirim'; // HP kedua: arenanya diputar, dirinya tetap di bawah
  const canon = (x, y) => (flip ? [AW - x, AH - y] : [x, y]);
  const seed = (p.seed || 4321) >>> 0;
  const me = body(CX, CY + 175, { img: loadImage(p.face), emoji: p.emoji || '😊', name: p.name || 'Kamu', ring: '#ff8fb7' });
  const opp = body(CX, CY - 175, { img: loadImage(p.oppFace), emoji: p.oppEmoji || '🐻', name: p.oppName || 'Lawan', ring: '#9fb4ff' });
  let level = p.botLevel || 0, round = 1, myWins = 0, oppWins = 0, streak = 0;
  let state = 'intro', stateT = 0, t = 0, ring = RING0, roundResult = null, items = [], itemN = 0, shake = 0;
  let done = false, raf = 0, last = performance.now(), lastStats = '', lastSent = 0, shrinkSaid = false;
  let dust = [], floats = [], stars = [];
  const petals = Array.from({ length: 16 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8, w: Math.random() * 6, sp: 0.03 + Math.random() * 0.05 }));
  const offs = [];

  // ---- Input ----
  const stick = { x: 0, y: 0, id: null };
  const stickEl = pad.querySelector('.pw-stick');
  function stickAt(e) {
    const r = stickEl.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    stick.x = dx; stick.y = dy;
    knob.style.transform = `translate(${dx * r.width * 0.3}px, ${dy * r.width * 0.3}px)`;
  }
  stickEl.addEventListener('pointerdown', (e) => { e.preventDefault(); stick.id = e.pointerId; try { stickEl.setPointerCapture(e.pointerId); } catch {} stickAt(e); });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) stickAt(e); });
  const rel = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  stickEl.addEventListener('pointerup', rel); stickEl.addEventListener('pointercancel', rel);
  pad.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; e.preventDefault(); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); dash(me, inputDir()); });
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  const keys = {};
  const onKey = (e) => {
    const down = e.type === 'keydown';
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(e.key)) { e.preventDefault(); keys[e.key] = down; }
    if (down && !e.repeat && (e.key === ' ' || e.key === 'j')) { e.preventDefault(); dash(me, inputDir()); }
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('resize', resize);
  function inputDir() {
    const mx = stick.x + ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
    const my = stick.y + ((keys.ArrowDown || keys.s) ? 1 : 0) - ((keys.ArrowUp || keys.w) ? 1 : 0);
    return [mx, my];
  }

  // ---- Aksi ----
  const rad = (a) => R * (a.big > 0 ? 1.28 : 1);
  const mass = (a) => (a.big > 0 ? 1.8 : 1);
  function dash(a, [mx, my]) {
    if (state !== 'fight' || a.out || (a.dashCd > 0 && a.hot <= 0)) return;
    let m = Math.hypot(mx, my);
    if (m < 0.2) { const o = a === me ? opp : me; mx = o.x - a.x; my = o.y - a.y; m = Math.hypot(mx, my) || 1; } // nggak megang joystick: seruduk ke arah lawan
    a.vx = (mx / m) * DASH_V; a.vy = (my / m) * DASH_V;
    a.dash = DASH_T; a.dashCd = a.hot > 0 ? 0.35 : DASH_CD;
    for (let i = 0; i < 5; i++) dust.push({ x: a.x - (mx / m) * R, y: a.y - (my / m) * R, vx: (Math.random() - 0.5) * 160 - (mx / m) * 120, vy: (Math.random() - 0.5) * 160 - (my / m) * 120, life: 0.5 });
    if (a === me) api.sfx('whoosh');
  }
  function physics(a, mx, my, dt) {
    a.dash = Math.max(0, a.dash - dt); a.dashCd = Math.max(0, a.dashCd - dt); a.big = Math.max(0, a.big - dt); a.hot = Math.max(0, a.hot - dt);
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    if (a.dash <= 0) {
      a.vx += mx * ACC * dt; a.vy += my * ACC * dt;
      const k = Math.exp(-FRICTION * dt); a.vx *= k; a.vy *= k;
      const v = Math.hypot(a.vx, a.vy), cap = MAXV * (a.big > 0 ? 0.85 : 1);
      if (v > cap && a.dashCd < DASH_CD - DASH_T - 0.15) { a.vx *= cap / v; a.vy *= cap / v; }
    }
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (Math.abs(a.vx) > 8) a.face = a.vx > 0 ? 1 : -1;
  }
  // Tabrakan: dorong keluar + tukeran momentum. Seruduk bikin dorongannya jauh lebih kenceng.
  function bump(a, b, onlyA) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = rad(a) + rad(b);
    if (d >= min) return false;
    const nx = dx / d, ny = dy / d, over = min - d;
    const ma = mass(a), mb = mass(b);
    if (onlyA) { a.x -= nx * over * 0.6; a.y -= ny * over * 0.6; } else { a.x -= nx * over * mb / (ma + mb); a.y -= ny * over * mb / (ma + mb); b.x += nx * over * ma / (ma + mb); b.y += ny * over * ma / (ma + mb); }
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) {
      const boostA = b.dash > 0 ? 1.9 : 1, boostB = a.dash > 0 ? 1.9 : 1; // yang nyeruduk ngasih dorongan ekstra
      const j = (-(1.15) * rv) / (1 / ma + 1 / mb);
      a.vx -= (j / ma) * nx * boostA; a.vy -= (j / ma) * ny * boostA;
      if (!onlyA) { b.vx += (j / mb) * nx * boostB; b.vy += (j / mb) * ny * boostB; }
      const hard = Math.abs(rv) > 420 || a.dash > 0 || b.dash > 0;
      if (hard) {
        shake = 0.25; api.sfx('thud'); a.sq = 1; b.sq = 1;
        stars.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, life: 0.5 });
        floats.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 60, text: ['Duk! 💥', 'Bruk!', 'Hiyaaa!', 'Gedebuk!'][Math.floor(Math.random() * 4)], life: 0.9 });
        for (let i = 0; i < 8; i++) dust.push({ x: a.x + nx * rad(a), y: a.y + ny * rad(a), vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, life: 0.55 });
      }
    }
    return true;
  }

  // ---- Bot ----
  const bot = { t: 0, dashWait: 0.8 };
  function botThink(dt) {
    const lvl = Math.min(level, 8);
    bot.t -= dt; bot.dashWait -= dt;
    const toC = Math.hypot(opp.x - CX, opp.y - CY);
    const dx = me.x - opp.x, dy = me.y - opp.y, d = Math.hypot(dx, dy) || 1;
    // kalau udah mepet pinggir: balik ke tengah dulu
    if (toC > ring - R * (1.6 - lvl * 0.06)) return [(CX - opp.x) / toC, (CY - opp.y) / toC];
    // cari posisi di antara kita & tengah matras (biar dorongannya ngarah keluar)
    const myC = Math.hypot(me.x - CX, me.y - CY) || 1;
    const gx = me.x - ((me.x - CX) / myC) * R * 2.2, gy = me.y - ((me.y - CY) / myC) * R * 2.2;
    let tx = gx - opp.x, ty = gy - opp.y; const tm = Math.hypot(tx, ty) || 1;
    const smart = 0.35 + lvl * 0.08;
    let mx = (tx / tm) * smart + (dx / d) * (1 - smart), my = (ty / tm) * smart + (dy / d) * (1 - smart);
    if (d < R * 3.6 && bot.dashWait <= 0 && opp.dashCd <= 0 && Math.random() < (0.5 + lvl * 0.1) * dt * 6) {
      const aim = 0.25 - lvl * 0.025; // makin jago makin pas ngincer
      dash(opp, [dx / d + (Math.random() - 0.5) * aim * 2, dy / d + (Math.random() - 0.5) * aim * 2]);
      bot.dashWait = Math.max(0.5, 1.6 - lvl * 0.13) * (0.7 + Math.random() * 0.6);
    }
    const sp = 0.7 + lvl * 0.04;
    return [mx * sp, my * sp];
  }

  // ---- Online ----
  function sendState(force) {
    if (!duel) return;
    const now = performance.now();
    if (!force && now - lastSent < 90) return;
    lastSent = now;
    const [x, y] = canon(me.x, me.y);
    duel.send('sstate', { r: round, x: Math.round(x), y: Math.round(y), vx: Math.round(flip ? -me.vx : me.vx), vy: Math.round(flip ? -me.vy : me.vy), d: me.dash > 0 ? 1 : 0, b: me.big > 0 ? 1 : 0, f: me.face * (flip ? -1 : 1) });
  }
  if (duel) {
    offs.push(duel.on('sstate', (d) => { if (d.r !== round) return; const [x, y] = canon(d.x, d.y); opp.tx = x; opp.ty = y; opp.vx = flip ? -d.vx : d.vx; opp.vy = flip ? -d.vy : d.vy; opp.dash = d.d ? 0.1 : 0; opp.big = d.b ? 0.2 : 0; opp.face = d.f * (flip ? -1 : 1); }));
    offs.push(duel.on('sout', (d) => { if (d.r === round && state === 'fight') { opp.out = 0.01; finishRound(true); } }));
    offs.push(duel.on('spick', (d) => { items = items.filter((it) => it.n !== d.n); }));
  }

  // ---- Item (sama di dua HP: posisi & waktunya dari seed) ----
  function spawnItems() {
    const due = 9 + itemN * 9;
    if (t < due || items.length) return;
    const h = hash(seed + round * 17, itemN), a = hash(seed + round * 29, itemN) * Math.PI * 2, rr = h * Math.max(60, ring - 160);
    items.push({ n: itemN, k: hash(seed + 7, itemN + round) < 0.5 ? 'big' : 'hot', x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, life: 7 });
    itemN++;
  }

  function resetRound() {
    Object.assign(me, body(CX, CY + 175, { img: me.img, emoji: me.emoji, name: me.name, ring: me.ring }));
    Object.assign(opp, body(CX, CY - 175, { img: opp.img, emoji: opp.emoji, name: opp.name, ring: opp.ring }));
    opp.tx = opp.ty = undefined;
    t = 0; ring = RING0; items = []; itemN = 0; state = 'intro'; stateT = 0; roundResult = null; shrinkSaid = false;
  }
  function finishRound(iWon) {
    if (state !== 'fight') return;
    state = 'over'; stateT = 0; roundResult = iWon;
    if (iWon) { myWins++; api.sfx('win'); api.streak(true); } else { oppWins++; api.sfx('lose'); api.streak(false); }
  }

  function update(dt) {
    stateT += dt;
    for (const d of dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.9; d.vy *= 0.9; d.life -= dt; }
    dust = dust.filter((d) => d.life > 0);
    for (const f of floats) { f.y -= 60 * dt; f.life -= dt; }
    floats = floats.filter((f) => f.life > 0);
    for (const st of stars) st.life -= dt;
    stars = stars.filter((st) => st.life > 0);
    for (const pt of petals) { pt.y += pt.sp * dt; pt.x += Math.sin(pt.w + pt.y * 9) * 0.02 * dt; if (pt.y > 1.05) { pt.y = -0.05; pt.x = Math.random(); } }
    shake = Math.max(0, shake - dt);
    for (const a of [me, opp]) { if (a.out) a.out += dt; a.walk = (a.walk || 0) + Math.hypot(a.vx, a.vy) * dt * 0.035; a.sq = Math.max(0, (a.sq || 0) - dt * 4); }
    if (state === 'intro') { if (stateT > 1.3) { state = 'fight'; stateT = 0; } return; }
    if (state === 'over') { if (stateT > 2) nextRound(); return; }
    t += dt;
    // matras makin kecil
    const k = Math.min(1, Math.max(0, (t - SHRINK_FROM) / (SHRINK_TO - SHRINK_FROM)));
    ring = RING0 - (RING0 - RING_MIN) * k;
    if (!shrinkSaid && t > SHRINK_FROM) { shrinkSaid = true; api.say('⚠️ Matrasnya mulai mengecil!', 'happy'); }
    spawnItems();
    for (const it of items) it.life -= dt;
    items = items.filter((it) => it.life > 0);

    const [mx, my] = inputDir();
    physics(me, mx, my, dt);
    if (duel) {
      if (opp.tx != null) { opp.x += (opp.tx - opp.x) * Math.min(1, dt * 14); opp.y += (opp.ty - opp.y) * Math.min(1, dt * 14); }
      opp.dash = Math.max(0, opp.dash - dt);
      bump(me, opp, true); // HP ini cuma ngurus dorongan ke dirinya sendiri
    } else {
      const [bx, by] = botThink(dt);
      physics(opp, bx, by, dt);
      bump(me, opp, false);
    }
    // ambil item
    for (const a of duel ? [me] : [me, opp]) for (const it of [...items]) {
      if (Math.hypot(it.x - a.x, it.y - a.y) < rad(a) + 30) {
        items = items.filter((q) => q !== it);
        if (it.k === 'big') a.big = 6; else a.hot = 6;
        if (a === me) { api.sfx('gold'); api.say(it.k === 'big' ? '🍔 Jadi gendut! Susah didorong 6 detik' : '🌶️ Pedes! Seruduk tanpa jeda 6 detik', 'happy'); }
        if (duel) duel.send('spick', { n: it.n });
      }
    }
    sendState(false);
    // jatuh?
    const outMe = Math.hypot(me.x - CX, me.y - CY) > ring + R * 0.35;
    const outOpp = !duel && Math.hypot(opp.x - CX, opp.y - CY) > ring + R * 0.35;
    if (outMe) { me.out = 0.01; if (duel) { duel.send('sout', { r: round }); sendState(true); } finishRound(false); }
    else if (outOpp) { opp.out = 0.01; finishRound(true); }
  }
  function nextRound() {
    const target = p.endless ? 1 : WIN_ROUNDS;
    if (p.endless) {
      if (!roundResult) { end(); return; }
      streak++; level++; round++; myWins = oppWins = 0; resetRound();
      api.sfx('go'); api.say(`Menang! 🏆 Lawan ke-${streak + 1} makin kuat 💪`, 'happy');
      return;
    }
    if (myWins >= target || oppWins >= target) { end(); return; }
    round++; resetRound(); api.sfx('go');
  }

  // ---- Gambar (kamera miring 3/4: x lurus, y dipipihin; badan digambar berdiri di titik kakinya) ----
  const X = (x) => ox + (x - CX) * sc, Y = (y) => oy + (y - CY) * sc * TILT;
  const SKIN = ['#ffe3cf', '#f4b993'];
  function drawSumo(a) {
    const r = rad(a) * sc * 1.3, fall = a.out ? Math.min(1.4, a.out * 1.4) : 0; // digambar agak gede biar gemoy
    if (fall >= 1.4) return;
    let x = X(a.x), y = Y(a.y);
    const moving = Math.hypot(a.vx, a.vy) > 40 && !a.out, step = moving ? Math.sin(a.walk * 6) : 0;
    const sq = (a.sq || 0) * 0.18, dashing = a.dash > 0;
    // bayangan di lantai
    if (!fall) { ctx.fillStyle = 'rgba(70,35,30,.25)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, r * 0.42, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save();
    ctx.translate(x, y + fall * fall * 260 * sc); ctx.rotate(fall * a.face * 1.8); ctx.globalAlpha = Math.max(0, 1 - fall * 0.55);
    ctx.scale(a.face * (1 + sq), 1 - sq + (dashing ? -0.05 : 0));
    const bob = moving ? Math.abs(step) * r * 0.08 : Math.sin(performance.now() / 300) * r * 0.03;
    // kaki pendek gempal (gantian naik pas jalan)
    for (const s of [-1, 1]) { const lift = moving ? Math.max(0, s * step) * r * 0.25 : 0; ctx.fillStyle = SKIN[1]; ctx.beginPath(); ctx.ellipse(s * r * 0.48, -r * 0.18 - lift, r * 0.3, r * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e9a37d'; ctx.beginPath(); ctx.ellipse(s * r * 0.48, -r * 0.06 - lift, r * 0.28, r * 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
    const by = -r * 1.05 - bob; // tengah perut
    // perut bulat besar
    const g = ctx.createRadialGradient(-r * 0.35, by - r * 0.35, r * 0.15, 0, by, r * 1.25); g.addColorStop(0, SKIN[0]); g.addColorStop(1, SKIN[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, by, r * 1.12, r * 0.98, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(190,110,80,.35)'; ctx.lineWidth = Math.max(1.5, r * 0.04); ctx.stroke();
    ctx.fillStyle = 'rgba(200,110,90,.5)'; ctx.beginPath(); ctx.ellipse(0, by + r * 0.12, r * 0.06, r * 0.08, 0, 0, Math.PI * 2); ctx.fill(); // pusar
    // sabuk mawashi + simpul & juntai depan
    const belt = a.ring, beltY = by + r * 0.45;
    ctx.fillStyle = belt; ctx.beginPath(); ctx.ellipse(0, beltY, r * 1.0, r * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-r * 0.2, beltY - r * 0.08, r * 0.55, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = belt; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(i * r * 0.11 - r * 0.04, beltY + r * 0.12, r * 0.08, r * 0.3, r * 0.03) : ctx.rect(i * r * 0.11 - r * 0.04, beltY + r * 0.12, r * 0.08, r * 0.3); ctx.fill(); }
    // tangan: di samping; pas seruduk dua-duanya maju ke depan
    ctx.fillStyle = SKIN[1];
    if (dashing) { for (const s of [-0.18, 0.18]) { ctx.beginPath(); ctx.ellipse(r * 1.12, by + s * r * 1.6, r * 0.3, r * 0.24, 0, 0, Math.PI * 2); ctx.fill(); } }
    else for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 1.05, by + r * 0.05 + (moving ? s * step * r * 0.1 : 0), r * 0.26, r * 0.3, s * 0.3, 0, Math.PI * 2); ctx.fill(); }
    // kepala = foto muka + sanggul sumo (chonmage) + pipi merah
    const hy = by - r * 1.15, hr = r * 0.62;
    ctx.fillStyle = '#2b2230'; ctx.beginPath(); ctx.ellipse(0, hy - hr * 1.02, hr * 0.32, hr * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-hr * 0.08, hy - hr * 1.0, hr * 0.16, hr * 0.2);
    ctx.save(); ctx.scale(a.face, 1); drawFace(ctx, a.img, 0, hy, hr, a.emoji, a.ring); ctx.restore();
    ctx.fillStyle = 'rgba(255,120,140,.35)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * hr * 0.62, hy + hr * 0.35, hr * 0.18, hr * 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
    if (dashing) { ctx.strokeStyle = 'rgba(255,190,60,.85)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-r * (1.3 + i * 0.2), by - r * 0.4 + i * r * 0.4); ctx.lineTo(-r * (1.9 + i * 0.25), by - r * 0.4 + i * r * 0.4); ctx.stroke(); } }
    ctx.restore();
    // efek item (nggak ikut dibalik)
    if (!fall) { if (a.big > 0) drawEmoji(ctx, '🍔', x + r * 0.95, Y(a.y) - r * 2.7, r * 0.55); if (a.hot > 0) { drawEmoji(ctx, '🌶️', x - r * 0.95, Y(a.y) - r * 2.7, r * 0.55); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 80); ctx.fillStyle = 'rgba(255,90,40,.25)'; ctx.beginPath(); ctx.ellipse(x, Y(a.y) - r, r * 1.4, r * 1.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } }
    if (a.out && fall < 1) { ctx.font = `700 ${Math.round(22 * Math.max(0.8, sc * 2.4))}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#e8455f'; ctx.strokeText('Aaaa~ 😵', x, y - r * 3.4); ctx.fillText('Aaaa~ 😵', x, y - r * 3.4); }
  }
  function banner(text, sub) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(36 * Math.min(1.3, W / 380))}px Fredoka, sans-serif`;
    ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#e8558f';
    ctx.strokeText(text, W / 2, H * 0.3); ctx.fillText(text, W / 2, H * 0.3);
    if (sub) { ctx.font = '600 16px Fredoka, sans-serif'; ctx.lineWidth = 5; ctx.strokeText(sub, W / 2, H * 0.3 + 34); ctx.fillStyle = '#8a3f6e'; ctx.fillText(sub, W / 2, H * 0.3 + 34); }
  }
  // Latar: matahari senja, gunung, awan (gambar sekali kecuali ukuran berubah)
  function sky(now) {
    const sx = W * 0.72, sy = H * 0.2, sr = Math.min(W, H) * 0.13;
    const gl = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 2.6); gl.addColorStop(0, 'rgba(255,236,170,.75)'); gl.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, sr * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff1c7'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    // gunung berpuncak salju
    const base = H * 0.42;
    ctx.fillStyle = '#c99ad1'; ctx.beginPath(); ctx.moveTo(-10, base); ctx.lineTo(W * 0.18, base - H * 0.12); ctx.lineTo(W * 0.42, base - H * 0.05); ctx.lineTo(W * 0.62, base - H * 0.16); ctx.lineTo(W * 0.85, base - H * 0.06); ctx.lineTo(W + 10, base - H * 0.1); ctx.lineTo(W + 10, base); ctx.fill();
    ctx.fillStyle = '#b07fc4'; ctx.beginPath(); ctx.moveTo(W * 0.2, base); ctx.lineTo(W * 0.4, base - H * 0.2); ctx.lineTo(W * 0.6, base); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(W * 0.4, base - H * 0.2); ctx.lineTo(W * 0.445, base - H * 0.155); ctx.lineTo(W * 0.42, base - H * 0.16); ctx.lineTo(W * 0.4, base - H * 0.145); ctx.lineTo(W * 0.38, base - H * 0.16); ctx.lineTo(W * 0.355, base - H * 0.155); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const [cx0, cy0, s0] of [[0.15, 0.12, 1], [0.55, 0.08, 0.8], [0.9, 0.3, 0.9]]) { const cx = ((cx0 + now * 0.004 * s0) % 1.2 - 0.1) * W, cy = cy0 * H, k = Math.min(W, H) * 0.05 * s0; for (const [dx, dy, rr] of [[-1.4, 0.3, 0.9], [0, 0, 1.2], [1.4, 0.3, 0.9]]) { ctx.beginPath(); ctx.arc(cx + dx * k, cy + dy * k, rr * k, 0, Math.PI * 2); ctx.fill(); } }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const now = performance.now() / 1000;
    sky(now);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 26, (Math.random() - 0.5) * shake * 26);
    const cx = X(CX), cy = Y(CY), P = (RING0 + 70) * sc, PT = P * TILT, depth = 46 * sc;
    // pulau melayang (batu & rumput) di bawah panggung
    ctx.fillStyle = 'rgba(120,70,120,.18)'; ctx.beginPath(); ctx.ellipse(cx, cy + PT + depth + 60 * sc, P * 0.9, PT * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8c6a5a'; ctx.beginPath(); ctx.moveTo(cx - P * 1.02, cy + depth * 0.6); ctx.quadraticCurveTo(cx - P * 0.5, cy + PT + depth * 3.5, cx, cy + PT + depth * 4.2); ctx.quadraticCurveTo(cx + P * 0.5, cy + PT + depth * 3.5, cx + P * 1.02, cy + depth * 0.6); ctx.fill();
    ctx.fillStyle = '#7ccf74'; ctx.beginPath(); ctx.ellipse(cx, cy + depth * 0.7, P * 1.05, PT * 1.05, 0, 0, Math.PI * 2); ctx.fill();
    // panggung dohyo: tanah liat persegi yang ditinggiin (ada sisi depan)
    const sq = P * 0.98;
    ctx.fillStyle = '#b67a52'; ctx.beginPath(); ctx.moveTo(cx - sq, cy); ctx.lineTo(cx, cy + sq * TILT); ctx.lineTo(cx + sq, cy); ctx.lineTo(cx + sq, cy + depth); ctx.lineTo(cx, cy + sq * TILT + depth); ctx.lineTo(cx - sq, cy + depth); ctx.fill();
    ctx.fillStyle = '#9c6544'; ctx.beginPath(); ctx.moveTo(cx, cy + sq * TILT); ctx.lineTo(cx + sq, cy); ctx.lineTo(cx + sq, cy + depth); ctx.lineTo(cx, cy + sq * TILT + depth); ctx.fill();
    const clay = ctx.createRadialGradient(cx, cy, 10, cx, cy, sq); clay.addColorStop(0, '#f2d3a6'); clay.addColorStop(1, '#dcb07c');
    ctx.fillStyle = clay; ctx.beginPath(); ctx.moveTo(cx - sq, cy); ctx.lineTo(cx, cy - sq * TILT); ctx.lineTo(cx + sq, cy); ctx.lineTo(cx, cy + sq * TILT); ctx.fill();
    // area di luar tali = bahaya (lebih gelap), dalam tali = pasir terang
    ctx.fillStyle = 'rgba(140,80,50,.18)'; ctx.beginPath(); ctx.ellipse(cx, cy, (RING0 + 20) * sc, (RING0 + 20) * sc * TILT, 0, 0, Math.PI * 2); ctx.fill();
    const sand = ctx.createRadialGradient(cx, cy - ring * sc * TILT * 0.3, 10, cx, cy, ring * sc); sand.addColorStop(0, '#fff6e2'); sand.addColorStop(1, '#f3dcb2');
    ctx.fillStyle = sand; ctx.beginPath(); ctx.ellipse(cx, cy, ring * sc, ring * sc * TILT, 0, 0, Math.PI * 2); ctx.fill();
    // tali jerami (tawara) yang ikut mengecil, merah berkedip kalau udah mengecil
    const danger = ring < RING0 - 5 ? 0.5 + 0.5 * Math.sin(now * 8) : 0;
    ctx.lineWidth = Math.max(5, 16 * sc);
    ctx.strokeStyle = '#c9a76a'; ctx.beginPath(); ctx.ellipse(cx, cy + 4 * sc, ring * sc, ring * sc * TILT, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = danger ? `rgb(255,${Math.round(140 + 60 * danger)},${Math.round(120 + 60 * danger)})` : '#ecd49a'; ctx.beginPath(); ctx.ellipse(cx, cy, ring * sc, ring * sc * TILT, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([3 * sc, 22 * sc]); ctx.strokeStyle = 'rgba(150,110,50,.6)'; ctx.lineWidth = Math.max(3, 10 * sc); ctx.beginPath(); ctx.ellipse(cx, cy, ring * sc, ring * sc * TILT, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // garis start (shikiri-sen)
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(cx - 50 * sc, Y(CY - 100) - 2, 100 * sc, Math.max(3, 8 * sc * TILT)); ctx.fillRect(cx - 50 * sc, Y(CY + 92) - 2, 100 * sc, Math.max(3, 8 * sc * TILT));
    // lampion di 4 pojok panggung
    for (const [lx, ly] of [[cx - sq * 0.86, cy - 4], [cx + sq * 0.86, cy - 4], [cx, cy - sq * TILT * 0.9], [cx, cy + sq * TILT * 0.86]]) {
      const lh = 64 * sc, swing = Math.sin(now * 2 + lx) * 2;
      ctx.strokeStyle = '#6b4a3a'; ctx.lineWidth = Math.max(2, 4 * sc); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly - lh * 1.4); ctx.stroke();
      const lg = ctx.createRadialGradient(lx + swing, ly - lh * 1.4, 2, lx + swing, ly - lh * 1.4, lh * 0.9); lg.addColorStop(0, 'rgba(255,220,150,.7)'); lg.addColorStop(1, 'rgba(255,220,150,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx + swing, ly - lh * 1.4, lh * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6f8f'; ctx.beginPath(); ctx.ellipse(lx + swing, ly - lh * 1.4, lh * 0.32, lh * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2230'; ctx.fillRect(lx + swing - lh * 0.2, ly - lh * 1.84, lh * 0.4, lh * 0.08); ctx.fillRect(lx + swing - lh * 0.2, ly - lh * 1.04, lh * 0.4, lh * 0.08);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(lx + swing - lh * 0.03, ly - lh * 1.7, lh * 0.06, lh * 0.56);
    }
    for (const it of items) { const bob = Math.sin(now * 5 + it.n) * 6, ix = X(it.x), iy = Y(it.y); ctx.fillStyle = 'rgba(80,40,30,.2)'; ctx.beginPath(); ctx.ellipse(ix, iy, 26 * sc + 6, 9 * sc + 2, 0, 0, Math.PI * 2); ctx.fill(); const gl = ctx.createRadialGradient(ix, iy - 50 * sc, 2, ix, iy - 50 * sc, 70 * sc + 10); gl.addColorStop(0, 'rgba(255,240,150,.8)'); gl.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(ix, iy - 50 * sc, 70 * sc + 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = it.life < 1.5 ? 0.5 + 0.5 * Math.sin(now * 20) : 1; drawEmoji(ctx, it.k === 'big' ? '🍔' : '🌶️', ix, iy - 50 * sc + bob, 60 * sc + 12); ctx.globalAlpha = 1; }
    for (const d of dust) { ctx.globalAlpha = Math.min(1, d.life * 2); ctx.fillStyle = '#fff4dd'; ctx.beginPath(); ctx.arc(X(d.x), Y(d.y), 9 * sc + 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const a of [opp, me].sort((u, v) => u.y - v.y)) drawSumo(a);
    for (const st of stars) { const k = 1 - st.life / 0.5; ctx.globalAlpha = st.life * 2; for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI * 2; drawEmoji(ctx, '✨', X(st.x) + Math.cos(an) * (40 + k * 120) * sc, Y(st.y) - R * sc * 1.6 + Math.sin(an) * (25 + k * 70) * sc, 22 * sc + 6); } ctx.globalAlpha = 1; }
    ctx.font = '700 20px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#c2306f';
    for (const f of floats) { ctx.globalAlpha = Math.max(0, f.life); ctx.strokeText(f.text, X(f.x), Y(f.y) - R * sc * 4.6); ctx.fillText(f.text, X(f.x), Y(f.y) - R * sc * 4.6); }
    ctx.globalAlpha = 1;
    ctx.restore();
    // kelopak sakura jatuh
    for (const pt of petals) { ctx.save(); ctx.translate(pt.x * W, pt.y * H); ctx.rotate(pt.w + now * pt.s); ctx.fillStyle = 'rgba(255,182,206,.85)'; ctx.beginPath(); ctx.ellipse(0, 0, 6 * pt.s, 3.5 * pt.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    // HUD: skor ronde (bulatan) di kiri, ronde di kanan
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = '700 15px Fredoka, sans-serif'; ctx.fillStyle = '#5a2a52';
    const dots = (n) => '●'.repeat(n) + '○'.repeat(Math.max(0, WIN_ROUNDS - n));
    ctx.fillStyle = 'rgba(255,255,255,.85)'; const hudT = p.endless ? `🏆 Menang ${streak} · Lawan ${streak + 1}` : `${me.name} ${dots(myWins)}  vs  ${dots(oppWins)} ${opp.name}`;
    const hw = ctx.measureText(hudT).width + 20; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(6, 6, hw, 26, 13) : ctx.rect(6, 6, hw, 26); ctx.fill();
    ctx.fillStyle = '#5a2a52'; ctx.fillText(hudT, 16, 19);
    ctx.textAlign = 'right'; ctx.fillStyle = '#c2306f'; ctx.fillText(`Ronde ${round}`, W - 12, 19);
    if (state === 'intro') banner(p.endless ? `Lawan ke-${streak + 1}` : `Ronde ${round}`, 'Hakkeyoi! Dorong lawan keluar 💥');
    if (state === 'over') banner(roundResult ? 'Keluar! 🏆' : 'Jatuh 😵', roundResult ? `${opp.name} kedorong keluar matras` : 'Kamu kedorong keluar matras');
    pad.querySelector('.sm-dash').style.opacity = me.dashCd > 0 && me.hot <= 0 ? 0.45 : 1;
    const st = p.endless ? `🤼 Menang ${streak} · 🏆 ${Math.max(p.best || 0, streak)}` : `🤼 ${myWins} - ${oppWins} · ronde ${round}`;
    if (st !== lastStats) { api.setStats(st); lastStats = st; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (!done) update(dt);
    draw();
  }
  if (window.__lqTest) window.__sumo = { me, opp, get state() { return state; }, get ring() { return ring; }, get score() { return [myWins, oppWins]; }, setT: (v) => { t = v; } };
  raf = requestAnimationFrame(loop);
  api.say('Dorong lawan keluar matras! Joystick buat jalan, 💥 Seruduk buat dorong kenceng', 'happy');

  function end() {
    if (done) return;
    done = true;
    if (p.endless) { api.finish({ win: true, score: streak, detail: `Menang ${streak} kali beruntun 🤼` }); return; }
    const won = myWins > oppWins;
    if (!duel) { api.finish({ win: won, stars: won ? (oppWins === 0 ? 3 : 2) : 0, detail: won ? `Menang ${myWins}-${oppWins}! Lawannya kedorong keluar 🤼` : `${opp.name} lebih kuat, coba lagi! 💪` }); return; }
    api.finish({ win: won, myWins, oppWins });
  }

  return {
    destroy() {
      done = true; cancelAnimationFrame(raf); offs.forEach((f) => f());
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('resize', resize);
    },
  };
}
