// Tema warna & karakter hewan (fitur paket Premium). Dipakai game, demo, dan CMS.

export const THEMES = {
  pink: {
    name: 'Pink Manis', swatch: '#ff7eb0',
    vars: { '--pink': '#ff7eb0', '--pink-deep': '#e8558f', '--pink-soft': '#ffd6e7', '--accent-light': '#ff9cc4', '--accent-shadow': '#f3c3d8', '--accent2': '#9a6bff', '--ink': '#6a2c52', '--ink-soft': '#a0678a', '--bg1': '#ffe4ef', '--bg2': '#ffeef6', '--bg3': '#efe6ff' },
  },
  lavender: {
    name: 'Lavender', swatch: '#9a7bff',
    vars: { '--pink': '#9a7bff', '--pink-deep': '#7153e0', '--pink-soft': '#e3dbff', '--accent-light': '#b7a2ff', '--accent-shadow': '#d2c6f7', '--accent2': '#ff7eb0', '--ink': '#46307a', '--ink-soft': '#7d6aa8', '--bg1': '#efe9ff', '--bg2': '#f6f1ff', '--bg3': '#ffe9f4' },
  },
  mint: {
    name: 'Mint Segar', swatch: '#3cc4a0',
    vars: { '--pink': '#3cc4a0', '--pink-deep': '#1f9e7d', '--pink-soft': '#cdf3e6', '--accent-light': '#6fd9bb', '--accent-shadow': '#b9e6d6', '--accent2': '#5b8def', '--ink': '#1f4d43', '--ink-soft': '#5b8a7e', '--bg1': '#e3faf1', '--bg2': '#f1fcf8', '--bg3': '#e6f0ff' },
  },
  peach: {
    name: 'Peach Sunset', swatch: '#ff8a5c',
    vars: { '--pink': '#ff8a5c', '--pink-deep': '#e8653a', '--pink-soft': '#ffe0d1', '--accent-light': '#ffa985', '--accent-shadow': '#f5cdb8', '--accent2': '#e0559b', '--ink': '#6b3526', '--ink-soft': '#a0705f', '--bg1': '#fff0e6', '--bg2': '#fff6ef', '--bg3': '#ffe6ef' },
  },
  sky: {
    name: 'Biru Langit', swatch: '#4aa8f0',
    vars: { '--pink': '#4aa8f0', '--pink-deep': '#2b86cf', '--pink-soft': '#d4ebfc', '--accent-light': '#7cc0f5', '--accent-shadow': '#c0dcf2', '--accent2': '#ff7eb0', '--ink': '#1f3f5c', '--ink-soft': '#5f7f9c', '--bg1': '#e6f4ff', '--bg2': '#f2f9ff', '--bg3': '#fff0f6' },
  },
  cherry: {
    name: 'Merah Ceri', swatch: '#f0506e',
    vars: { '--pink': '#f0506e', '--pink-deep': '#c93352', '--pink-soft': '#ffd8df', '--accent-light': '#f57b92', '--accent-shadow': '#f2bec8', '--accent2': '#ff9f43', '--ink': '#5e1f2c', '--ink-soft': '#9a5f6b', '--bg1': '#ffe8ec', '--bg2': '#fff3f5', '--bg3': '#fff1e3' },
  },
};

export const CHARACTERS = {
  owl: { emoji: '🦉', name: 'Burung hantu', sound: 'Hoot' },
  cat: { emoji: '🐱', name: 'Kucing', sound: 'Meow' },
  dog: { emoji: '🐶', name: 'Anjing', sound: 'Guk guk' },
  rabbit: { emoji: '🐰', name: 'Kelinci', sound: 'Hop hop' },
  bear: { emoji: '🐻', name: 'Beruang', sound: 'Hehe' },
  panda: { emoji: '🐼', name: 'Panda', sound: 'Nyam' },
  penguin: { emoji: '🐧', name: 'Penguin', sound: 'Wek wek' },
  fox: { emoji: '🦊', name: 'Rubah', sound: 'Yip' },
  hamster: { emoji: '🐹', name: 'Hamster', sound: 'Cit cit' },
  frog: { emoji: '🐸', name: 'Katak', sound: 'Krok' },
  unicorn: { emoji: '🦄', name: 'Unicorn', sound: 'Yay' },
  koala: { emoji: '🐨', name: 'Koala', sound: 'Hmm' },
  chick: { emoji: '🐥', name: 'Anak ayam', sound: 'Ciap' },
  tiger: { emoji: '🐯', name: 'Harimau', sound: 'Rawr' },
};

export const DEFAULT_THEME = 'pink';
export const DEFAULT_CHARACTERS = { pasangan: 'owl', pengirim: 'cat' };

export function applyTheme(id) {
  const theme = THEMES[id] || THEMES[DEFAULT_THEME];
  for (const [k, v] of Object.entries(theme.vars)) document.documentElement.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.vars['--pink-soft']);
}

export const charOf = (id, fallback) => CHARACTERS[id] || CHARACTERS[fallback];
