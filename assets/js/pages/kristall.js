// Служебная страница kristall.html: Саша сама подбирает кристалл. Ползунки меняют параметры gem.js,
// настройки живут в адресе (?k=…), кнопка копирует ссылку с ними. Камень крутится мышью и пальцем.
import { createGem, PRESETS, toK, fromK } from '../gem.js';

const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = () => innerWidth <= 700;

// [параметр, подпись, мин, макс, шаг, подписи краёв]
const SLIDERS = [
  ['hw', 'Высота к ширине', 0.5, 2.2, 0.01, ['плоский', 'вытянутый']],
  ['crown', 'Корона', 0.04, 0.4, 0.01, ['низкая', 'высокая']],
  ['pav', 'Павильон', 0.3, 0.9, 0.01, ['короткий', 'глубокий']],
  ['n', 'Граней по кругу', 5, 12, 1, ['5', '12']],
  ['frost', 'Матовость', 0, 1, 0.01, ['прозрачный', 'матовый']],
  ['tone', 'Оттенок', 0, 1, 0.01, ['серый', 'зелёный']],
  ['sat', 'Насыщенность', 0, 1, 0.01, ['бесцветный', 'густой']],
  ['gloss', 'Блеск и искры', 0, 1, 0.01, ['спокойно', 'как в круге 4']],
  ['speed', 'Вращение', 0, 1, 0.01, ['стоит', 'быстро']],
];
const fmt = (k, v) => k === 'n' ? String(v) : k === 'hw' ? v.toFixed(2).replace('.', ',') : Math.round(v * 100) + ' %';

const q = new URLSearchParams(location.search);
let P = fromK(q.get('k')) || { ...PRESETS.mid };
if (reduced && !q.get('k')) P.speed = 0;

const canvas = $('#gem');
let gem = null;
try { gem = createGem(canvas, { mobile: phone(), params: P }); } catch (e) { console.warn('ГРАНИ: кристалл не запустился', e); }
if (!gem) { canvas.hidden = true; $('#nogl').hidden = false; } else P = gem.params;

/* ---------- панель ---------- */
const box = $('#sliders'), inputs = {};
for (const [k, label, min, max, step, [l0, l1]] of SLIDERS) {
  const id = 'sl-' + k;
  const el = document.createElement('div');
  el.className = 'kr__sl';
  el.innerHTML = `<label class="kr__sl-h" for="${id}"><span>${label}</span><output></output></label>` +
    `<input id="${id}" type="range" min="${min}" max="${max}" step="${step}">` +
    `<div class="kr__sl-ends" aria-hidden="true"><span>${l0}</span><span>${l1}</span></div>`;
  box.appendChild(el);
  const inp = el.querySelector('input'), out = el.querySelector('output');
  inp.addEventListener('input', () => set({ [k]: +inp.value }));
  inputs[k] = { inp, out };
}
const segs = (sel, onPick) => {
  const btns = [...document.querySelectorAll(sel + ' button')];
  btns.forEach((b) => b.addEventListener('click', () => onPick(b)));
  return (val) => btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(val))));
};
const showCut = segs('#cut', (b) => set({ cut: +b.dataset.v }));
const showHour = segs('#hour', (b) => { showHour(b.dataset.v); if (gem) gem.target.hour = +b.dataset.v; });
const presetBtns = [...document.querySelectorAll('#presets button')];
presetBtns.forEach((b) => b.addEventListener('click', () => set({ ...PRESETS[b.dataset.p] })));

let urlTimer = 0;
function render() {
  for (const k in inputs) { inputs[k].inp.value = P[k]; inputs[k].out.textContent = fmt(k, P[k]); }
  showCut(P.cut);
  const k = toK(P);
  presetBtns.forEach((b) => b.setAttribute('aria-pressed', String(toK(PRESETS[b.dataset.p]) === k)));
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => history.replaceState(null, '', '?k=' + k), 250);
}
function set(p) {
  if (gem) { gem.set(p); P = gem.params; } else P = { ...P, ...p };
  $('#done').textContent = ''; $('#out').hidden = true;
  render(); place();
}
render();

/* ---------- копирование ---------- */
$('#copy').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '?k=' + toK(P);
  const out = $('#out'), done = $('#done');
  try {
    await navigator.clipboard.writeText(url);
    done.textContent = 'Скопировано. Строка: k=' + toK(P);
  } catch (e) { // буфер закрыт (старый браузер, не https): строку выделяют руками
    out.value = url; out.hidden = false; out.focus(); out.select();
    done.textContent = 'Выделите строку и скопируйте';
  }
});

/* ---------- панель на телефоне ---------- */
const panel = $('#panel'), handle = $('#handle');
handle.addEventListener('click', () => {
  const open = panel.dataset.open !== 'true';
  panel.dataset.open = String(open); handle.setAttribute('aria-expanded', String(open));
  place();
});

/* ---------- где стоит камень: по центру свободной части экрана ---------- */
const HALF_H = Math.tan(Math.PI / 12) * 9; // половина высоты кадра в единицах сцены (как в gem.js)
function place() {
  if (!gem) return;
  const T = gem.target, W = innerWidth, H = innerHeight, top = phone() ? 56 : 64;
  let freeW = W, freeH = H - top, dx = 0, dy = -top / 2;
  if (phone()) {
    const ph = panel.dataset.open === 'true' ? panel.offsetHeight : 52;
    freeH -= ph; dy = (ph - top) / 2;
  } else { freeW -= panel.offsetWidth; dx = -panel.offsetWidth / 2; }
  const pxPerUnit = H / (2 * HALF_H), stone = 2.3; // больший размер камня в единицах сцены
  T.s = Math.min(freeH * 0.66, freeW * 0.7) / (stone * pxPerUnit);
  T.x = dx / (W / 2); T.y = dy / (H / 2);
}
addEventListener('resize', place);
place();

/* ---------- вращение мышью и пальцем ---------- */
if (gem) {
  const T = gem.target;
  T.tilt = 0.9; T.hour = 1;
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    T.rot += (e.clientX - drag.x) * 0.012;
    T.tilt = Math.min(2, Math.max(-0.6, T.tilt + (e.clientY - drag.y) * 0.006));
    drag = { x: e.clientX, y: e.clientY };
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  gem.start();
}
