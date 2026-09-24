// Nama & foto yang diisi pengunjung demo. Semua cuma disimpan di browser ini.
import { CONFIG } from './config.js';
import { THEMES, CHARACTERS, DEFAULT_THEME, DEFAULT_CHARACTERS, charOf } from './themes.js';

const NAMES_KEY = 'lq-demo-names';
const PHOTO_KEY = 'lq-demo-photo';
const LOOK_KEY = 'lq-demo-look';

export function getNames() {
  const d = CONFIG.defaultNames;
  if (!CONFIG.demo) {
    const n = CONFIG.names || {};
    return { pasangan: n.pasangan?.trim() || d.pasangan, pengirim: n.pengirim?.trim() || d.pengirim, raw: n };
  }
  try {
    const v = JSON.parse(localStorage.getItem(NAMES_KEY)) || {};
    return { pasangan: v.pasangan?.trim() || d.pasangan, pengirim: v.pengirim?.trim() || d.pengirim, raw: v };
  } catch {
    return { ...d, raw: {} };
  }
}

export function setNames(pasangan, pengirim) {
  try { localStorage.setItem(NAMES_KEY, JSON.stringify({ pasangan, pengirim })); } catch {}
}

// Tema & karakter: demo disimpan di browser, game pasangan dari CMS
export function getLook() {
  let look = {};
  if (CONFIG.demo) {
    try { look = JSON.parse(localStorage.getItem(LOOK_KEY)) || {}; } catch {}
  } else {
    look = { theme: CONFIG.theme, characters: CONFIG.characters };
  }
  return {
    theme: THEMES[look.theme] ? look.theme : DEFAULT_THEME,
    characters: {
      pasangan: CHARACTERS[look.characters?.pasangan] ? look.characters.pasangan : DEFAULT_CHARACTERS.pasangan,
      pengirim: CHARACTERS[look.characters?.pengirim] ? look.characters.pengirim : DEFAULT_CHARACTERS.pengirim,
    },
  };
}
export function setLook(look) {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch {}
}
export function getChars() {
  const { characters } = getLook();
  return {
    pasangan: charOf(characters.pasangan, DEFAULT_CHARACTERS.pasangan),
    pengirim: charOf(characters.pengirim, DEFAULT_CHARACTERS.pengirim),
  };
}

// Ganti {pasangan}, {pengirim} (nama), {karakter}, {karakter2} (emoji hewan), {suara} (suara hewan pemandu)
export function fill(text) {
  if (typeof text !== 'string') return text;
  const n = getNames();
  const c = getChars();
  return text
    .replaceAll('{pasangan}', n.pasangan).replaceAll('{pengirim}', n.pengirim)
    .replaceAll('{karakter2}', c.pengirim.emoji).replaceAll('{karakter}', c.pasangan.emoji)
    .replaceAll('{suara}', c.pasangan.sound);
}

export function getPhoto() {
  if (!CONFIG.demo) return null;
  try { return localStorage.getItem(PHOTO_KEY); } catch { return null; }
}

// Kecilkan foto dulu supaya muat disimpan di browser
function shrinkImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function savePhoto(file) {
  return shrinkImage(file, 700).then((data) => {
    localStorage.setItem(PHOTO_KEY, data);
    return data;
  });
}

export function clearPhoto() {
  try { localStorage.removeItem(PHOTO_KEY); } catch {}
}

// Foto muka buat game (demo: disimpan di browser; game pasangan: dari CMS)
const FACE_KEY = (who) => `lq-demo-face-${who}`;
export function getFace(who) {
  if (!CONFIG.demo) return CONFIG.photos?.faces?.[who] || null;
  try { return localStorage.getItem(FACE_KEY(who)); } catch { return null; }
}
export function saveFace(who, file) {
  return shrinkImage(file, 400).then((data) => {
    localStorage.setItem(FACE_KEY(who), data);
    return data;
  });
}
export function clearFace(who) {
  try { localStorage.removeItem(FACE_KEY(who)); } catch {}
}
