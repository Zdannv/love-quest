import { drawEmoji } from './util.js';

const canvas = document.getElementById('confetti');
const ctx = canvas.getContext('2d');
const COLORS = ['#ff8fb8', '#ffd166', '#b8a1ff', '#7fdcc0', '#ff6f91'];
const HEARTS = ['💖', '💕', '💗', '✨', '🌸'];
let parts = [];
let raf = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function confetti(amount = 90) {
  resize();
  for (let i = 0; i < amount; i++) {
    const heart = Math.random() < 0.35;
    parts.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 900,
      vy: -300 - Math.random() * 700,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 12,
      size: heart ? 18 + Math.random() * 14 : 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      emoji: heart ? HEARTS[i % HEARTS.length] : null,
      life: 2.6 + Math.random(),
    });
  }
  if (!raf) {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 900 * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.emoji) {
          drawEmoji(ctx, p.emoji, 0, 0, p.size);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
      parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 50);
      if (parts.length) raf = requestAnimationFrame(loop);
      else { raf = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    };
    raf = requestAnimationFrame(loop);
  }
}
