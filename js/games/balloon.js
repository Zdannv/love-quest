// Balon Berdua: naik balon udara bareng. Ada 2 pembakar: 🔥 kiri & 🔥 kanan. Nyalain dua-duanya = naik lurus;
// cuma satu = balonnya miring & geser ke arah sebaliknya (kanan nyala → miring ke kiri, mundur; kiri nyala → maju).
// Hindari ⛈️ awan petir & 🐦 burung, ambil 💖. Makin jauh makin cepet. 3 nyawa.
// Sendiri: kamu pegang dua pembakar. Mode level: capai jarak p.goal. Mode skor (p.endless): sejauh-jauhnya.
// Berdua (p.duel): HP "pasangan" pegang pembakar kiri & jadi tuan rumah (ngitung fisika), HP "pengirim" pegang kanan
// (kirim tombolnya, nerima posisi balon). Rintangan dibikin dari jarak tempuh + seed, jadi sama di dua HP.
import { drawEmoji, drawFace, loadImage, keyHint } from '../util.js';
import { drawSky, makeFx } from '../scene.js';

const GRAV = 70, BURN = 270, MAXV = 190, TILT_K = 2.6;
const SC = 1.9 / 20; // jarak (m) → geser layar: 20 m ≈ 1,9 layar pas kecepatan awal
const hash = (a, b) => { let n = (a * 374761393 + b * 668265263) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

export function startBalloon(stage, p, api) {
  const wrap = document.createElement('div'); wrap.className = 'fight-wrap'; stage.appendChild(wrap);
  const view = document.createElement('div'); view.className = 'fight-view'; wrap.appendChild(view);
  const canvas = document.createElement('canvas'); canvas.className = 'catch-canvas'; view.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const duel = p.duel || null;
  const host = !duel || duel.role === 'pasangan';
  const mySide = !duel ? 'both' : duel.role === 'pasangan' ? 'L' : 'R';
  const pad = document.createElement('div'); pad.className = 'fight-pad bl-pad';
  const btn = (side, label) => `<button data-k="${side}" class="bl-burn ${mySide !== 'both' && mySide !== side ? 'off' : ''}" aria-label="Pembakar ${label}"><span>🔥</span><b>${label}</b></button>`;
  pad.innerHTML = `${btn('L', mySide === 'L' ? 'Kiri (kamu)' : 'Kiri')}<div class="bl-mid"><small>${mySide === 'both' ? 'Tahan dua-duanya biar naik lurus' : `Kamu pegang yang ${mySide === 'L' ? 'kiri' : 'kanan'} · ${mySide === 'L' ? (p.oppName || 'dia') + ' kanan' : (p.oppName || 'dia') + ' kiri'}`}</small></div>${btn('R', mySide === 'R' ? 'Kanan (kamu)' : 'Kanan')}`;
  wrap.appendChild(pad);
  keyHint(wrap, mySide === 'both' ? [['A / ←', 'pembakar kiri'], ['D / →', 'pembakar kanan'], ['Spasi', 'dua-duanya']] : [['Spasi / ↑', `pembakar ${mySide === 'L' ? 'kiri' : 'kanan'}`]]);

  let W = 0, H = 0, k = 1;
  function resize() {
    const r = view.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); k = Math.min(1.25, Math.max(0.75, W / 400));
  }
  resize();

  const faceA = loadImage(p.waterFace || p.face), faceB = loadImage(p.fireFace || p.oppFace);
  const seed = (p.seed || 2024) >>> 0;
  // keadaan balon (koordinat 0..1 relatif layar biar sama di dua HP)
  const B = { x: 0.32, y: 0.55, vx: 0, vy: 0, tilt: 0, L: 0, R: 0 };
  let ground = 0, dist = 0, lives = 3, hearts = 0, inv = 0, state = 'fly', t = 0, done = false, raf = 0, last = performance.now(), lastStats = '', lastSent = 0;
  const burn = { L: false, R: false }, remote = { L: false, R: false };
  const hit = new Set(), got = new Set();
  const fx = makeFx();
  const offs = [];
  let floats = [];

  // ---- Rintangan: tiap 1 "petak" jarak ada kemungkinan awan / burung / hati (dari seed → sama di dua HP) ----
  const STEP = 0.55; // jarak antar slot (dalam lebar layar)
  function slot(i) {
    const h1 = hash(seed + 11, i), h2 = hash(seed + 23, i), h3 = hash(seed + 37, i);
    const lvl = Math.min(1, i / 70); // makin jauh makin rame
    const items = [];
    if (i < 4) return items;
    if (h1 < 0.28 + lvl * 0.42) items.push({ k: h2 < 0.5 ? 'storm' : 'bird', y: 0.12 + h3 * 0.72, id: `${i}a` });
    if (lvl > 0.35 && hash(seed + 51, i) < lvl * 0.45) items.push({ k: 'bird', y: 0.12 + hash(seed + 53, i) * 0.72, id: `${i}b`, dx: 0.27 });
    if (hash(seed + 61, i) < 0.55) items.push({ k: 'heart', y: 0.15 + hash(seed + 67, i) * 0.7, id: `${i}h`, dx: 0.12 });
    return items;
  }
  const speed = () => (0.16 + Math.min(0.2, dist * 0.0022)) * (p.speed || 1); // lebar layar per detik

  // ---- Input ----
  const press = (side, down) => {
    if (side === 'both') { press('L', down); press('R', down); return; }
    if (mySide !== 'both' && side !== mySide) return;
    if (burn[side] === down) return;
    burn[side] = down;
    if (down) api.sfx('whoosh');
    if (duel && !host) duel.send('bburn', { s: side, d: down ? 1 : 0 });
  };
  pad.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; e.preventDefault(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} press(b.dataset.k, true); });
  const up = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; b.classList.remove('on'); press(b.dataset.k, false); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); pad.addEventListener('contextmenu', (e) => e.preventDefault());
  const KEYS = { a: 'L', ArrowLeft: 'L', d: 'R', ArrowRight: 'R', ' ': mySide === 'both' ? 'both' : mySide, ArrowUp: mySide === 'both' ? 'both' : mySide, w: mySide === 'both' ? 'both' : mySide };
  const onKey = (e) => { const s = KEYS[e.key]; if (!s) return; e.preventDefault(); if (e.repeat) return; press(s, e.type === 'keydown'); };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('resize', resize);

  // ---- Online ----
  if (duel) {
    if (host) offs.push(duel.on('bburn', (d) => { remote[d.s] = !!d.d; }));
    else {
      offs.push(duel.on('bstate', (d) => { Object.assign(B, { tx: d.x, ty: d.y, tilt: d.a, L: d.l, R: d.r }); dist = d.ds; lives = d.lv; hearts = d.h; inv = d.i; d.hit?.forEach((id) => hit.add(id)); d.got?.forEach((id) => got.add(id)); }));
      offs.push(duel.on('bend', (d) => { dist = d.ds; hearts = d.h; finish(d.win); }));
    }
  }

  function hurt(id) {
    if (inv > 0) return;
    hit.add(id); lives--; inv = 1.4; api.sfx('crash'); api.streak(false);
    floats.push({ x: B.x, y: B.y - 0.1, t: 'Aduh! 💥', life: 1 });
    if (lives <= 0) finish(false);
  }
  function update(dt) {
    t += dt; inv = Math.max(0, inv - dt);
    for (const f of floats) f.life -= dt;
    floats = floats.filter((f) => f.life > 0);
    if (!host) { // tamu: cuma ngikutin posisi dari tuan rumah
      if (B.tx != null) { B.x += (B.tx - B.x) * Math.min(1, dt * 10); B.y += (B.ty - B.y) * Math.min(1, dt * 10); }
      return;
    }
    // siapa yang nyala: sendiri = dua tombolku; berdua = kiri punya tuan rumah, kanan dari tamu
    const R = duel ? remote.R : burn.R; // kiri selalu tombol tuan rumah / tombolku sendiri
    B.L += ((burn.L ? 1 : 0) - B.L) * Math.min(1, dt * 10); B.R += ((R ? 1 : 0) - B.R) * Math.min(1, dt * 10);
    const lift = (B.L + B.R) * 0.5;
    // miring: kanan lebih panas → miring ke kiri (tilt negatif) → balon mundur; kiri lebih panas → maju
    B.tilt += ((B.L - B.R) * 0.5 - B.tilt) * Math.min(1, dt * TILT_K);
    const hover = t < 2 ? 1 - t / 2 : 0; // 2 detik pertama melayang dulu biar sempet siap
    B.vy += (GRAV * (1 - hover) - lift * BURN * (1 - Math.abs(B.tilt) * 0.35)) * dt / 1000;
    B.vy = Math.max(-MAXV / 1000, Math.min(MAXV / 1000, B.vy));
    B.y += B.vy * dt * 2.4;
    B.vx += (B.tilt * 0.55 - B.vx) * Math.min(1, dt * 2.5);
    B.x = Math.max(0.12, Math.min(0.62, B.x + B.vx * dt * 0.6));
    if (B.y < 0.2) { B.y = 0.2; B.vy = Math.max(0, B.vy); } // jangan sampai ketutup HUD
    if (B.y > 0.9) { // nyentuh tanah: mantul pelan (nggak ngurangin nyawa), majunya ngerem dikit
      if (B.vy > 0.05) { floats.push({ x: B.x, y: 0.82, t: 'Bruk! 🌱', life: 0.8 }); api.sfx('thud'); }
      B.y = 0.9; B.vy = -0.04; ground = 0.6;
    }
    ground = Math.max(0, ground - dt);
    dist += speed() * dt * 20 * (ground > 0 ? 0.5 : 1); // meter
    // tabrakan & ambil hati
    const scroll = (dist * SC) / STEP; // dalam slot
    const first = Math.max(0, Math.floor(scroll) - 1);
    for (let i = first; i < first + 4; i++) for (const it of slot(i)) {
      const ix = (i + (it.dx || 0) - scroll) * STEP + 1.05; // posisi x di layar (lebar = 1)
      if (Math.abs(ix - B.x) > (it.k === 'heart' ? 0.1 : 0.085) || Math.abs(it.y - B.y) > (it.k === 'storm' ? 0.085 : it.k === 'heart' ? 0.08 : 0.065)) continue;
      if (it.k === 'heart') { if (!got.has(it.id)) { got.add(it.id); hearts++; api.sfx('coin'); api.streak(true); floats.push({ x: B.x, y: B.y - 0.12, t: '+💖', life: 0.8 }); } }
      else if (!hit.has(it.id)) hurt(it.id);
    }
    if (p.goal && !p.endless && dist >= p.goal) finish(true);
    if (duel && performance.now() - lastSent > 85) {
      lastSent = performance.now();
      duel.send('bstate', { x: +B.x.toFixed(3), y: +B.y.toFixed(3), a: +B.tilt.toFixed(3), l: +B.L.toFixed(2), r: +B.R.toFixed(2), ds: +dist.toFixed(1), lv: lives, h: hearts, i: +inv.toFixed(2), hit: [...hit].slice(-6), got: [...got].slice(-6) });
    }
  }

  // ---- Gambar ----
  function drawBalloon() {
    const x = B.x * W, y = B.y * H, r = 62 * k, now = performance.now() / 1000;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-B.tilt * 0.35);
    if (inv > 0 && Math.floor(inv * 10) % 2) ctx.globalAlpha = 0.5;
    // amplop balon bergaris
    const cols = ['#ff6f9f', '#ffd166', '#b48cff', '#7fd1ff', '#ff6f9f', '#ffd166'];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = cols[i]; ctx.beginPath();
      const a0 = -Math.PI + (i / 6) * Math.PI, a1 = -Math.PI + ((i + 1) / 6) * Math.PI;
      ctx.moveTo(0, r * 0.95);
      ctx.quadraticCurveTo(Math.cos(a0) * r * 1.3, -r * 0.2 + Math.sin(a0) * r, Math.cos(a0) * r * 0.98, -r * 0.35 + Math.sin(a0) * r * 0.98);
      ctx.arc(0, -r * 0.35, r * 0.98, a0, a1);
      ctx.quadraticCurveTo(Math.cos(a1) * r * 1.3, -r * 0.2 + Math.sin(a1) * r, 0, r * 0.95);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.75, r * 0.18, r * 0.35, -0.4, 0, Math.PI * 2); ctx.fill();
    // tali & keranjang berisi kalian berdua
    ctx.strokeStyle = '#7a4b2e'; ctx.lineWidth = 2;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.35, r * 0.85); ctx.lineTo(s * r * 0.42, r * 1.45); ctx.stroke(); }
    // api pembakar (kiri & kanan)
    for (const [s, v] of [[-1, B.L], [1, B.R]]) if (v > 0.05) {
      const fh = r * (0.25 + 0.35 * v) * (0.85 + 0.15 * Math.sin(now * 30 + s));
      const fg = ctx.createRadialGradient(s * r * 0.18, r * 1.05, 2, s * r * 0.18, r * 1.05 - fh * 0.5, fh); fg.addColorStop(0, 'rgba(255,250,200,.95)'); fg.addColorStop(0.5, 'rgba(255,170,60,.85)'); fg.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(s * r * 0.18, r * 1.1 - fh * 0.45, fh * 0.35, fh * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#b07a4f'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-r * 0.55, r * 1.42, r * 1.1, r * 0.55, 8) : ctx.rect(-r * 0.55, r * 1.42, r * 1.1, r * 0.55); ctx.fill();
    ctx.strokeStyle = '#8a5a37'; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.55 + i * r * 0.275, r * 1.42); ctx.lineTo(-r * 0.55 + i * r * 0.275, r * 1.97); ctx.stroke(); }
    drawFace(ctx, faceA, -r * 0.24, r * 1.32, r * 0.24, p.waterEmoji || p.emoji || '😊', '#ff8fb7');
    drawFace(ctx, faceB, r * 0.24, r * 1.32, r * 0.24, p.fireEmoji || p.oppEmoji || '😊', '#9fb4ff');
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const now = performance.now() / 1000;
    drawSky(ctx, W, H, H * 1.05, dist * 40, now, dist > 300 ? 'sunset' : 'day', k);
    const scroll = (dist * SC) / STEP, first = Math.max(0, Math.floor(scroll) - 1);
    for (let i = first; i < first + 4; i++) for (const it of slot(i)) {
      const ix = ((i + (it.dx || 0) - scroll) * STEP + 1.05) * W, iy = it.y * H;
      if (ix < -80 || ix > W + 80) continue;
      if (it.k === 'heart') { if (!got.has(it.id)) drawEmoji(ctx, '💖', ix, iy + Math.sin(now * 4 + i) * 5, 40 * k); continue; }
      const gone = hit.has(it.id);
      ctx.globalAlpha = gone ? 0.35 : 1;
      if (it.k === 'storm') { ctx.fillStyle = 'rgba(90,80,120,.25)'; ctx.beginPath(); ctx.ellipse(ix, iy + 40 * k, 50 * k, 12 * k, 0, 0, Math.PI * 2); ctx.fill(); drawEmoji(ctx, '⛈️', ix, iy, 92 * k); }
      else drawEmoji(ctx, '🐦', ix + Math.sin(now * 3 + i) * 6, iy + Math.sin(now * 6 + i) * 8, 52 * k);
      ctx.globalAlpha = 1;
    }
    drawBalloon();
    fx.draw(ctx);
    ctx.font = '700 20px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#c2306f';
    for (const f of floats) { ctx.globalAlpha = Math.max(0, f.life); ctx.strokeText(f.t, f.x * W, f.y * H); ctx.fillText(f.t, f.x * W, f.y * H); }
    ctx.globalAlpha = 1;
    // HUD
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '700 16px Fredoka, sans-serif'; ctx.fillStyle = '#5a2a52';
    ctx.fillText(`${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat(Math.max(0, 3 - lives))}`, 12, 20);
    ctx.textAlign = 'right'; ctx.fillStyle = '#c2306f'; ctx.fillText(`${Math.floor(dist)} m${p.goal && !p.endless ? ` / ${p.goal}` : ''}`, W - 12, 20);
    if (p.goal && !p.endless) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(12, 36, W - 24, 6); ctx.fillStyle = '#ff6f9f'; ctx.fillRect(12, 36, (W - 24) * Math.min(1, dist / p.goal), 6); }
    // kompak meter: dua-duanya nyala = kompak
    const sync = Math.min(B.L, B.R);
    if (sync > 0.6) { ctx.textAlign = 'center'; ctx.font = '700 15px Fredoka, sans-serif'; ctx.fillStyle = '#2fbf71'; ctx.fillText('Kompak! 💞', W / 2, 20); }
    pad.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('lit', (b.dataset.k === 'L' ? B.L : B.R) > 0.3));
    const s = `🎈 ${Math.floor(dist)} m · 💖 ${hearts} · ${'❤️'.repeat(Math.max(0, lives))}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (!done) update(dt);
    fx.step(dt);
    draw();
  }
  if (window.__lqTest) window.__balloon = { B, burn, remote, get dist() { return dist; }, get lives() { return lives; }, get hearts() { return hearts; }, setDist: (v) => { dist = v; } };
  raf = requestAnimationFrame(loop);
  api.say(mySide === 'both' ? 'Tahan dua pembakar biar naik lurus. Satu aja = balonnya miring! 🎈' : `Kamu pegang pembakar ${mySide === 'L' ? 'kiri' : 'kanan'}. Kompakan sama ${p.oppName || 'pasanganmu'} ya! 🎈`, 'happy');

  function finish(win) {
    if (done) return;
    done = true;
    if (duel && host) duel.send('bend', { win: !!win, ds: Math.floor(dist), h: hearts });
    const m = Math.floor(dist);
    if (p.endless) { api.finish({ win: true, score: m, detail: `Terbang ${m} m bareng, dapet ${hearts} 💖` }); return; }
    if (duel) { api.finish({ win: !!win || m > 0, dist: m, hearts }); return; }
    api.finish({ win: !!win, stars: win ? (lives === 3 ? 3 : lives === 2 ? 2 : 1) : 0, detail: win ? `Sampai ${p.goal} m! Sisa nyawa ${lives}, dapet ${hearts} 💖` : `Jatuh di ${m} m dari ${p.goal} m 🎈` });
  }
  return {
    destroy() {
      done = true; cancelAnimationFrame(raf); offs.forEach((f) => f());
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('resize', resize);
    },
  };
}
