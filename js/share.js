// Kartu hasil buat dibagiin (story / WA): gambar 1080×1350 berisi judul, bintang/skor, muka kalian berdua & pesan manis.
// Dibuka di pratinjau: tombol "Bagikan" (menu share HP, langsung bawa gambarnya) atau "Simpan".
import { esc } from './util.js';
import { fxSrc } from './fx.js';

const W = 1080, H = 1350;
const load = (src, cors) => new Promise((ok) => {
  if (!src) { ok(null); return; }
  const img = new Image();
  if (cors && /^https?:/.test(src) && !src.startsWith(location.origin)) img.crossOrigin = 'anonymous';
  img.onload = () => ok(img); img.onerror = () => ok(null);
  img.src = src;
});
function wrap(ctx, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

// o = { kicker, title, sub, stars (0-3|null), icon (emoji), note, faces: [srcA, srcB], names: [a, b], brand, footer, colors: [c1, c2, c3] }
export async function makeCard(o) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  try { await document.fonts?.load('700 80px Fredoka'); } catch {}
  const [c1, c2, c3] = o.colors || ['#ff9cc4', '#d16fd0', '#7f7cf0'];
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, c1); bg.addColorStop(0.55, c2); bg.addColorStop(1, c3);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // bokeh & hati kecil
  for (let i = 0; i < 26; i++) { const x = (i * 397) % W, y = (i * 613) % H, r = 20 + (i * 37) % 90; ctx.fillStyle = `rgba(255,255,255,${0.05 + (i % 5) * 0.025})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  const heart = (x, y, s, a) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-14, -4, -8, -16, 0, -8); ctx.bezierCurveTo(8, -16, 14, -4, 0, 6); ctx.fill(); ctx.restore(); };
  for (let i = 0; i < 14; i++) heart((i * 271 + 90) % W, (i * 467 + 140) % H, 2 + (i % 4), 0.18);
  // kartu putih di tengah
  const cx = 70, cy = 150, cw = W - 140, ch = H - 300;
  ctx.fillStyle = 'rgba(80,20,70,.18)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx, cy + 18, cw, ch, 64) : ctx.rect(cx, cy + 18, cw, ch); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx, cy, cw, ch, 64) : ctx.rect(cx, cy, cw, ch); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // merek di atas kartu
  ctx.font = '700 40px Fredoka, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.fillText(o.brand || 'LOVE QUEST 💞', W / 2, 92);
  // ikon game
  const ic = o.icon ? await load(fxSrc(o.icon)) : null;
  let y = cy + 120;
  if (ic) ctx.drawImage(ic, W / 2 - 80, y - 80, 160, 160); else if (o.icon) { ctx.font = '140px sans-serif'; ctx.fillText(o.icon, W / 2, y); }
  y += 125;
  if (o.kicker) { ctx.font = '700 38px Fredoka, sans-serif'; ctx.fillStyle = c2; ctx.fillText(o.kicker.toUpperCase(), W / 2, y); y += 70; }
  ctx.font = '800 84px Fredoka, sans-serif'; ctx.fillStyle = '#3d1f3a';
  for (const ln of wrap(ctx, o.title, cw - 120).slice(0, 2)) { ctx.fillText(ln, W / 2, y); y += 92; }
  if (o.stars != null) {
    y += 10;
    for (let k = 0; k < 3; k++) { const on = k < o.stars, sx = W / 2 + (k - 1) * 120; ctx.font = '110px sans-serif'; ctx.fillStyle = on ? '#ffc21a' : '#eadbe3'; ctx.strokeStyle = on ? '#d48a00' : 'transparent'; ctx.lineWidth = 6; ctx.strokeText('★', sx, y); ctx.fillText('★', sx, y); }
    y += 105;
  }
  if (o.sub) { ctx.font = '600 40px Fredoka, sans-serif'; ctx.fillStyle = '#8a6b80'; for (const ln of wrap(ctx, o.sub, cw - 140).slice(0, 2)) { ctx.fillText(ln, W / 2, y); y += 52; } }
  // muka berdua + hati
  const faces = await Promise.all((o.faces || []).map((s) => load(s, true)));
  const fy = Math.max(y + 130, cy + ch - (o.note ? 360 : 190)), fr = 92;
  const face = (img, x, name, ring) => {
    ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(x, fy, fr + 12, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, fy, fr, 0, Math.PI * 2); ctx.clip();
    if (img) { const s = Math.max((fr * 2) / img.width, (fr * 2) / img.height); ctx.drawImage(img, x - (img.width * s) / 2, fy - (img.height * s) / 2, img.width * s, img.height * s); }
    else { ctx.fillStyle = '#ffe1ee'; ctx.fillRect(x - fr, fy - fr, fr * 2, fr * 2); ctx.font = '90px sans-serif'; ctx.fillStyle = '#e8558f'; ctx.fillText('💖', x, fy + 4); }
    ctx.restore();
    if (name) { ctx.font = '700 40px Fredoka, sans-serif'; ctx.fillStyle = '#3d1f3a'; ctx.fillText(name, x, fy + fr + 52); }
  };
  face(faces[0], W / 2 - 190, o.names?.[0], '#ff9cc4');
  face(faces[1], W / 2 + 190, o.names?.[1], '#9fb4ff');
  const hi = await load(fxSrc('💞'));
  if (hi) ctx.drawImage(hi, W / 2 - 60, fy - 60, 120, 120); else { ctx.font = '100px sans-serif'; ctx.fillText('💞', W / 2, fy); }
  // pesan manis
  if (o.note) {
    const ny = fy + fr + 105;
    ctx.fillStyle = '#fff3f8'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx + 60, ny, cw - 120, 150, 36) : ctx.rect(cx + 60, ny, cw - 120, 150); ctx.fill();
    ctx.font = 'italic 600 34px Fredoka, sans-serif'; ctx.fillStyle = '#a03a76';
    const ls = wrap(ctx, `“${o.note}”`, cw - 190).slice(0, 3);
    ls.forEach((ln, i) => ctx.fillText(ln, W / 2, ny + 75 + (i - (ls.length - 1) / 2) * 44));
  }
  // kaki
  ctx.font = '700 40px Fredoka, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.96)';
  ctx.fillText(o.footer || 'Main bareng di lovequest.id 💞', W / 2, H - 82);
  return new Promise((ok) => c.toBlob((b) => ok(b), 'image/png'));
}

// Pratinjau + bagikan / simpan
export async function shareCard(o, { toast, sfx } = {}) {
  const el = document.createElement('div');
  el.className = 'share-ov';
  el.innerHTML = '<div class="share-box"><p class="share-wait">Lagi bikin gambarnya… 🎨</p></div>';
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 20); // bukan rAF: pas game dijeda, rAF ditahan
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-share-x]')) close(); });
  let blob;
  try { blob = await makeCard(o); } catch { blob = null; }
  if (!blob) { el.querySelector('.share-box').innerHTML = '<p>Gambarnya gagal dibikin 🥺 coba lagi ya</p><button class="btn" data-share-x>Tutup</button>'; return; }
  const url = URL.createObjectURL(blob), name = `lovequest-${Date.now()}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  el.querySelector('.share-box').innerHTML = `
    <img class="share-img" src="${url}" alt="Kartu hasil">
    <div class="share-act">
      ${canShare ? '<button class="btn" data-share-go>📤 Bagikan</button>' : ''}
      <a class="btn ${canShare ? 'ghost' : ''}" href="${url}" download="${esc(name)}" data-share-save>💾 Simpan</a>
      <button class="link-btn" data-share-x>tutup</button>
    </div>
    <small class="share-tip">${canShare ? 'Pamerin ke story & tag pasanganmu 😆' : 'Kalau tombol simpan nggak jalan, tekan lama gambarnya terus pilih Simpan'}</small>`;
  el.querySelector('[data-share-go]')?.addEventListener('click', async () => {
    sfx?.('click');
    try { await navigator.share({ files: [file], text: o.shareText || '' }); } catch {}
  });
  el.querySelector('[data-share-save]')?.addEventListener('click', () => { sfx?.('click'); toast?.('Gambarnya disimpen 📸'); });
}
