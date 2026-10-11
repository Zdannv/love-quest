// Perang Bantal: arena kamar dilihat dari atas. Joystick buat jalan, 🛏️ lempar bantal (otomatis ngarah ke lawan),
// 💨 ngehindar cepat. Kasur & sofa bisa dipakai sembunyi. 5 nyawa, siapa yang habis duluan kalah.
// Sendiri (p.endless): lawan bot yang makin jago tiap ronde, skor = menang beruntun.
// Berdua (p.duel): tiap HP ngatur dirinya sendiri; HP yang kena lemparan yang mutusin "kena" (biar ngehindar terasa adil).
import { drawEmoji, drawFace, loadImage } from '../util.js';

const AW = 1000, AH = 1100, R = 62, PR = 30, SPEED = 430, PSPEED = 950, ROUND = 60, LIVES = 5;
// Rintangan simetris (diputar 180° tetap sama), biar dua HP bisa lihat dirinya di bawah
const BLOCKS = [
  { x: 390, y: 470, w: 220, h: 160, em: '🛏️' },
  { x: 110, y: 270, w: 200, h: 100, em: '🛋️' }, { x: 690, y: 730, w: 200, h: 100, em: '🛋️' },
  { x: 690, y: 270, w: 200, h: 100, em: '🪴' }, { x: 110, y: 730, w: 200, h: 100, em: '🪴' },
];

function player(x, y, img, emoji, name, ring) {
  return { x, y, hp: LIVES, ammo: 3, reload: 0, dash: 0, dashCd: 0, inv: 0, stun: 0, vx: 0, vy: 0, img, emoji, name, ring };
}

export function startPillow(stage, p, api) {
  const wrap = document.createElement('div');
  wrap.className = 'fight-wrap';
  stage.appendChild(wrap);
  const view = document.createElement('div');
  view.className = 'fight-view';
  wrap.appendChild(view);
  const canvas = document.createElement('canvas');
  canvas.className = 'catch-canvas';
  view.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const pad = document.createElement('div');
  pad.className = 'fight-pad pw-pad';
  pad.innerHTML = `<div class="pw-stick"><span></span></div><div class="fp-act"><button data-k="dash" data-label="Hindar" aria-label="Hindar">💨</button><button data-k="throw" data-label="Lempar" class="pw-throw" aria-label="Lempar">🛏️</button></div>`;
  wrap.appendChild(pad);
  const knob = pad.querySelector('.pw-stick span');

  let W = 0, H = 0, sc = 1, ox = 0, oy = 0;
  function resize() {
    const r = view.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc = Math.min((W - 12) / AW, (H - 44) / AH); // arena muat penuh di layar
    ox = (W - AW * sc) / 2; oy = 40 + (H - 44 - AH * sc) / 2;
  }
  resize();

  const duel = p.duel || null;
  const flip = duel && duel.role === 'pengirim'; // HP kedua: arenanya diputar biar dirinya tetap di bawah
  const canon = (x, y) => (flip ? [AW - x, AH - y] : [x, y]);
  const me = player(AW / 2, AH - 120, loadImage(p.face), p.emoji || '😊', p.name || 'Kamu', '#ff8fb7');
  const opp = player(AW / 2, 120, loadImage(p.oppFace), p.oppEmoji || '😈', p.oppName || 'Lawan', '#9fb4ff');
  let pillows = [], feathers = [], floats = [];
  let time = ROUND, state = p.endless || !duel ? 'intro' : 'fight', stateT = 0, done = false, raf = 0, last = performance.now(), lastStats = '', lastSent = 0;
  let wins = 0, level = p.botLevel || 0, roundResult = null, seq = 0;
  const stick = { x: 0, y: 0, id: null };
  const bot = { t: 0, gx: AW / 2, gy: 200, fire: 1.2 };
  const offs = [];

  // ---- Input ----
  const stickEl = pad.querySelector('.pw-stick');
  function stickAt(e) {
    const r = stickEl.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    stick.x = dx; stick.y = dy;
    knob.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`;
  }
  stickEl.addEventListener('pointerdown', (e) => { e.preventDefault(); stick.id = e.pointerId; try { stickEl.setPointerCapture(e.pointerId); } catch {} stickAt(e); });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) stickAt(e); });
  const release = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  stickEl.addEventListener('pointerup', release);
  stickEl.addEventListener('pointercancel', release);
  pad.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; e.preventDefault(); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); b.dataset.k === 'throw' ? throwAt(me, opp) : dash(me); });
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  const keys = {};
  const onKey = (e) => {
    const down = e.type === 'keydown';
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(e.key)) { e.preventDefault(); keys[e.key] = down; }
    if (down && !e.repeat && (e.key === ' ' || e.key === 'j')) { e.preventDefault(); throwAt(me, opp); }
    if (down && !e.repeat && (e.key === 'k' || e.key === 'Shift')) dash(me);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('resize', resize);

  // ---- Aksi ----
  function throwAt(a, b, lead = 0) {
    if (state !== 'fight' || a.ammo < 1 || a.stun > 0) { if (a === me && a.ammo < 1) api.sfx('bad'); return; }
    a.ammo--;
    const tx = b.x + b.vx * lead, ty = b.y + b.vy * lead;
    const d = Math.hypot(tx - a.x, ty - a.y) || 1;
    const pl = { id: `${a === me ? 'm' : 'o'}${seq++}`, x: a.x, y: a.y, vx: ((tx - a.x) / d) * PSPEED, vy: ((ty - a.y) / d) * PSPEED, owner: a === me ? 'me' : 'opp', life: 1.4, rot: 0 };
    pillows.push(pl);
    api.sfx('flip');
    if (duel && a === me) { const [cx, cy] = canon(pl.x, pl.y); duel.send('pthrow', { id: pl.id, x: Math.round(cx), y: Math.round(cy), vx: Math.round(flip ? -pl.vx : pl.vx), vy: Math.round(flip ? -pl.vy : pl.vy) }); }
  }
  function dash(a) {
    if (state !== 'fight' || a.dashCd > 0 || a.stun > 0) return;
    a.dash = 0.2; a.dashCd = 1.6;
    if (a === me) api.sfx('pop');
  }
  function hitBy(a, pl) {
    a.hp = Math.max(0, a.hp - 1);
    a.inv = 0.7; a.stun = 0.22;
    const d = Math.hypot(pl.vx, pl.vy) || 1;
    a.vx += (pl.vx / d) * 500; a.vy += (pl.vy / d) * 500;
    for (let i = 0; i < 6; i++) feathers.push({ x: a.x, y: a.y, vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420, life: 0.8, r: Math.random() * 6 });
    floats.push({ x: a.x, y: a.y - 70, text: 'Pukk! 🪶', life: 1 });
    api.sfx('bad');
  }

  // ---- Online ----
  function sendState(force) {
    if (!duel) return;
    const now = performance.now();
    if (!force && now - lastSent < 66) return;
    lastSent = now;
    const [cx, cy] = canon(me.x, me.y);
    duel.send('pstate', { x: Math.round(cx), y: Math.round(cy), hp: me.hp, am: me.ammo });
  }
  if (duel) {
    offs.push(duel.on('pstate', (d) => { const [x, y] = canon(d.x, d.y); opp.tx = x; opp.ty = y; opp.hp = d.hp; opp.ammo = d.am; }));
    offs.push(duel.on('pthrow', (d) => { const [x, y] = canon(d.x, d.y); pillows.push({ id: d.id, x, y, vx: flip ? -d.vx : d.vx, vy: flip ? -d.vy : d.vy, owner: 'opp', life: 1.4, rot: 0 }); api.sfx('flip'); }));
    offs.push(duel.on('phit', (d) => { const pl = pillows.find((q) => q.id === d.id); if (pl) { pl.life = 0; for (let i = 0; i < 6; i++) feathers.push({ x: pl.x, y: pl.y, vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420, life: 0.8, r: Math.random() * 6 }); } api.sfx('good'); }));
  }

  // ---- Gerak & tabrakan ----
  const blocked = (x, y, r) => BLOCKS.some((b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h);
  function move(a, mx, my, dt) {
    a.dash = Math.max(0, a.dash - dt); a.dashCd = Math.max(0, a.dashCd - dt); a.inv = Math.max(0, a.inv - dt); a.stun = Math.max(0, a.stun - dt);
    a.reload += dt; if (a.ammo < 3 && a.reload > 1.0) { a.ammo++; a.reload = 0; } if (a.ammo >= 3) a.reload = 0;
    const sp = SPEED * (a.dash > 0 ? 2.8 : 1) * (a.stun > 0 ? 0.2 : 1);
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    const vx = mx * sp + a.vx, vy = my * sp + a.vy;
    a.vx *= Math.pow(0.02, dt); a.vy *= Math.pow(0.02, dt);
    const nx = Math.max(R, Math.min(AW - R, a.x + vx * dt)), ny = Math.max(R, Math.min(AH - R, a.y + vy * dt));
    if (!blocked(nx, a.y, R)) a.x = nx;
    if (!blocked(a.x, ny, R)) a.y = ny;
    a.mvx = mx * sp; a.mvy = my * sp;
  }

  // ---- Bot ----
  function botThink(dt) {
    const lvl = Math.min(level, 8);
    bot.t -= dt; bot.fire -= dt;
    if (bot.t <= 0) { // pindah posisi tiap sebentar, jaga jarak sedang dari kita
      bot.t = 0.7 + Math.random() * 0.8;
      for (let i = 0; i < 8; i++) { const gx = 120 + Math.random() * 760, gy = 110 + Math.random() * 330; if (!blocked(gx, gy, R + 10)) { bot.gx = gx; bot.gy = gy; break; } }
    }
    // ngehindar bantal yang dateng
    const danger = pillows.find((pl) => pl.owner === 'me' && Math.hypot(pl.x - opp.x, pl.y - opp.y) < 260);
    if (danger && opp.dashCd <= 0 && Math.random() < (0.15 + lvl * 0.08) * dt * 10) { dash(opp); bot.gx = opp.x + (danger.vy > 0 ? 1 : -1) * 220; }
    const dx = bot.gx - opp.x, dy = bot.gy - opp.y, d = Math.hypot(dx, dy);
    if (bot.fire <= 0 && opp.ammo > 0) { throwAt(opp, me, Math.min(0.45, 0.05 + lvl * 0.05)); bot.fire = Math.max(0.45, 1.25 - lvl * 0.09) * (0.7 + Math.random() * 0.6); }
    return d > 20 ? [dx / d * (0.7 + lvl * 0.04), dy / d * (0.7 + lvl * 0.04)] : [0, 0];
  }

  function update(dt) {
    stateT += dt;
    for (const f of feathers) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.9; f.vy *= 0.9; f.life -= dt; }
    feathers = feathers.filter((f) => f.life > 0);
    for (const f of floats) { f.y -= 60 * dt; f.life -= dt; }
    floats = floats.filter((f) => f.life > 0);
    if (state === 'intro') { if (stateT > 1.4) { state = 'fight'; stateT = 0; } return; }
    if (state === 'over') { if (stateT > 1.8) nextRound(); return; }
    time = Math.max(0, time - dt);
    let mx = stick.x + ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
    let my = stick.y + ((keys.ArrowDown || keys.s) ? 1 : 0) - ((keys.ArrowUp || keys.w) ? 1 : 0);
    move(me, mx, my, dt);
    if (duel) { if (opp.tx != null) { const px = opp.x, py = opp.y; opp.x += (opp.tx - opp.x) * Math.min(1, dt * 12); opp.y += (opp.ty - opp.y) * Math.min(1, dt * 12); opp.vx = 0; opp.vy = 0; opp.mvx = (opp.x - px) / dt; opp.mvy = (opp.y - py) / dt; } }
    else { const [bx, by] = botThink(dt); move(opp, bx, by, dt); }
    for (const pl of pillows) {
      pl.x += pl.vx * dt; pl.y += pl.vy * dt; pl.life -= dt; pl.rot += dt * 9;
      if (blocked(pl.x, pl.y, PR * 0.6) || pl.x < -40 || pl.x > AW + 40 || pl.y < -40 || pl.y > AH + 40) { pl.life = 0; continue; }
      const target = pl.owner === 'me' ? opp : me;
      if (Math.hypot(pl.x - target.x, pl.y - target.y) < R + PR) {
        if (duel && pl.owner === 'me') continue; // HP lawan yang mutusin kena atau nggak
        if (target.inv > 0) continue;
        pl.life = 0;
        hitBy(target, pl);
        if (duel) { duel.send('phit', { id: pl.id }); sendState(true); }
      }
    }
    pillows = pillows.filter((pl) => pl.life > 0);
    sendState(false);
    if (me.hp <= 0 || opp.hp <= 0 || time <= 0) {
      roundResult = { won: me.hp > opp.hp, draw: me.hp === opp.hp };
      state = 'over'; stateT = 0;
      sendState(true);
      api.sfx(roundResult.won ? 'win' : roundResult.draw ? 'pop' : 'lose');
    }
  }
  function nextRound() {
    const { won, draw } = roundResult;
    if (p.endless && (won || draw)) {
      if (won) wins++;
      level++;
      Object.assign(me, player(AW / 2, AH - 120, me.img, me.emoji, me.name, me.ring));
      Object.assign(opp, player(AW / 2, 120, opp.img, opp.emoji, opp.name, opp.ring));
      pillows = []; time = ROUND; state = 'intro'; stateT = 0;
      api.sfx('go');
      api.say(won ? `Menang! 🛏️ Lawan ke-${wins + 1} lebih lincah, awas {pasangan}!` : 'Seri! Lanjut ronde berikutnya 😤', 'happy');
      return;
    }
    end();
  }

  // ---- Gambar ----
  const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
  function drawPlayer(a) {
    const x = X(a.x), y = Y(a.y), r = R * sc;
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    if (a.dash > 0) { ctx.globalAlpha = 0.35; drawFace(ctx, a.img, x - (a.mvx || 0) * 0.05 * sc, y - (a.mvy || 0) * 0.05 * sc, r, a.emoji, a.ring); ctx.globalAlpha = 1; }
    if (a.inv > 0 && Math.floor(a.inv * 14) % 2) ctx.globalAlpha = 0.4;
    drawFace(ctx, a.img, x, y, r, a.emoji, a.ring);
    ctx.globalAlpha = 1;
    for (let i = 0; i < a.ammo; i++) drawPillowAt(x - r + i * r * 0.55 + r * 0.45, y + r * 1.25, 0, 0.55);
    if (a.stun > 0) drawEmoji(ctx, '😵', x + r * 0.7, y - r * 0.8, r * 0.6);
  }
  function drawPillowAt(x, y, rot, s = 1) {
    const w = PR * 2.2 * sc * s, h = PR * 1.5 * sc * s;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ff9fc2'; ctx.lineWidth = Math.max(1.5, 3 * sc * s);
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.45); else ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function banner(text, sub) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(38 * Math.min(1.3, W / 380))}px Fredoka, sans-serif`;
    ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#e8558f';
    ctx.strokeText(text, W / 2, H * 0.45); ctx.fillText(text, W / 2, H * 0.45);
    if (sub) { ctx.font = '600 17px Fredoka, sans-serif'; ctx.lineWidth = 5; ctx.strokeText(sub, W / 2, H * 0.45 + 34); ctx.fillStyle = '#8a3f6e'; ctx.fillText(sub, W / 2, H * 0.45 + 34); }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // lantai kamar
    ctx.fillStyle = '#fbe3ee'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd3e4'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(X(0), Y(0), AW * sc, AH * sc, 22); else ctx.rect(X(0), Y(0), AW * sc, AH * sc); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
    for (let y = 110; y < AH; y += 110) { ctx.beginPath(); ctx.moveTo(X(0), Y(y)); ctx.lineTo(X(AW), Y(y)); ctx.stroke(); }
    ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(194,48,111,.3)'; ctx.beginPath(); ctx.moveTo(X(0), Y(AH / 2)); ctx.lineTo(X(AW), Y(AH / 2)); ctx.stroke(); ctx.setLineDash([]);
    for (const b0 of BLOCKS) {
      const [bx, by] = flip ? [AW - b0.x - b0.w, AH - b0.y - b0.h] : [b0.x, b0.y];
      ctx.fillStyle = '#e9b6d0'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(X(bx), Y(by), b0.w * sc, b0.h * sc, 14); else ctx.rect(X(bx), Y(by), b0.w * sc, b0.h * sc); ctx.fill();
      drawEmoji(ctx, b0.em, X(bx + b0.w / 2), Y(by + b0.h / 2), Math.min(b0.w, b0.h) * sc * 0.95);
    }
    for (const pl of pillows) drawPillowAt(X(pl.x), Y(pl.y), pl.rot);
    for (const a of [opp, me].sort((u, v) => u.y - v.y)) drawPlayer(a);
    for (const f of feathers) { ctx.globalAlpha = Math.min(1, f.life * 2); drawEmoji(ctx, '🪶', X(f.x), Y(f.y), 18); }
    ctx.globalAlpha = 1;
    ctx.font = '700 18px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#c2306f';
    for (const f of floats) { ctx.globalAlpha = Math.max(0, f.life); ctx.strokeText(f.text, X(f.x), Y(f.y)); ctx.fillText(f.text, X(f.x), Y(f.y)); }
    ctx.globalAlpha = 1;
    // HUD: nyawa & waktu
    const hearts = (a) => '❤️'.repeat(Math.max(0, a.hp)) + '🤍'.repeat(LIVES - Math.max(0, a.hp));
    ctx.font = '600 14px Fredoka, sans-serif'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(16, 16); drawFace(ctx, opp.img, 0, 0, 11, opp.emoji, opp.ring); ctx.restore();
    ctx.textAlign = 'left'; ctx.fillStyle = '#5a2a52'; ctx.fillText(hearts(opp), 32, 17);
    ctx.textAlign = 'right'; ctx.font = '700 22px Fredoka, sans-serif'; ctx.fillStyle = '#c2306f'; ctx.fillText(Math.ceil(time), W - 12, 18);
    if (state === 'intro') banner(p.endless ? `Ronde ${wins + 1}` : 'Siap…', 'Perang bantal! 🛏️');
    if (state === 'over' && roundResult) banner(roundResult.draw ? 'Seri!' : roundResult.won ? 'Menang! 🏆' : 'Kalah 🥲');
    pad.querySelector('.pw-throw').style.opacity = me.ammo > 0 ? 1 : 0.45;
    const s = p.endless ? `🛏️ Menang ${wins} · 🏆 ${Math.max(p.best || 0, wins)} · ${hearts(me)}` : `${hearts(me)} · bantal ${me.ammo}/3`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (!done) update(dt);
    draw();
  }
  raf = requestAnimationFrame(loop);
  api.say('Joystick buat jalan · 🛏️ lempar bantal (otomatis ngarah) · 💨 ngehindar. Sembunyi di balik kasur & sofa!', 'happy');

  function end() {
    if (done) return;
    done = true;
    if (p.endless) { api.finish({ win: true, score: wins, detail: `Menang ${wins} ronde beruntun 🛏️` }); return; }
    const { won, draw } = roundResult || { won: me.hp > opp.hp, draw: me.hp === opp.hp };
    if (!duel) { api.finish({ win: won, stars: won ? (me.hp >= 4 ? 3 : me.hp >= 2 ? 2 : 1) : 0, detail: won ? `Menang perang bantal, sisa nyawa ${me.hp} 🛏️` : `${opp.name} lebih lincah, coba lagi! 🪶` }); return; }
    api.finish({ win: won, draw, myHp: me.hp, oppHp: opp.hp });
  }

  return {
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
      offs.forEach((f) => f());
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('resize', resize);
    },
  };
}
