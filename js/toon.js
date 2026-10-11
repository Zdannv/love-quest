// Karakter kartun (Kenney Toon Characters, lisensi CC0: img/toon/LICENSE.txt) yang kepalanya ditutup foto muka.
// Pakai pose jadi (gambar 192×256, hadap kanan). Titik tengah kepala tiap pose dicari otomatis
// (dicocokin sama gambar kepala aslinya), jadi muka selalu pas di tempat kepala.
// set: 'f' (cewek, baju biru) atau 'm' (cowok, baju hijau).
import { loadImage, drawFace } from './util.js';

const HEAD = {"f": {"idle": [98, 122], "walk0": [100, 120], "walk1": [100, 128], "walk2": [100, 124], "walk3": [98, 120], "walk4": [100, 124], "walk5": [100, 128], "walk6": [100, 124], "walk7": [100, 120], "attack0": [94, 124], "attack1": [88, 120], "attackKick": [86, 132], "kick": [84, 112], "duck": [96, 154], "hurt": [100, 120], "shove": [106, 124], "cheer0": [94, 126], "cheer1": [94, 110], "slide": [70, 174], "jump": [94, 114]}, "m": {"idle": [100, 106], "walk0": [100, 102], "walk1": [104, 110], "walk2": [100, 106], "walk3": [100, 102], "walk4": [100, 106], "walk5": [104, 110], "walk6": [100, 106], "walk7": [100, 102], "attack0": [96, 108], "attack1": [90, 102], "attackKick": [86, 114], "kick": [84, 96], "duck": [98, 138], "hurt": [104, 108], "shove": [110, 106], "cheer0": [96, 108], "cheer1": [96, 92], "slide": [62, 158], "jump": [94, 96]}};
const W0 = 192, H0 = 256, R_HEAD = 58;
const img = (set, pose) => loadImage(`/img/toon/${set}/pose/${pose}.webp`);
export const POSES = Object.keys(HEAD.f);
export const toonLoad = (...sets) => sets.forEach((s) => POSES.forEach((p) => img(s, p)));

// (x, y) = titik tengah kaki di tanah, h = tinggi gambar pose di layar, dir 1 = hadap kanan, -1 = kiri
export function drawToon(ctx, set, pose, x, y, h, dir, face, emoji, ring, rot = 0) {
  const im = img(set, pose), hd = HEAD[set][pose] || HEAD[set].idle, s = h / H0;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(dir, 1);
  if (im.complete && im.naturalWidth) ctx.drawImage(im, -W0 * s / 2, -h, W0 * s, h);
  ctx.translate((hd[0] - W0 / 2) * s, (hd[1] - H0) * s);
  ctx.scale(dir, 1); // muka jangan ikut kebalik
  drawFace(ctx, face, 0, 0, R_HEAD * s, emoji, ring);
  ctx.restore();
}
