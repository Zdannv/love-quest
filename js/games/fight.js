// Gelut Sayang: duel ala Shadow Fight versi lucu. Badan siluet, kepalanya foto muka kalian.
// Kontrol: ◀ ▶ jalan · ⬆️ lompat · 👊 pukul · 🦶 tendang · 🛡️ tahan buat tangkis · 💖 jurus (kalau bar jurus penuh).
// Lompat bisa ngehindarin pukulan & jurus, bisa lompatin lawan, dan nendang dari udara.
// Badan nggak bisa saling tembus: yang jalan nabrak lawan cuma berhenti (nggak dorong-dorongan).
// Sendiri (p.endless): lawan bot yang makin jago tiap ronde, skor = jumlah menang beruntun.
// Berdua (p.duel): tiap HP ngatur petarungnya sendiri; serangan yang kena dikirim ke HP lawan,
// HP lawan yang ngitung darahnya sendiri (biar tangkisan tetap kehitung).
import { drawEmoji, drawFace, loadImage } from '../util.js';
import { drawToon, toonLoad } from '../toon.js';

const ARENA = 1000, FLOOR = 0.8;
const MOVES = {
  punch: { start: 0.07, end: 0.17, total: 0.3, range: 340, dmg: 6, kb: 70, meter: 9 },
  kick: { start: 0.15, end: 0.27, total: 0.46, range: 380, dmg: 10, kb: 120, meter: 12 },
  special: { start: 0.18, end: 0.2, total: 0.5 },
};
const WALK = 300, ROUND_TIME = 60, MIN_GAP = 270;
const JUMP_V = 980, GRAV = 2900, JUMP_X = 430, AIR_SAFE = 95; // lompat: tinggi ±165, di udara ±0,68 dtk

function fighter(x, dir, img, emoji, name, toon) {
  return { x, y: 0, vy: 0, jx: 0, dir, hp: 100, meter: 0, act: 'idle', t: 0, hitDone: false, kbV: 0, img, emoji, name, toon, walk: 0 };
}

export function startFight(stage, p, api) {
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
  pad.className = 'fight-pad';
  pad.className = 'fight-pad fp2';
  const chev = (d) => `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  pad.innerHTML = `<div class="fp-move"><button data-k="left" class="b-dir" aria-label="Kiri">${chev('M15 5l-7 7 7 7')}</button><button data-k="right" class="b-dir" aria-label="Kanan">${chev('M9 5l7 7-7 7')}</button></div>
    <div class="fp-act">
      <button data-k="special" data-label="Jurus" class="b-sp sp" aria-label="Jurus"><span class="b-ring"></span><span class="b-ic">💖</span></button>
      <button data-k="jump" data-label="Lompat" class="b-jump" aria-label="Lompat"><span class="b-ic">🦘</span></button>
      <button data-k="block" data-label="Tangkis" class="b-block" aria-label="Tangkis"><span class="b-ic">🛡️</span></button>
      <button data-k="kick" data-label="Tendang" class="b-kick" aria-label="Tendang"><span class="b-ic">🦶</span></button>
      <button data-k="punch" data-label="Pukul" class="b-punch" aria-label="Pukul"><span class="b-ic">👊</span></button>
    </div>`;
  wrap.appendChild(pad);
  const spBtn = pad.querySelector('.sp');
  let lastMeter = -1;

  let W = 0, H = 0, k = 1;
  function resize() {
    const r = view.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    k = Math.min(1.3, Math.max(0.75, Math.min(W / 380, H / 560)));
  }
  resize();
  const SX = (x) => (x / ARENA) * W;

  const duel = p.duel || null;
  const leftSide = duel ? duel.left : true;
  const me = fighter(leftSide ? 250 : 750, leftSide ? 1 : -1, loadImage(p.face), p.emoji || '😊', p.name || 'Kamu', p.toon || 'f');
  const opp = fighter(leftSide ? 750 : 250, leftSide ? -1 : 1, loadImage(p.oppFace), p.oppEmoji || '😈', p.oppName || 'Lawan', p.oppToon || 'm');
  toonLoad(me.toon, opp.toon);
  let level = p.botLevel || 0, wins = 0;
  let projs = [], sparks = [], floats = [];
  let time = ROUND_TIME, state = 'fight', stateT = 0, done = false, raf = 0, last = performance.now(), lastStats = '', lastSent = 0;
  const hold = { left: false, right: false, block: false };
  let ai = { t: 0.6, want: 0 };

  // ---- Input ----
  function press(key, down) {
    if (key === 'left' || key === 'right' || key === 'block') { hold[key] = down; return; }
    if (down && key === 'jump') { jump(me, (hold.right ? 1 : 0) - (hold.left ? 1 : 0)); return; }
    if (down) attack(me, key);
  }
  const btnOf = (e) => e.target.closest('[data-k]');
  pad.addEventListener('pointerdown', (e) => { const b = btnOf(e); if (!b) return; e.preventDefault(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} press(b.dataset.k, true); });
  const up = (e) => { const b = btnOf(e); if (!b) return; b.classList.remove('on'); press(b.dataset.k, false); };
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  const KEYMAP = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', w: 'jump', j: 'punch', k: 'kick', l: 'block', ArrowDown: 'block', ' ': 'special' };
  const onKey = (e) => { const key = KEYMAP[e.key]; if (!key) return; e.preventDefault(); if (e.type === 'keydown' && e.repeat && !['left', 'right', 'block'].includes(key)) return; press(key, e.type === 'keydown'); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('resize', resize);

  const busy = (f) => ['punch', 'kick', 'special', 'hurt', 'ko', 'win'].includes(f.act);
  const air = (f) => f.y > 0 || f.vy > 0;
  function jump(f, dirX) {
    if (state !== 'fight' || air(f) || busy(f)) return;
    if (f.act === 'block') setAct(f, 'idle');
    f.vy = JUMP_V; f.jx = dirX * JUMP_X;
    if (f === me) { api.sfx('flip'); sendState(true); }
  }
  function setAct(f, act) { f.act = act; f.t = 0; f.hitDone = false; }
  function attack(f, move) {
    if (state !== 'fight' || busy(f)) return;
    if (move === 'special') {
      if (f.meter < 100 || air(f)) { if (f === me) api.sfx('bad'); return; }
      f.meter = 0;
    }
    if (air(f) && move === 'punch') move = 'kick'; // di udara: semua jadi tendangan terbang
    setAct(f, move);
    if (f === me) { api.sfx(move === 'special' ? 'gold' : 'flip'); sendState(true); }
  }

  // ---- Kena serangan ----
  function applyHit(f, dmg, kb, fromDir) {
    const blocking = f.act === 'block';
    const real = blocking ? Math.max(1, Math.round(dmg * 0.2)) : dmg;
    f.hp = Math.max(0, f.hp - real);
    f.kbV = fromDir * (blocking ? kb * 0.5 : kb) * 3;
    if (f.y > 0) { f.jx = 0; f.vy = Math.min(f.vy, 0); } // ditendang di udara: langsung jatuh
    f.meter = Math.min(100, f.meter + real * 0.8);
    if (!blocking) setAct(f, f.hp <= 0 ? 'ko' : 'hurt');
    sparks.push({ x: f.x - fromDir * 20, y: 0.55, em: blocking ? '🛡️' : real >= 15 ? '💥' : '💢', life: 0.5 });
    floats.push({ x: f.x, y: 0.3, text: `-${real}`, color: blocking ? '#8a8fa8' : '#ff4d6d', life: 1 });
    api.sfx(blocking ? 'pop' : 'bad');
    return real;
  }
  function tryHit(att, def, move) {
    const m = MOVES[move];
    const dist = (def.x - att.x) * att.dir;
    if (dist < -20 || dist > m.range) return;
    // tinggi: serangan dari tanah nggak kena lawan yang lagi lompat; tendangan terbang kena yang di bawahnya
    if (air(att) ? def.y > att.y + 60 : def.y > AIR_SAFE) return;
    att.hitDone = true;
    att.meter = Math.min(100, att.meter + m.meter);
    if (duel && att === me) { duel.send('fhit', { dmg: m.dmg, kb: m.kb, dir: att.dir }); sparks.push({ x: def.x - att.dir * 20, y: 0.55, em: '💢', life: 0.4 }); return; }
    applyHit(def, m.dmg, m.kb, att.dir);
  }

  // ---- Bot ----
  function botThink(dt) {
    ai.t -= dt;
    const dist = Math.abs(me.x - opp.x);
    const lvl = Math.min(level, 8);
    opp.dir = me.x > opp.x ? 1 : -1;
    // nangkis kalau kita lagi ancang-ancang mukul
    if ((me.act === 'punch' || me.act === 'kick') && me.t < 0.12 && dist < 410 && !busy(opp) && Math.random() < (0.12 + lvl * 0.07) * dt * 20) { setAct(opp, 'block'); ai.t = 0.35; }
    if (opp.act === 'block' && ai.t <= 0) setAct(opp, 'idle');
    // lompatin jurus 💖 yang dateng
    const inc = projs.find((pr) => pr.owner === 'me' && (opp.x - pr.x) * pr.dir > 0 && Math.abs(opp.x - pr.x) < 260);
    if (inc && !air(opp) && !busy(opp) && Math.random() < (0.25 + lvl * 0.09) * dt * 15) jump(opp, 0);
    if (ai.t > 0 || busy(opp) || air(opp)) { if (air(opp) && !busy(opp) && opp.vy < 0 && Math.abs(me.x - opp.x) < 280 && Math.random() < 0.08 + lvl * 0.02) attack(opp, 'kick'); return; }
    ai.t = Math.max(0.16, 0.55 - lvl * 0.05) * (0.7 + Math.random() * 0.6);
    if (opp.meter >= 100 && dist > 410) { attack(opp, 'special'); return; }
    const cornered = opp.x < 160 || opp.x > ARENA - 160;
    if (lvl >= 1 && ((cornered && dist < 320) || (dist > 380 && dist < 500)) && Math.random() < 0.18 + lvl * 0.03) { jump(opp, opp.dir); return; }
    if (dist > 360) { ai.want = opp.dir; return; }
    if (dist < 295 && Math.random() < 0.3) { ai.want = -opp.dir; return; }
    ai.want = 0;
    attack(opp, Math.random() < 0.55 ? 'punch' : 'kick');
  }

  // ---- Online ----
  function sendState(force) {
    if (!duel) return;
    const now = performance.now();
    if (!force && now - lastSent < 66) return;
    lastSent = now;
    duel.send('fstate', { x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, act: me.act, at: +me.t.toFixed(2), hp: me.hp, m: Math.round(me.meter) });
  }
  const offs = [];
  if (duel) {
    offs.push(duel.on('fstate', (d) => {
      opp.tx = d.x; opp.ty = d.y || 0; opp.dir = d.dir; opp.hp = d.hp; opp.meter = d.m;
      if (d.act !== opp.act) { opp.act = d.act; opp.t = d.at; }
    }));
    offs.push(duel.on('fhit', (d) => { if (state === 'fight' && me.act !== 'ko') { applyHit(me, d.dmg, d.kb, d.dir); sendState(true); } }));
    offs.push(duel.on('fproj', (d) => { projs.push({ x: d.x, dir: d.dir, owner: 'opp', life: 3 }); api.sfx('gold'); }));
  }

  function step(f, dt, moveDir) {
    f.t += dt;
    if (f.act === 'hurt' && f.t > 0.32) setAct(f, 'idle');
    const mv = MOVES[f.act];
    if (mv) {
      if (f.act === 'special' && !f.hitDone && f.t >= mv.start) {
        f.hitDone = true;
        projs.push({ x: f.x + f.dir * 50, dir: f.dir, owner: f === me ? 'me' : 'opp', life: 3 });
        if (duel && f === me) duel.send('fproj', { x: Math.round(f.x + f.dir * 50), dir: f.dir });
      } else if (f.act !== 'special' && !f.hitDone && f.t >= mv.start && f.t <= mv.end) {
        if (!duel || f === me) tryHit(f, f === me ? opp : me, f.act);
      }
      if (f.t >= mv.total) setAct(f, 'idle');
    }
    if (air(f)) { // lagi lompat: arah lompatan udah fix, gravitasi narik turun
      f.vy -= GRAV * dt; f.y += f.vy * dt; f.x += f.jx * dt;
      if (f.y <= 0) { f.y = 0; f.vy = 0; f.jx = 0; if (f.act === 'kick') setAct(f, 'idle'); }
    } else if (!busy(f) && f.act !== 'block') {
      f.x += moveDir * WALK * dt;
      f.walk = moveDir ? f.walk + dt * 9 : 0;
      setActIf(f, moveDir ? 'walk' : 'idle');
    }
    f.x += f.kbV * dt;
    f.kbV *= Math.pow(0.002, dt);
    f.x = Math.max(115, Math.min(ARENA - 115, f.x));
  }
  const setActIf = (f, a) => { if (f.act !== a) { f.act = a; f.t = 0; } };

  function update(dt) {
    for (const s of sparks) s.life -= dt;
    sparks = sparks.filter((s) => s.life > 0);
    for (const f of floats) { f.y -= dt * 0.12; f.life -= dt * 1.3; }
    floats = floats.filter((f) => f.life > 0);
    stateT += dt;

    if (state === 'fight') {
      time = Math.max(0, time - dt);
      // kita
      if (me.act !== 'ko') {
        if (!busy(me)) {
          if (hold.block && !air(me)) setActIf(me, 'block'); else if (me.act === 'block') setAct(me, 'idle');
          me.dir = opp.x > me.x ? 1 : -1;
        }
        step(me, dt, hold.block ? 0 : (hold.right ? 1 : 0) - (hold.left ? 1 : 0));
      } else me.t += dt;
      // lawan
      if (duel) {
        if (opp.tx != null) { opp.x += (opp.tx - opp.x) * Math.min(1, dt * 12); opp.y += ((opp.ty || 0) - opp.y) * Math.min(1, dt * 16); opp.vy = 0; }
        opp.t += dt;
      } else if (opp.act !== 'ko') { botThink(dt); step(opp, dt, ai.want); } else opp.t += dt;
      // jangan nembus
      separate();
      // proyektil 💖
      for (const pr of projs) {
        pr.x += pr.dir * 560 * dt; pr.life -= dt;
        const target = pr.owner === 'me' ? opp : me;
        if (pr.life > 0 && Math.abs(pr.x - target.x) < 60 && target.y < 70) {
          pr.life = 0;
          if (duel) { if (pr.owner === 'me') duel.send('fhit', { dmg: 18, kb: 160, dir: pr.dir }); }
          else applyHit(target, 18, 160, pr.dir);
        }
      }
      projs = projs.filter((pr) => pr.life > 0 && pr.x > -50 && pr.x < ARENA + 50);
      sendState(false);
      // selesai?
      if (me.hp <= 0 || opp.hp <= 0 || time <= 0) {
        if (me.hp <= 0) setActIf(me, 'ko');
        if (opp.hp <= 0 && !duel) setActIf(opp, 'ko');
        const won = me.hp > opp.hp, draw = me.hp === opp.hp;
        if (won) setActIf(me, 'win'); else if (!draw && opp.act !== 'ko') setActIf(opp, 'win');
        state = 'over'; stateT = 0;
        sendState(true);
        api.sfx(won ? 'win' : draw ? 'pop' : 'lose');
        roundResult = { won, draw };
      }
    } else if (state === 'over') {
      me.t += dt; opp.t += dt;
      if (stateT > 1.8) nextRound();
    } else if (state === 'intro') {
      if (stateT > 1.4) { state = 'fight'; stateT = 0; }
    }
  }
  // Badan nggak bisa tembus. Kalau dua-duanya di tanah & nempel, dipisah sama rata (yang jalan cuma ketahan,
  // nggak ngedorong lawan). Yang lagi lompat boleh lewat di atas lawan; pas mendarat baru dipisah lagi.
  function separate() {
    if (air(me) || air(opp) || me.y > 0 || opp.y > 1) return;
    const gap = opp.x - me.x, over = MIN_GAP - Math.abs(gap);
    if (over <= 0) return;
    const side = gap === 0 ? (me.dir || 1) : Math.sign(gap); // lawan ada di sebelah mana
    const clamp = (v) => Math.max(115, Math.min(ARENA - 115, v));
    if (duel) { me.x = clamp(me.x - side * over); return; } // HP lawan ngurus posisinya sendiri
    let mx = clamp(me.x - side * over / 2), ox = clamp(opp.x + side * over / 2);
    const left = MIN_GAP - Math.abs(ox - mx); // mentok tembok → sisanya ke yang satunya
    if (left > 0) { if (mx === me.x - side * over / 2) mx = clamp(mx - side * left); else ox = clamp(ox + side * left); }
    me.x = mx; opp.x = ox;
  }
  let roundResult = null;
  function nextRound() {
    const { won, draw } = roundResult;
    if (p.endless && (won || draw)) {
      if (won) wins++;
      level++;
      Object.assign(me, { hp: 100, x: 250, y: 0, vy: 0, jx: 0, dir: 1, kbV: 0 }); setAct(me, 'idle');
      Object.assign(opp, { hp: 100, x: 750, y: 0, vy: 0, jx: 0, dir: -1, kbV: 0, meter: 0 }); setAct(opp, 'idle');
      projs = []; time = ROUND_TIME; state = 'intro'; stateT = 0;
      api.sfx('go');
      api.say(won ? `Menang! 💪 Lawan ke-${wins + 1} lebih jago, hati-hati {pasangan}!` : 'Seri! Lanjut ronde berikutnya 😤', 'happy');
      return;
    }
    end();
  }

  // ---- Gambar ----
  function poseOf(f) {
    const mv = MOVES[f.act], ph = mv ? f.t / mv.start : 0;
    if (f.y > 4 && f.act === 'kick') return 'kick';
    if (f.y > 4 && !['hurt', 'ko', 'punch'].includes(f.act)) return 'jump';
    switch (f.act) {
      case 'walk': return `walk${Math.floor(f.walk) % 8}`;
      case 'punch': return ph < 1 ? 'attack1' : 'attack0';
      case 'kick': return ph < 1 ? 'attackKick' : 'kick';
      case 'block': return 'duck';
      case 'hurt': return 'hurt';
      case 'special': return 'shove';
      case 'win': return Math.floor(f.t * 3) % 2 ? 'cheer1' : 'cheer0';
      case 'ko': return 'slide';
      default: return 'idle';
    }
  }
  function drawFighter(f) {
    const fx = SX(f.x), ground = H * FLOOR, fy = ground - f.y * k, h = 205 * k;
    const sh = Math.max(0.45, 1 - f.y / 260); // bayangan mengecil pas lompat
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(fx, ground - 4 * k, 44 * k * sh, 9 * k * sh, 0, 0, Math.PI * 2); ctx.fill();
    const bob = f.act === 'idle' ? Math.sin(performance.now() / 260) * 2 * k : 0;
    if (f.act === 'hurt' && Math.floor(f.t * 20) % 2) ctx.globalAlpha = 0.6;
    drawToon(ctx, f.toon, poseOf(f), fx, fy + bob + 8 * k, h, f.dir, f.img, f.emoji, f === me ? '#ff8fb7' : '#9fb4ff');
    ctx.globalAlpha = 1;
    const headY = fy - h * 0.62;
    if (f.act === 'hurt') drawEmoji(ctx, '😵', fx + f.dir * 30 * k, headY - 40 * k, 26 * k);
    if (f.act === 'win') drawEmoji(ctx, '👑', fx, headY - 56 * k, 34 * k);
    if (f.act === 'block') drawEmoji(ctx, '🛡️', fx + f.dir * 46 * k, fy - h * 0.38, 40 * k);
    if (f.act === 'punch' && f.t >= MOVES.punch.start) drawEmoji(ctx, '🥊', fx + f.dir * 78 * k, fy - h * 0.47, 30 * k);
  }
  function bar(x, y, w, h, v, color, alignRight) {
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    const fw = w * Math.max(0, Math.min(1, v));
    ctx.fillRect(alignRight ? x + w - fw : x, y, fw, h);
  }
  function drawHud() {
    const L = leftSide ? me : opp, R = leftSide ? opp : me;
    const bw = W * 0.34, y = 14;
    for (const [f, right] of [[L, false], [R, true]]) {
      const x = right ? W - 12 - bw : 12;
      bar(x, y + 20, bw, 12 * k, f.hp / 100, f.hp > 30 ? '#ff5c93' : '#ff2e4d', right);
      bar(x, y + 20 + 15 * k, bw, 5 * k, f.meter / 100, f.meter >= 100 ? '#ffb020' : '#c9a6ff', right);
      ctx.save(); ctx.translate(right ? W - 26 : 26, y + 8); drawFace(ctx, f.img, 0, 0, 13 * k, f.emoji, f === me ? '#ff8fb7' : '#9fb4ff'); ctx.restore();
      ctx.fillStyle = '#5a2a52'; ctx.font = `700 ${Math.round(13 * k)}px Fredoka, sans-serif`;
      ctx.textAlign = right ? 'right' : 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(f === me ? `${f.name} (kamu)` : f.name, right ? W - 44 : 44, y + 8);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c2306f'; ctx.lineWidth = 4;
    ctx.font = `700 ${Math.round(24 * k)}px Fredoka, sans-serif`;
    ctx.strokeText(Math.ceil(time), W / 2, y + 26); ctx.fillText(Math.ceil(time), W / 2, y + 26);
  }
  function banner(text, sub) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(40 * k)}px Fredoka, sans-serif`;
    ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#e8558f';
    ctx.strokeText(text, W / 2, H * 0.34); ctx.fillText(text, W / 2, H * 0.34);
    if (sub) { ctx.font = `600 ${Math.round(17 * k)}px Fredoka, sans-serif`; ctx.lineWidth = 5; ctx.strokeText(sub, W / 2, H * 0.34 + 36 * k); ctx.fillStyle = '#8a3f6e'; ctx.fillText(sub, W / 2, H * 0.34 + 36 * k); }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // panggung
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffd6e7'); g.addColorStop(FLOOR, '#f3c6ff'); g.addColorStop(FLOOR, '#c99ae0'); g.addColorStop(1, '#b07fcc');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 6; i++) drawEmoji(ctx, i % 2 ? '💗' : '✨', (W / 6) * (i + 0.5), H * 0.5 + Math.sin(i * 2 + performance.now() / 900) * 8, 18 * k);
    ctx.fillRect(0, H * FLOOR, W, 3);
    for (const f of [opp, me]) drawFighter(f);
    for (const pr of projs) drawEmoji(ctx, '💖', SX(pr.x), H * FLOOR - 100 * k + Math.sin(pr.x / 30) * 6, 40 * k);
    for (const s of sparks) { ctx.globalAlpha = Math.min(1, s.life * 3); drawEmoji(ctx, s.em, SX(s.x), H * FLOOR - s.y * 180 * k, 40 * k * (1.3 - s.life)); }
    ctx.globalAlpha = 1;
    ctx.font = `700 ${Math.round(20 * k)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff';
    for (const f of floats) { ctx.globalAlpha = Math.max(0, f.life); ctx.strokeText(f.text, SX(f.x), H * FLOOR - f.y * 400 * k); ctx.fillStyle = f.color; ctx.fillText(f.text, SX(f.x), H * FLOOR - f.y * 400 * k); }
    ctx.globalAlpha = 1;
    drawHud();
    if (state === 'intro') banner(p.endless ? `Ronde ${wins + 1}` : 'Siap…', p.endless && level ? `lawan makin jago 😤` : 'Gelut! 👊');
    if (state === 'over' && roundResult) banner(roundResult.draw ? 'Seri!' : me.hp <= 0 || !roundResult.won ? 'K.O. 😵' : 'Menang! 🏆');
    spBtn.classList.toggle('ready', me.meter >= 100);
    const mv = Math.round(me.meter); if (mv !== lastMeter) { spBtn.style.setProperty('--m', `${mv}%`); lastMeter = mv; }
    const s = p.endless ? `👊 Menang ${wins} · 🏆 ${Math.max(p.best || 0, wins)}` : `❤️ ${me.hp} · ${opp.name} ${opp.hp}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (!done) update(dt);
    draw();
  }
  if (p.endless || !duel) { state = 'intro'; stateT = 0; }
  if (window.__lqTest) window.__fight = { me, opp, press, get state() { return state; } };
  raf = requestAnimationFrame(loop);
  api.say('◀ ▶ jalan · 🦘 lompat (bisa ngehindar & lompatin lawan) · 👊 pukul · 🦶 tendang · 🛡️ tahan buat nangkis · 💖 jurus kalau lingkarannya penuh', 'happy');

  function end() {
    if (done) return;
    done = true;
    if (p.endless) { api.finish({ win: true, score: wins, detail: `Menang ${wins} ronde beruntun 💪` }); return; }
    const { won, draw } = roundResult || { won: me.hp > opp.hp, draw: me.hp === opp.hp };
    if (!duel) { api.finish({ win: won, stars: won ? (me.hp > 70 ? 3 : me.hp > 35 ? 2 : 1) : 0, detail: won ? `Menang dengan sisa darah ${me.hp} 💪` : `${opp.name} masih kuat, coba lagi! 😤` }); return; }
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
