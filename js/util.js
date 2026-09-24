export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 1 bintang = capai target, 2 = 125%, 3 = 150%
export function starsFor(score, target) {
  if (score >= Math.ceil(target * 1.5)) return 3;
  if (score >= Math.ceil(target * 1.25)) return 2;
  return score >= target ? 1 : 0;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function floatText(parent, text, cls = '') {
  const el = document.createElement('span');
  el.className = `float-text ${cls}`;
  el.textContent = text;
  parent.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const imageCache = new Map();
export function loadImage(src) {
  if (!src) return null;
  if (!imageCache.has(src)) {
    const img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return imageCache.get(src);
}

// ---------- Gambar emoji & muka yang sudah "dicetak" sekali ----------
// Menggambar emoji pakai fillText tiap frame itu berat di HP (bikin patah-patah),
// jadi tiap emoji/muka dicetak sekali ke canvas kecil, lalu tinggal ditempel (drawImage).
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
const sprites = new Map();

function emojiSprite(emoji, size) {
  const px = Math.max(8, Math.round(size));
  const key = `e|${emoji}|${px}`;
  let c = sprites.get(key);
  if (!c) {
    const box = Math.ceil(px * 1.3);
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(box * DPR());
    const x = c.getContext('2d');
    x.scale(DPR(), DPR());
    x.font = `${px}px ${EMOJI_FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(emoji, box / 2, box / 2 + px * 0.05);
    c.box = box;
    sprites.set(key, c);
  }
  return c;
}

// Tempel emoji dengan titik tengah di (x, y)
export function drawEmoji(ctx, emoji, x, y, size) {
  const s = emojiSprite(emoji, size);
  ctx.drawImage(s, x - s.box / 2, y - s.box / 2, s.box, s.box);
}

// Muka bulat (foto) dengan bingkai. Kalau fotonya belum siap, pakai emoji cadangan.
export function drawFace(ctx, img, x, y, r, fallbackEmoji = '💖', ring = '#fff') {
  if (!(img && img.complete && img.naturalWidth)) {
    drawEmoji(ctx, fallbackEmoji, x, y, r * 2);
    return;
  }
  const rr = Math.max(4, Math.round(r));
  const key = `f|${img.src}|${rr}|${ring}`;
  let c = sprites.get(key);
  if (!c) {
    const box = rr * 2 + 8;
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(box * DPR());
    const g = c.getContext('2d');
    g.scale(DPR(), DPR());
    const m = box / 2;
    g.fillStyle = ring;
    g.beginPath();
    g.arc(m, m, rr + 3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(m, m, rr, 0, Math.PI * 2);
    g.clip();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, m - rr, m - rr, rr * 2, rr * 2);
    c.box = box;
    sprites.set(key, c);
  }
  const scale = r / rr;
  const b = c.box * scale;
  ctx.drawImage(c, x - b / 2, y - b / 2, b, b);
}

// Siapkan canvas seukuran stage (tajam di layar HP)
export function setupCanvas(stage) {
  const canvas = document.createElement('canvas');
  canvas.className = 'catch-canvas';
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const size = { W: 0, H: 0, k: 1 };
  const resize = () => {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.W = r.width;
    size.H = r.height;
    canvas.width = Math.round(size.W * dpr);
    canvas.height = Math.round(size.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size.k = Math.min(1.25, Math.max(0.8, size.H / 650));
  };
  resize();
  window.addEventListener('resize', resize);
  return { canvas, ctx, size, dispose: () => window.removeEventListener('resize', resize) };
}
