// Game dimuat pas mau dimainin aja (bukan semua di awal), biar buka aplikasi pertama kali jauh lebih cepet.
// prefetchGame() dipanggil pas level dibuka (selama kartu Cara Main / hitung mundur), jadi pas mulai biasanya udah siap.
const MODS = {
  memory: 'startMemory', catch: 'startCatch', pop: 'startPop', quiz: 'startQuiz', puzzle: 'startPuzzle', odd: 'startOdd',
  simon: 'startSimon', fly: 'startFly', stack: 'startStack', runner: 'startRunner', throw: 'startThrow', maze: 'startMaze',
  timing: 'startTiming', race: 'startRace', fight: 'startFight', penalty: 'startPenalty', pillow: 'startPillow',
  sumo: 'startSumo', math: 'startMath', balloon: 'startBalloon', cook: 'startCook', bomb: 'startBomb',
};
const cache = {};
export function prefetchGame(type) {
  if (!MODS[type]) return null;
  return (cache[type] ||= import(`./games/${type}.js`).then((m) => m[MODS[type]]).catch((e) => { delete cache[type]; throw e; }));
}

// Dipanggil kayak startX biasa (langsung balikin objek game); game aslinya nyusul begitu modulnya kemuat.
export function lazyStart(type) {
  return (stage, p, api) => {
    let game = null, dead = false;
    const wait = document.createElement('div');
    wait.className = 'game-loading';
    wait.innerHTML = '<span class="gl-spin"></span><small>Nyiapin game…</small>';
    const show = setTimeout(() => !game && !dead && stage.appendChild(wait), 150); // muncul cuma kalau beneran nunggu
    const go = () => prefetchGame(type).then((start) => {
      clearTimeout(show); wait.remove();
      if (!dead) game = start(stage, p, api);
    }).catch(() => {
      if (dead) return;
      clearTimeout(show); stage.appendChild(wait);
      wait.innerHTML = '<small>Gamenya gagal kemuat 🥺 cek internet ya</small><button class="btn" type="button">Coba lagi</button>';
      wait.querySelector('button').onclick = () => { wait.innerHTML = '<span class="gl-spin"></span><small>Nyiapin game…</small>'; go(); };
    });
    go();
    return { destroy() { dead = true; clearTimeout(show); wait.remove(); game?.destroy?.(); } };
  };
}
