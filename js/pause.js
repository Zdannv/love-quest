// Jeda global buat semua game: selama dijeda, loop animasi (requestAnimationFrame) & timer game (setInterval) ditahan,
// lalu dilepas lagi pas lanjut. Jadi tiap game otomatis bisa di-pause tanpa harus diubah satu-satu.
let paused = false, seq = 0;
const held = new Map();
const rAF = window.requestAnimationFrame.bind(window), cAF = window.cancelAnimationFrame.bind(window);
const sI = window.setInterval.bind(window);
window.requestAnimationFrame = (cb) => { if (!paused) return rAF(cb); const id = -(++seq); held.set(id, cb); return id; };
window.cancelAnimationFrame = (id) => (id < 0 ? held.delete(id) : cAF(id));
window.setInterval = (fn, ms, ...args) => sI(() => { if (!paused) (typeof fn === 'function' ? fn(...args) : null); }, ms);
export const isPaused = () => paused;
export function setPaused(v) {
  if (paused === v) return;
  paused = v;
  if (!v) { const list = [...held.values()]; held.clear(); list.forEach((cb) => rAF(cb)); }
}
