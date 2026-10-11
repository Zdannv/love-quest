// Ngebut Pulang: balapan motor ala Traffic Rider, tampilan 3D semu dari belakang.
// Geser jari kiri-kanan buat belok, tahan layar buat ngegas lebih kencang. Salip mobil mepet = bonus.
// Sendiri (p.endless): 3 nyawa, skor = jarak (meter). Berdua (p.race): jalan & lalu lintas sama (p.rng),
// nggak ada nyawa (nabrak cuma melambat), yang duluan nyampe finish menang. Motor pasangan ikut kelihatan.
import { drawEmoji, drawFace, loadImage } from '../util.js';

// Mobil 3D tampak belakang & gokart pemain (Kenney Car Kit, CC0: img/race/LICENSE.txt)
const CAR_NAMES = ['sedan', 'suv', 'taxi', 'police', 'van', 'delivery', 'hatchback-sports', 'truck'];
const CAR_W = 2.0, KART_W = 1.5; // lebar (meter) mobil & gokart di jalan, dipakai buat gambar DAN tabrakan
const SIGNS = ['Semangat {n}! 💗', 'Hati-hati ya {n} 🥺', '{n} jago banget 😎', 'Pelan-pelan sayang 🐢', 'Kangen {n} 💌'];

export function startRace(stage, p, api) {
  const face = loadImage(p.face);
  const carImgs = CAR_NAMES.map((n) => loadImage(`/img/race/car-${n}.webp`)), kartImg = loadImage('/img/race/kart.webp');
  const signFace = loadImage(p.signFace || p.face);
  const rng = p.rng || Math.random;
  const rnd = (a, b) => a + rng() * (b - a);
  const race = p.race || null;
  const ghostFace = race ? loadImage(race.face) : null;
  const canvas = document.createElement('canvas');
  canvas.className = 'catch-canvas';
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, k = 1, horizon = 0;
  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    k = Math.min(1.25, Math.max(0.8, H / 650));
    horizon = H * 0.36;
  }
  resize();

  // ---- Dunia: z = jarak di jalan (meter), x = posisi dari tengah jalan (-1 kiri … 1 kanan) ----
  const CAM_H = 1.6, RW = 5, DRAW = 170, NEAR = 3.5; // tinggi kamera (m), setengah lebar jalan (m), jarak pandang, jarak kamera ke motor
  const MAX = p.maxSpeed || 46, BOOST = 1.25; // m/s
  const player = { z: 0, x: 0, tx: 0, speed: 12, lean: 0 };
  let cars = [], hearts = [], signs = [], floats = [];
  let nextCar = 30, nextHeart = 60, nextSign = 40;
  let lives = p.lives || 3, hurtT = 0, done = false, raf = 0, last = performance.now(), elapsed = 0;
  let collected = 0, nearMiss = 0, bonus = 0, holding = false, lastStats = '', started = false;
  const finish = p.finish || p.goal || 0; // meter (mode berdua / mode level)

  // Tikungan halus: lengkungan jalan berubah pelan seiring jarak, sama di dua HP (pakai rng)
  const bends = []; for (let i = 0; i < 400; i++) bends.push(rnd(-1, 1) * (i < 2 ? 0 : 1));
  const curveAt = (z) => { const i = Math.max(0, z / 220); const a = Math.floor(i), f = i - a; const s = f * f * (3 - 2 * f); return (bends[a % 400] * (1 - s) + bends[(a + 1) % 400] * s) * 0.0016; };

  function spawn() {
    while (nextCar < player.z + DRAW + 40) {
      const lane = [-0.66, 0, 0.66][Math.floor(rng() * 3)];
      cars.push({ z: nextCar, x: lane, ci: Math.floor(rng() * CAR_NAMES.length), v: rnd(6, 13), passed: false, hit: false });
      const gap = Math.max(14, 34 - (nextCar / 1000) * 4); // makin jauh makin rame
      nextCar += rnd(gap * 0.6, gap * 1.4);
    }
    while (nextHeart < player.z + DRAW) { hearts.push({ z: nextHeart, x: [-0.66, 0, 0.66][Math.floor(rng() * 3)], got: false }); nextHeart += rnd(50, 110); }
    while (nextSign < player.z + DRAW) { signs.push({ z: nextSign, side: rng() < 0.5 ? -1 : 1, text: SIGNS[Math.floor(rng() * SIGNS.length)].replace('{n}', p.signName || '') }); nextSign += rnd(140, 260); }
  }

  // Proyeksi titik dunia → layar. Kamera di belakang motor, ngikut posisi motor sebagian biar jalan kerasa luas.
  function project(z, x) {
    const dz = z - player.z + NEAR;
    if (dz <= 0.4) return null;
    const s = 1 / dz, Kx = W * 0.455, Ky = (H * 0.97 - horizon) * NEAR / CAM_H;
    const off = curveAt(player.z + dz * 0.5) * dz * dz; // tikungan: makin jauh makin melengkung (meter)
    const camX = player.x * RW * 0.7;
    return { sx: W / 2 + (x * RW + off - camX) * s * Kx, sy: horizon + CAM_H * s * Ky, s: s * Kx, half: RW * s * Kx };
  }

  // ---- Kontrol ----
  const toX = (cx) => { const r = canvas.getBoundingClientRect(); return Math.max(-1, Math.min(1, ((cx - r.left) / r.width - 0.5) * 2.4)); };
  const onDown = (e) => { e.preventDefault(); holding = true; started = true; player.tx = toX(e.clientX); try { canvas.setPointerCapture(e.pointerId); } catch {} };
  const onMove = (e) => { if (holding) player.tx = toX(e.clientX); };
  const onUp = () => { holding = false; };
  const keys = {};
  const onKey = (e) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) { e.preventDefault(); keys[e.key] = e.type === 'keydown'; started = true; } };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('resize', resize);

  const addFloat = (text, color) => floats.push({ x: W / 2 + (player.x * W) / 4, y: H * 0.7, text, color, life: 1 });

  function crash(c) {
    if (hurtT > 0) return;
    c.hit = true;
    hurtT = 1.5;
    player.speed *= 0.35;
    api.sfx('bad');
    api.streak(false);
    addFloat('Brakk! 💥', '#ff4d6d');
    if (race) return; // berdua: cuma melambat
    lives--;
    api.say(lives > 0 ? 'Aduh nabrak 😵 hati-hati {pasangan}!' : 'Yahh motornya mogok 🥲', 'sad');
    if (lives <= 0) end(false);
  }

  function update(dt) {
    hurtT = Math.max(0, hurtT - dt);
    for (const f of floats) { f.y -= 50 * dt; f.life -= dt * 1.1; }
    floats = floats.filter((f) => f.life > 0);
    if (!started) return;
    elapsed += dt;
    // setir: keyboard atau jari
    if (keys.ArrowLeft) player.tx = Math.max(-1, player.tx - 2.2 * dt);
    if (keys.ArrowRight) player.tx = Math.min(1, player.tx + 2.2 * dt);
    const boost = holding || keys.ArrowUp || keys[' '];
    // kecepatan naik pelan-pelan; tahan layar = ngegas
    const top = Math.min(MAX, 20 + elapsed * 0.55) * (boost ? BOOST : 1);
    player.speed += (top - player.speed) * Math.min(1, dt * (boost ? 0.9 : 0.5));
    const prevX = player.x;
    player.x += (player.tx - player.x) * Math.min(1, dt * 7);
    player.x -= curveAt(player.z + 10) * player.speed * player.speed * dt * 0.09; // tikungan bikin agak kebawa ke luar
    player.x = Math.max(-1.15, Math.min(1.15, player.x));
    if (Math.abs(player.x) > 1) player.speed *= 1 - dt * 1.4; // keluar aspal → melambat
    player.lean = (player.x - prevX) / Math.max(dt, 0.001) * 0.12;
    player.z += player.speed * dt;
    spawn();

    for (const c of cars) {
      c.z += c.v * dt;
      const dz = c.z - player.z;
      // kena kalau badan mobil & gokart beneran nempel (lebar yang digambar = lebar yang dicek)
      if (!c.hit && dz > -1.4 && dz < 1.9 && Math.abs(c.x - player.x) * RW < ((CAR_W + KART_W) / 2) * 0.86) crash(c);
      if (!c.passed && dz < -1.2) {
        c.passed = true;
        if (!c.hit && Math.abs(c.x - player.x) * RW < 3.0) { nearMiss++; bonus += 25; api.sfx('pop'); api.streak(true); addFloat('Mepet! +25 😎', '#ff9f1c'); }
      }
    }
    for (const h of hearts) {
      if (!h.got && Math.abs(h.z - player.z) < 2 && Math.abs(h.x - player.x) < 0.4) { h.got = true; collected++; bonus += 20; api.sfx('good'); addFloat('+💖', '#ff5c93'); }
    }
    cars = cars.filter((c) => c.z > player.z - 8);
    hearts = hearts.filter((h) => !h.got && h.z > player.z - 4);
    signs = signs.filter((s) => s.z > player.z - 6);
    if (finish && player.z >= finish && !done) end(true);
  }

  // ---- Gambar ----
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, '#ffb3d1'); g.addColorStop(1, '#ffe2c4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizon + 2);
    ctx.fillStyle = '#ffd36e';
    ctx.beginPath(); ctx.arc(W * 0.72 - curveAt(player.z) * W * 40, horizon - 30 * k, 26 * k, 0, Math.PI * 2); ctx.fill();
    // bukit di kejauhan, geser pelan pas belok
    const sh = (player.z * 0.02 + curveAt(player.z) * 3000) % W;
    ctx.fillStyle = '#e7a6c8';
    for (let i = -1; i < 3; i++) { const bx = i * W * 0.6 - sh; ctx.beginPath(); ctx.ellipse(bx + W * 0.3, horizon + 4, W * 0.36, 34 * k, 0, Math.PI, 0); ctx.fill(); }
  }
  function drawRoad() {
    ctx.fillStyle = '#a8e0a0'; ctx.fillRect(0, horizon, W, H - horizon);
    let prev = null;
    for (let z = DRAW; z >= 0.6; z -= z > 40 ? 3 : z > 12 ? 1 : 0.5) {
      const pr = project(player.z + z - NEAR, 0);
      if (!pr) continue;
      if (prev) {
        const stripe = Math.floor((player.z + z) / 6) % 2 === 0;
        const y0 = prev.sy, y1 = pr.sy;
        if (y1 > y0) {
          const quad = (c, w0, w1) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(prev.sx - w0, y0); ctx.lineTo(prev.sx + w0, y0); ctx.lineTo(pr.sx + w1, y1 + 1); ctx.lineTo(pr.sx - w1, y1 + 1); ctx.fill(); };
          ctx.fillStyle = stripe ? '#9bd492' : '#a8e0a0'; ctx.fillRect(0, y0, W, y1 - y0 + 1);
          quad(stripe ? '#ff6f9f' : '#fff', prev.half * 1.12, pr.half * 1.12); // pinggiran merah-putih
          quad(stripe ? '#6b6475' : '#716a7b', prev.half, pr.half); // aspal
          if (stripe) { quad('#fff', prev.half * 0.36, pr.half * 0.36); quad(stripe ? '#6b6475' : '#716a7b', prev.half * 0.3, pr.half * 0.3); } // garis lajur
        }
      }
      prev = pr;
    }
  }
  function sprite(z, x, size, fn) {
    const pr = project(z, x);
    if (!pr || pr.sy < horizon) return;
    fn(pr.sx, pr.sy, Math.max(3, size * pr.s));
  }
  function drawObjects() {
    const objs = [];
    for (const c of cars) objs.push({ z: c.z, f: () => sprite(c.z, c.x, CAR_W, (x, y, s) => {
      const im = carImgs[c.ci];
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.02, s * 0.55, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      if (im.complete && im.naturalWidth) { const h = s * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, x - s / 2, y - h, s, h); } else drawEmoji(ctx, '🚗', x, y - s * 0.4, s);
    }) });
    for (const h of hearts) objs.push({ z: h.z, f: () => sprite(h.z, h.x, 1.5, (x, y, s) => drawEmoji(ctx, '💖', x, y - s * 0.7 + Math.sin(performance.now() / 200 + h.z) * s * 0.08, s)) });
    for (const sg of signs) objs.push({ z: sg.z, f: () => sprite(sg.z, sg.side * 1.5, 3.2, (x, y, s) => {
      ctx.fillStyle = '#8a6b5a'; ctx.fillRect(x - s * 0.03, y - s * 0.7, s * 0.06, s * 0.7);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ff6f9f'; ctx.lineWidth = Math.max(1, s * 0.03);
      const bw = s * 1.2, bh = s * 0.5;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - bw / 2, y - s * 0.7 - bh, bw, bh, s * 0.06); else ctx.rect(x - bw / 2, y - s * 0.7 - bh, bw, bh); ctx.fill(); ctx.stroke();
      if (s > 26) {
        drawFace(ctx, signFace, x - bw / 2 + bh * 0.5, y - s * 0.7 - bh / 2, bh * 0.36, '💗');
        ctx.fillStyle = '#c2306f'; ctx.font = `700 ${Math.max(6, s * 0.1)}px Fredoka, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(sg.text, x - bw / 2 + bh * 0.95, y - s * 0.7 - bh / 2, bw - bh * 1.05);
      }
    }) });
    if (race) {
      const g = race.ghost();
      if (g && g.z - player.z > -2) objs.push({ z: g.z, f: () => sprite(g.z, g.x, KART_W, (x, y, s) => { ctx.save(); ctx.globalAlpha = 0.85; const h = drawKart(x, y, s, ghostFace, race.emoji, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#6a2c52'; ctx.font = `600 ${Math.max(8, s * 0.2)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(race.name, x, y - h - s * 0.12); ctx.restore(); }) });
    }
    if (finish) objs.push({ z: finish, f: () => sprite(finish, 0, 4, (x, y, s) => { const pr = project(finish, 0); if (!pr) return; const w = pr.half * 2.3; ctx.fillStyle = '#ff6f9f'; ctx.fillRect(x - w / 2, y - s * 0.9, w, s * 0.16); ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(8, s * 0.12)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏁 FINISH 🏁', x, y - s * 0.82); }) });
    objs.sort((a, b) => b.z - a.z).forEach((o) => o.f());
  }
  // Gokart dari belakang, muka pengemudinya ditempel di helm. s = lebar gokart (px). Balikin tinggi gambarnya.
  function drawKart(x, y, s, img, emoji, lean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.max(-0.2, Math.min(0.2, lean * 0.6)));
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.52, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    let h = s;
    if (kartImg.complete && kartImg.naturalWidth) { h = s * kartImg.naturalHeight / kartImg.naturalWidth; ctx.drawImage(kartImg, -s / 2, -h, s, h); }
    else drawEmoji(ctx, '🏎️', 0, -s * 0.45, s);
    drawFace(ctx, img, 0, -h * 0.79, s * 0.27, emoji || '😊');
    ctx.restore();
    return h;
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    drawSky();
    drawRoad();
    drawObjects();
    // motor kita
    const me = project(player.z, player.x);
    if (me && !(hurtT > 0 && Math.floor(hurtT * 12) % 2)) drawKart(me.sx, me.sy, KART_W * me.s, face, p.rider, player.lean);
    // speedometer
    const kmh = Math.round(player.speed * 3.6);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(10, H - 54 * k, 96 * k, 42 * k, 14); else ctx.rect(10, H - 54 * k, 96 * k, 42 * k); ctx.fill();
    ctx.fillStyle = '#c2306f'; ctx.font = `700 ${Math.round(20 * k)}px Fredoka, sans-serif`; ctx.fillText(`${kmh}`, 10 + 34 * k, H - 33 * k);
    ctx.font = `600 ${Math.round(11 * k)}px Fredoka, sans-serif`; ctx.fillStyle = '#8a6b7d'; ctx.fillText('km/j', 10 + 74 * k, H - 31 * k);
    if (finish) { // progres ke finish
      const pw = W - 32, py = 10;
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(16, py, pw, 8);
      ctx.fillStyle = '#ff6f9f'; ctx.fillRect(16, py, pw * Math.min(1, player.z / finish), 8);
      if (race?.ghost()) { const gz = race.ghost().z; ctx.save(); ctx.translate(16 + pw * Math.min(1, gz / finish), py + 4); drawFace(ctx, ghostFace, 0, 0, 9, race.emoji); ctx.restore(); }
      ctx.save(); ctx.translate(16 + pw * Math.min(1, player.z / finish), py + 4); drawFace(ctx, face, 0, 0, 10, p.rider); ctx.restore();
    }
    if (!started) {
      ctx.font = `600 ${Math.round(21 * k)}px Fredoka, sans-serif`; ctx.fillStyle = '#e8558f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
      for (const [t, yy] of [['Tahan & geser jari buat nyetir 👆', H * 0.55], ['tahan = ngegas · salip mepet = bonus', H * 0.61]]) { ctx.strokeText(t, W / 2, yy); ctx.fillText(t, W / 2, yy); }
    }
    ctx.font = `700 ${Math.round(22 * k)}px Fredoka, sans-serif`; ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
    for (const f of floats) { ctx.globalAlpha = Math.max(0, f.life); ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;

    const meters = Math.floor(player.z);
    const hearts3 = `${'❤️'.repeat(Math.max(0, lives))}${'🤍'.repeat((p.lives || 3) - Math.max(0, lives))}`;
    const s = race
      ? `🏍️ Kamu ${meters} m · ${race.name} ${Math.floor(race.ghost()?.z ?? 0)} m / ${finish} m`
      : p.goal ? `🏍️ ${meters}/${p.goal} m · ${hearts3}` : `🏍️ Skor ${score()} · 🏆 ${Math.max(p.best || 0, score())} · ${hearts3}`;
    if (s !== lastStats) { api.setStats(s); lastStats = s; }
  }
  const score = () => Math.floor(player.z / 10) + bonus;

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (!done) update(dt);
    race?.tick({ z: player.z, x: player.x, done, tm: elapsed });
    draw();
  }
  if (window.__lqTest) window.__race = { get cars() { return cars; }, player };
  raf = requestAnimationFrame(loop);

  function end(win) {
    if (done) return;
    done = true;
    const detail = `Nempuh ${Math.floor(player.z)} m · ${nearMiss}x nyalip mepet · ${collected} 💖`;
    if (p.goal) { api.finish(win ? { win: true, stars: Math.max(1, lives), detail: `Nyampe finish! ${detail}` } : { win: false, stars: 0, detail: `Baru ${Math.floor(player.z)} dari ${p.goal} m` }); return; }
    if (race) { race.tick({ z: player.z, x: player.x, done: true, tm: elapsed }, true); api.finish({ win, time: elapsed, z: player.z, detail }); return; }
    api.finish({ win: true, score: score(), detail });
  }

  return {
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('resize', resize);
    },
  };
}
