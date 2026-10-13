// Latar & efek bareng buat game kanvas: langit bergradasi, matahari, awan, bukit berlapis (parallax),
// tanah berumput, dan partikel (percikan / konfeti). Semuanya digambar langsung, tanpa file gambar.

const THEMES = {
  day: { sky: ['#8fd3ff', '#cfeeff', '#ffe9f3'], sun: '#fff3b0', glow: 'rgba(255,240,170,.55)', far: '#bfe3c8', mid: '#9ed6a0', near: '#7cc77f', cloud: '#ffffff', grass: '#8fd96a', grassTop: '#b6ec86', dirt: '#c98f5e', dirt2: '#b57a4c' },
  sunset: { sky: ['#ff9ebb', '#ffc4b0', '#ffe9b8'], sun: '#fff0c2', glow: 'rgba(255,220,150,.6)', far: '#e7a6c9', mid: '#c98bc0', near: '#a874b8', cloud: '#fff1f6', grass: '#9ad27a', grassTop: '#bfe994', dirt: '#b9805a', dirt2: '#a36d49' },
  night: { sky: ['#2a2456', '#51407f', '#a66aa8'], sun: '#fff8dc', glow: 'rgba(255,248,220,.3)', far: '#4b3f7a', mid: '#3c3368', near: '#2f2957', cloud: '#cfc4ee', grass: '#5fae7a', grassTop: '#86cf96', dirt: '#7a5a52', dirt2: '#684a44', stars: true },
  candy: { sky: ['#ffc2dc', '#ffdcec', '#fff3f8'], sun: '#fffbe0', glow: 'rgba(255,255,255,.6)', far: '#f7b7d6', mid: '#f29cc6', near: '#e87fb4', cloud: '#ffffff', grass: '#ff9fc6', grassTop: '#ffc4dc', dirt: '#e58ab3', dirt2: '#d674a1' },
};
export const theme = (name) => THEMES[name] || THEMES.day;

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
export const roundRect = rr;

function cloud(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [dx, dy, r] of [[-26, 4, 16], [-8, -6, 22], [14, -2, 18], [30, 6, 13], [2, 8, 20]]) { ctx.moveTo(x + dx * s + r * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); }
  ctx.fill();
}
// Satu lapis bukit: gabungan gelombang, digeser sesuai jarak tempuh (off)
function hills(ctx, W, base, bottom, off, amp, len, color, seed) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let x = 0; x <= W + 8; x += 8) {
    const u = (x + off) / len;
    ctx.lineTo(x, base - (Math.sin(u + seed) * 0.6 + Math.sin(u * 2.3 + seed * 3) * 0.3 + Math.sin(u * 0.47 + seed * 7) * 0.5) * amp - amp);
  }
  ctx.lineTo(W, bottom);
  ctx.closePath();
  ctx.fill();
}

// Langit lengkap. horizon = garis tanah (px), scroll = jarak tempuh (px), t = waktu (detik)
export function drawSky(ctx, W, H, horizon, scroll = 0, t = 0, name = 'day', k = 1) {
  const T = theme(name);
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, T.sky[0]); g.addColorStop(0.6, T.sky[1]); g.addColorStop(1, T.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (T.stars) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 1.3 + i)); ctx.beginPath(); ctx.arc(hash(i) * W, hash(i + 50) * horizon * 0.8, 1 + hash(i + 9) * 1.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  const sx = W * 0.76, sy = horizon * 0.26, sr = 30 * k;
  const gl = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 3.2);
  gl.addColorStop(0, T.glow); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, sr * 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = T.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  // awan: 2 lapis, jalan pelan sendiri + ikut kegeser dikit
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 6; i++) {
    const far = i % 2, sp = far ? 0.04 : 0.09, span = W + 220;
    const x = ((hash(i * 3.1) * span - scroll * sp - t * (far ? 5 : 9)) % span + span) % span - 110;
    cloud(ctx, x, horizon * (0.1 + hash(i * 7.7) * 0.5), (far ? 0.75 : 1.15) * k, T.cloud);
  }
  ctx.globalAlpha = 1;
  hills(ctx, W, horizon, H, scroll * 0.06, 34 * k, 190 * k, T.far, 1.3);
  hills(ctx, W, horizon, H, scroll * 0.14, 22 * k, 130 * k, T.mid, 4.1);
  hills(ctx, W, horizon, H, scroll * 0.3, 11 * k, 90 * k, T.near, 8.6);
}

// Tanah berumput yang ikut jalan (rumput di atas, tanah belang di bawah)
export function drawGround(ctx, W, H, y, scroll = 0, name = 'day', k = 1) {
  const T = theme(name);
  ctx.fillStyle = T.dirt; ctx.fillRect(0, y, W, H - y);
  ctx.fillStyle = T.dirt2;
  const step = 54 * k;
  for (let x = -(scroll % step) - step; x < W + step; x += step) {
    const i = Math.round((x + scroll) / step);
    rr(ctx, x + hash(i) * 20 * k, y + (24 + hash(i + 3) * 30) * k, (16 + hash(i + 5) * 16) * k, 7 * k, 4 * k); ctx.fill();
    rr(ctx, x + 26 * k + hash(i + 8) * 14 * k, y + (62 + hash(i + 11) * 40) * k, (10 + hash(i + 2) * 14) * k, 6 * k, 3 * k); ctx.fill();
  }
  ctx.fillStyle = T.grass; rr(ctx, -10, y - 2 * k, W + 20, 18 * k, 8 * k); ctx.fill();
  ctx.fillStyle = T.grassTop; ctx.fillRect(0, y - 2 * k, W, 5 * k);
  // jumbai rumput
  ctx.fillStyle = T.grass;
  const st = 22 * k;
  for (let x = -(scroll % st) - st; x < W + st; x += st) { ctx.beginPath(); ctx.moveTo(x, y + 15 * k); ctx.quadraticCurveTo(x + st / 2, y + 26 * k, x + st, y + 15 * k); ctx.fill(); }
}

// Partikel sederhana: percikan warna / emoji kecil yang mental lalu hilang
export function makeFx() {
  let ps = [];
  return {
    burst(x, y, { n = 10, colors = ['#ff8fb7', '#ffd166', '#ffffff'], speed = 180, size = 5, gravity = 500, life = 0.7, up = 0.5 } = {}) {
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6); ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * up, g: gravity, r: size * (0.5 + Math.random() * 0.7), c: colors[i % colors.length], life, max: life, rot: Math.random() * 6, sq: Math.random() < 0.5 }); }
      if (ps.length > 260) ps = ps.slice(-260);
    },
    puff(x, y, color = 'rgba(255,255,255,.8)', size = 8) { ps.push({ x, y, vx: -30 - Math.random() * 30, vy: -10 + Math.random() * 20, g: -20, r: size, c: color, life: 0.45, max: 0.45, puff: true }); },
    step(dt) { for (const q of ps) { q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; q.rot += dt * 6; } ps = ps.filter((q) => q.life > 0); },
    draw(ctx) {
      for (const q of ps) {
        const a = Math.max(0, q.life / q.max);
        ctx.globalAlpha = q.puff ? a * 0.7 : Math.min(1, a * 1.6);
        ctx.fillStyle = q.c;
        if (q.puff) { ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1.6 - a), 0, Math.PI * 2); ctx.fill(); }
        else if (q.sq) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.r, -q.r * 0.6, q.r * 2, q.r * 1.2); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    },
  };
}

// Tulisan tebal bergaris putih (buat petunjuk & angka melayang)
export function outlined(ctx, text, x, y, px, color = '#e8558f', stroke = '#fff') {
  ctx.font = `700 ${Math.round(px)}px Fredoka, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, px * 0.26); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

// Bayangan lonjong di tanah
export function shadow(ctx, x, y, w, alpha = 0.16) { ctx.fillStyle = `rgba(40,20,50,${alpha})`; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2); ctx.fill(); }
