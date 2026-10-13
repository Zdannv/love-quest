// Kuis Sayang: pertanyaan manis di akhir tiap dunia.
import { esc } from '../util.js';

export function startQuiz(stage, p, api) {
  const qs = p.questions;
  let i = 0, correct = 0, locked = false, done = false;
  const marks = [];
  const timers = [];

  const box = document.createElement('div');
  box.className = 'quiz';
  stage.appendChild(box);

  function stats() {
    api.setStats(`❓ ${Math.min(i + 1, qs.length)}/${qs.length} · 💖 ${correct}`);
  }

  function render() {
    const q = qs[i];
    locked = false;
    stats();
    box.innerHTML = `
      <div class="quiz-dots">${qs.map((_, k) => `<i class="${k < i ? (marks[k] ? 'ok' : 'no') : k === i ? 'now' : ''}"></i>`).join('')}</div>
      <div class="quiz-card">
        <div class="quiz-badge">💌</div>
        <div class="quiz-num">Pertanyaan ${i + 1} dari ${qs.length}</div>
        <div class="quiz-q">${esc(q.q)}</div>
        <div class="quiz-opts">
          ${q.options.map((o, k) => `<button class="opt" data-k="${k}" style="--i:${k}"><span class="opt-l">${'ABCDEF'[k]}</span><span class="opt-t">${esc(o)}</span><span class="opt-m"></span></button>`).join('')}
        </div>
        <div class="quiz-fb" aria-live="polite"></div>
      </div>`;
    box.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.k, b)));
  }

  function answer(k, btn) {
    if (locked || done) return;
    locked = true;
    const q = qs[i];
    const ok = q.answer === -1 || q.answer === k;
    const fb = box.querySelector('.quiz-fb');
    marks[i] = ok;
    box.querySelector('.quiz-dots .now')?.classList.add(ok ? 'ok' : 'no');
    box.querySelector('.quiz-badge').textContent = ok ? '🥰' : '🙈';
    if (ok) {
      correct++;
      btn.classList.add('right');
      api.sfx('good');
      fb.textContent = q.yes || 'Benar! 💖';
    } else {
      btn.classList.add('wrong');
      box.querySelectorAll('.opt')[q.answer]?.classList.add('right');
      api.sfx('bad');
      fb.textContent = q.no || 'Hmm kurang tepat, tapi tetep sayang 😚';
    }
    fb.classList.add(ok ? 'ok' : 'nope');
    box.querySelectorAll('.opt').forEach((b) => (b.disabled = true));
    stats();
    timers.push(setTimeout(() => {
      i++;
      if (i < qs.length) render();
      else finish();
    }, 1900));
  }

  function finish() {
    done = true;
    const n = qs.length;
    const win = correct >= Math.ceil(n * 0.6);
    const stars = !win ? 0 : correct === n ? 3 : correct === n - 1 ? 2 : 1;
    api.finish({ win, stars, detail: `Benar ${correct} dari ${n}` });
  }

  render();
  return { destroy() { done = true; timers.forEach(clearTimeout); } };
}
