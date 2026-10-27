// Лист 06, Клуб. Экран 1: гостиная клуба с выносками (только то, что видно на кадре: камин,
// библиотека, длинный стол). Экран 2: фрагмент генплана вокруг клуба (общий компонент villy-genplan.js) и слой
// клуба поверх: периметр, камеры с узким сектором наружу, номера пяти услуг; наведение связывает.
import { ScrollTrigger, reduced, ready, $, $$ } from '../site.js';
import { placeLeaders } from './kadr.js';

/* ---------- экран 1 ---------- */
const photo = $('#clubPhoto'), leaders = $$('.kl-ld');
const placeAll = () => { if (photo) placeLeaders(photo, leaders); };
placeAll();
addEventListener('resize', placeAll);
if (photo) $('img', photo).addEventListener('load', placeAll);
if (reduced) leaders.forEach((l) => l.classList.add('is-on'));
else ScrollTrigger.create({ trigger: photo, start: 'top 70%', once: true,
  onEnter: () => ready.then(() => leaders.forEach((l, i) => setTimeout(() => l.classList.add('is-on'), 300 + i * 220))) });

/* ---------- экран 2: клуб на плане ---------- */
const NS = 'http://www.w3.org/2000/svg', R = Math.PI / 180;
const add = (p, tag, a = {}, txt) => { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); if (txt != null) n.textContent = txt; p.appendChild(n); return n; };
const f1 = (v) => (Math.round(v * 10) / 10).toString();
// всё в метрах генплана (север вверх, x на восток, y на юг); клуб, причал, сауна и въезд там же,
// где их рисует villy-genplan.js: клуб [214, 470], сауна [176, 516], причал до [124, 404], въезд [552, 524]
const PERIM = [[112, 632], [260, 612], [400, 590], [552, 530], [680, 566], [800, 610]];
const CAMS = [[552, 534, 165], [330, 604, 190], [460, 576, 198], [690, 570, 160], [124, 404, 300], [150, 560, 250]];
const NUMS = { 1: [150, 412], 2: [242, 450], 3: [246, 490], 4: [198, 534], 5: [574, 506] };
const svg = $('#kSvg'), items = $$('#svc li');
const phone = matchMedia('(max-width: 760px)').matches;
let layer = null, groups = {}, sec = null;

function drawLayer(pxPerM) {
  if (!layer) return;
  const u = 1 / pxPerM;
  layer.textContent = '';
  sec = add(layer, 'g', { class: 'kc-sec' });
  add(sec, 'path', { class: 'kc-per', d: 'M' + PERIM.map((p) => p.join(' ')).join('L') });
  CAMS.forEach(([x, y, az]) => {
    const L = 54 * u * (phone ? 0.8 : 1), half = 16, p = (a) => [x + L * Math.sin(a * R), y - L * Math.cos(a * R)];
    const [x1, y1] = p(az - half), [x2, y2] = p(az + half);
    add(sec, 'path', { class: 'kc-cone', d: `M${x} ${y}L${f1(x1)} ${f1(y1)}A${f1(L)} ${f1(L)} 0 0 1 ${f1(x2)} ${f1(y2)}Z` });
    add(sec, 'rect', { class: 'kc-cam', x: f1(x - 3.5 * u), y: f1(y - 2.5 * u), width: f1(7 * u), height: f1(5 * u), transform: `rotate(${az} ${x} ${y})` });
  });
  groups = {};
  Object.entries(NUMS).forEach(([n, [x, y]]) => {
    const g = add(layer, 'g', { class: 'kc-g', 'data-n': n });
    add(g, 'circle', { class: 'kc-no', cx: x, cy: y, r: f1(13 * u) });
    add(g, 'text', { class: 'kc-not', x, y }, n);
    g.addEventListener('pointerenter', () => mark(n));
    g.addEventListener('pointerleave', () => mark(null));
    g.addEventListener('click', () => mark(n));
    groups[n] = g;
  });
  if (cur) mark(cur);
}
let cur = null;
function mark(n) {
  cur = n;
  items.forEach((li) => li.classList.toggle('is-on', li.dataset.n === n));
  Object.entries(groups).forEach(([k, g]) => g.classList.toggle('is-on', k === n));
  if (sec) sec.classList.toggle('is-on', n === '5');
}
items.forEach((li) => {
  li.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') mark(li.dataset.n); });
  li.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') mark(null); });
  li.addEventListener('click', () => mark(cur === li.dataset.n ? null : li.dataset.n));
});

// общий компонент генплана грузим отдельно: если он упадёт, список услуг останется
if (svg) import('./villy-genplan.js').then(({ drawGenplan }) => {
  const roi = phone ? [90, 380, 600, 650] : [80, 370, 730, 660];
  const api = drawGenplan(svg, { mode: 'villa', roi, onFit: (a) => drawLayer(a.pxPerM) });
  layer = add(svg, 'g', { class: 'kc-layer' });
  drawLayer(api.pxPerM);
  ScrollTrigger.refresh();
}).catch((e) => console.warn('ГРАНИ: генплан не загрузился', e));
