// Tap si Imut: owl & kucing muncul dari lubang, tap secepatnya. Jangan tap lebah!
import { rand, pick, starsFor, floatText, shake } from '../util.js';

export function startPop(stage, p, api) {
  const grid = document.createElement('div');
  grid.className = 'pop-grid';
  grid.style.setProperty('--cols', p.cols);
  grid.style.setProperty('--ratio', p.rows / p.cols);

  const holes = [];
  for (let i = 0; i < p.cols * p.rows; i++) {
    const el = document.createElement('div');
    el.className = 'hole';
    const btn = document.createElement('button');
    btn.className = 'critter';
    btn.setAttribute('aria-label', 'Lubang');
    el.appendChild(btn);
    grid.appendChild(el);
    const hole = { el, btn, active: false, kind: null, timer: 0 };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(hole); });
    holes.push(hole);
  }
  stage.appendChild(grid);

  let score = 0, done = false, spawnTimer = 0;
  const t0 = performance.now();

  function elapsed() { return (performance.now() - t0) / 1000; }

  function show() {
    const free = holes.filter((h) => !h.active);
    if (!free.length) return;
    const h = pick(free);
    const r = Math.random();
    h.kind = r < p.badRate ? 'bad' : r < p.badRate + 0.07 ? 'gold' : 'good';
    h.btn.textContent = h.kind === 'bad' ? pick(p.bad) : h.kind === 'gold' ? p.gold : pick(p.good);
    h.active = true;
    h.el.classList.remove('hit', 'ouch');
    h.el.classList.add('up');
    api.sfx('pop');
    const speedUp = 1 - 0.25 * Math.min(1, elapsed() / p.time);
    h.timer = setTimeout(() => {
      if (h.active && h.kind !== 'bad' && !done) api.streak(false);
      hide(h);
    }, p.stay * rand(0.85, 1.15) * speedUp);
  }

  function hide(h) {
    h.active = false;
    clearTimeout(h.timer);
    h.el.classList.remove('up');
  }

  function hit(h) {
    if (done || !h.active) return;
    if (h.kind === 'bad') {
      score = Math.max(0, score - 2);
      h.el.classList.add('ouch');
      api.sfx('bad');
      floatText(h.el, '-2', 'bad');
      shake(stage);
      api.streak(false);
      api.say(pick(['Aww disengat lebah 🐝😭', 'Eh itu lebah {pasangan}! 😵', 'Lebahnya jangan dipencet 🥺']), 'sad');
    } else {
      let pts = h.kind === 'gold' ? 3 : 1;
      const combo = api.streak(true);
      if (combo && combo % 5 === 0) pts += 2;
      score += pts;
      h.el.classList.add('hit');
      api.sfx(h.kind === 'gold' ? 'gold' : 'good');
      floatText(h.el, `+${pts}`, h.kind === 'gold' || pts > 3 ? 'gold' : '');
    }
    hide(h);
    stats();
  }

  function scheduleSpawn() {
    if (done) return;
    show();
    if (Math.random() < p.multi) show();
    const speedUp = 1 - 0.3 * Math.min(1, elapsed() / p.time);
    spawnTimer = setTimeout(scheduleSpawn, p.interval * rand(0.7, 1.15) * speedUp);
  }
  spawnTimer = setTimeout(scheduleSpawn, 300);

  function stats() {
    const left = Math.max(0, Math.ceil(p.time - elapsed()));
    api.setStats(`⏱ ${left}s · ⭐ ${score}/${p.target}`);
  }

  let warned = false;
  const iv = setInterval(() => {
    stats();
    if (!warned && p.time - elapsed() <= 10) { warned = true; api.say('10 detik lagi! Gaspol {pasangan}! ⏰', 'happy'); }
    if (elapsed() >= p.time) end();
  }, 150);

  function end() {
    if (done) return;
    done = true;
    clearInterval(iv);
    clearTimeout(spawnTimer);
    holes.forEach(hide);
    const win = score >= p.target;
    api.finish({
      win,
      stars: win ? Math.max(1, starsFor(score, p.target)) : 0,
      detail: win ? `Skor ${score} ⭐` : `Skor ${score}, butuh ${p.target}`,
    });
  }

  stats();
  return {
    destroy() {
      done = true;
      clearInterval(iv);
      clearTimeout(spawnTimer);
      holes.forEach((h) => clearTimeout(h.timer));
    },
  };
}
