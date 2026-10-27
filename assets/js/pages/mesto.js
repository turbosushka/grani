// Лист 05, Место. Экран 1: туман v1 со сценой открытия. Экран 2: ситуационный план, длины дорог
// на схеме равны цифрам таблицы (масштаб снят с самой дороги: 58 км), засечки через 10 км,
// наведение на строку подсвечивает маршрут. Экран 3: три стороны воды, азимуты вилл из данных.
// Экран 4: год на мысе, длина дня по формуле солнца за каждый день года.
import { gsap, ScrollTrigger, reduced, touch, phone, $, $$ } from '../site.js';
import { VILLAS, azMain } from '../villas.js';
import { sunTimes, capeDate, capeDay, capeYMD, hm, dur, MONTHS_GEN } from '../sun.js';

const NS = 'http://www.w3.org/2000/svg';
const add = (parent, tag, a = {}, txt) => {
  const n = document.createElementNS(NS, tag);
  for (const k in a) if (a[k] != null) n.setAttribute(k, a[k]);
  if (txt != null) n.textContent = txt;
  parent.appendChild(n); return n;
};
const f1 = (v) => (Math.round(v * 10) / 10).toString();
// сглаженная кривая через точки (Catmull-Rom → кубические Безье)
function spline(P, closed = false) {
  const n = P.length, g = (i) => P[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f1(P[0][0])} ${f1(P[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}

/* ---------- экран 1: туман ---------- */
const mist = $('#mist');
if (mist) {
  let loaded = false;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) {
      if (!loaded) {
        $('#mistMedia').style.backgroundImage = `url(${phone ? mist.dataset.posterM : mist.dataset.poster})`;
        mist.src = phone ? mist.dataset.srcM : mist.dataset.src;
        mist.preload = 'auto'; loaded = true;
      }
      if (!reduced) mist.play().catch(() => {});
    } else if (loaded) mist.pause();
  }), { rootMargin: '200px 0px' });
  io.observe(mist);
  if (!reduced) gsap.to('#mistMedia', { clipPath: 'inset(0% 0vw 0% 0vw)', ease: 'none',
    scrollTrigger: { trigger: '.mist__stage', start: 'top 85%', end: 'top 15%', scrub: true } });
  else $('#mistMedia').style.clipPath = 'none';
}

/* ---------- экран 2: ситуационный план ---------- */
const sit = $('#sitSvg');
if (sit) {
  // вода: озеро на северо-западе, мыс входит в него с юго-востока; к востоку от мыса залив,
  // к западу через плёс другой берег (большой остров), ширина плёса 4 км по линейке плана
  const SHORE = [[-20, 300], [30, 292], [60, 300], [96, 290], [120, 298], [150, 286], [176, 292], [196, 278], [204, 256], [200, 232],
    [208, 210], [220, 190], [214, 170], [222, 150], [238, 132], [256, 126], [270, 134], [278, 150], [290, 168], [288, 190], [300, 206],
    [318, 214], [336, 232], [352, 250], [372, 252], [392, 240], [404, 220], [420, 196], [446, 178], [470, 170], [488, 150], [512, 138],
    [540, 140], [566, 124], [598, 116], [630, 104], [660, 100]];
  add(sit, 'path', { class: 'st-water', d: spline(SHORE) + ' L680 -20 L-20 -20 Z' });
  add(sit, 'path', { class: 'st-shore', d: spline(SHORE) });
  const westIsland = add(sit, 'path', { class: 'st-isl' });
  [[228, 104, 3.5, 2.2], [244, 98, 4.5, 2.6], [216, 92, 3, 2], [258, 108, 2.6, 1.8]].forEach(([x, y, rx, ry]) => add(sit, 'ellipse', { class: 'st-isl', cx: x, cy: y, rx, ry }));
  const ROAD = [[276, 262], [292, 290], [318, 306], [330, 336], [364, 350], [402, 344], [434, 360], [456, 388], [492, 398], [526, 400]];
  // дорога: масштаб плана снимается с неё самой, 58 км
  const road = add(sit, 'path', { class: 'st-road', d: spline(ROAD) });
  const L = road.getTotalLength(), KM = L / 58;
  // другой берег: восточный край острова ровно в 4 км к западу от мыса по линейке плана
  const DY = 200, WX = 206, OX = WX - 4 * KM;
  westIsland.setAttribute('d', spline([[OX - 6, DY - 74], [OX - 2, DY - 50], [OX + 3, DY - 26], [OX, DY], [OX - 6, DY + 22], [OX - 2, DY + 40], [OX - 18, DY + 62], [OX - 40, DY + 58], [OX - 58, DY + 74], [OX - 84, DY + 60], [OX - 92, DY + 30], [OX - 112, DY + 6], [OX - 104, DY - 30], [OX - 118, DY - 62], [OX - 96, DY - 92], [OX - 70, DY - 88], [OX - 52, DY - 116], [OX - 30, DY - 104], [OX - 20, DY - 86]], true));
  add(sit, 'line', { class: 'st-tick', x1: f1(OX), y1: DY, x2: WX, y2: DY, style: 'stroke-width:.8' });
  [OX, WX].forEach((x) => add(sit, 'line', { class: 'st-tick', x1: f1(x - 3), y1: DY + 3, x2: f1(x + 3), y2: DY - 3 }));
  add(sit, 'text', { class: 'st-km', x: f1((OX + WX) / 2), y: DY - 6, 'text-anchor': 'middle' }, '4 км');
  const at = (path, km) => path.getPointAtLength(Math.max(0, Math.min(path.getTotalLength(), km * KM)));
  // ответвление нужной длины: форма задана, длина подгоняется масштабом от начала
  const branch = (P, km, cls) => {
    const p = add(sit, 'path', { class: cls, d: spline(P) });
    const k = (km * KM) / p.getTotalLength(), [x0, y0] = P[0];
    p.setAttribute('d', spline(P.map(([x, y]) => [x0 + (x - x0) * k, y0 + (y - y0) * k])));
    return p;
  };
  const end = ROAD[ROAD.length - 1];
  const air = branch([end, [530, 380], [556, 392], [584, 394]], 74 - 58, 'st-road st-road--side');
  const SK = 10, b0 = at(road, SK);
  const ski = branch([[b0.x, b0.y], [b0.x - 8, b0.y + 26], [b0.x + 2, b0.y + 50], [b0.x - 8, b0.y + 68]], 22 - SK, 'st-road st-road--side');
  // подсветки маршрутов
  const hl = {
    gorod: [add(sit, 'path', { class: 'st-hl', d: road.getAttribute('d') })],
    aeroport: [add(sit, 'path', { class: 'st-hl', d: road.getAttribute('d') }), add(sit, 'path', { class: 'st-hl', d: air.getAttribute('d') })],
    sklon: [add(sit, 'path', { class: 'st-hl', d: road.getAttribute('d'), 'stroke-dasharray': `${f1(SK * KM)} ${f1(L)}` }), add(sit, 'path', { class: 'st-hl', d: ski.getAttribute('d') })],
  };
  // засечки через 10 км с подписями
  for (let km = 10; km < 58; km += 10) {
    const p = at(road, km), q = at(road, km + 0.3), a = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
    const dx = Math.cos(a) * 5, dy = Math.sin(a) * 5;
    add(sit, 'line', { class: 'st-tick', x1: f1(p.x - dx), y1: f1(p.y - dy), x2: f1(p.x + dx), y2: f1(p.y + dy) });
    add(sit, 'text', { class: 'st-km', x: f1(p.x + dx * 2.6), y: f1(p.y + dy * 2.6 + 4), 'text-anchor': dx > 0 ? 'start' : 'end' }, String(km));
  }
  // склон: горизонтали холма у конца ответвления
  const sk = at(ski, 22 - SK);
  [7, 13, 19].forEach((r) => add(sit, 'ellipse', { class: 'st-hill', cx: f1(sk.x + 2), cy: f1(sk.y + 3), rx: r * 1.3, ry: r }));
  add(sit, 'circle', { class: 'st-pt', cx: f1(sk.x), cy: f1(sk.y), r: 3.5 });
  add(sit, 'text', { class: 'st-sub', x: f1(sk.x - 32), y: f1(sk.y + 5), 'text-anchor': 'end' }, 'склон, 22 км');
  // город и аэропорт
  [[0, 0], [9, -6], [6, 7], [-8, 6], [15, 4]].forEach(([dx, dy]) => add(sit, 'rect', { class: 'st-n', x: end[0] + dx - 3, y: end[1] + dy - 3, width: 6, height: 6 }));
  add(sit, 'text', { class: 'st-sub', x: end[0] - 6, y: end[1] + 28, 'text-anchor': 'middle' }, 'город, 58 км');
  const ap = at(air, 16);
  add(sit, 'line', { x1: f1(ap.x - 12), y1: f1(ap.y + 6), x2: f1(ap.x + 12), y2: f1(ap.y - 6), stroke: '#1A1C1E', 'stroke-width': 4 });
  if (phone) add(sit, 'text', { class: 'st-sub', x: f1(ap.x + 16), y: f1(ap.y + 50), 'text-anchor': 'end' }, 'аэропорт, 74 км');
  else add(sit, 'text', { class: 'st-sub', x: f1(ap.x), y: f1(ap.y + 26), 'text-anchor': 'middle' }, 'аэропорт, 74 км');
  add(sit, 'text', { class: 'st-sub', x: 380, y: 330, transform: 'rotate(8 380 330)' }, 'лесная дорога');
  // мыс
  const cape = add(sit, 'circle', { class: 'st-cape', cx: 252, cy: 160, r: 5 });
  add(sit, 'line', { x1: 256, y1: 164, x2: 300, y2: 208, stroke: '#1A1C1E', 'stroke-width': 0.8 });
  add(sit, 'line', { x1: 300, y1: 208, x2: 372, y2: 208, stroke: '#1A1C1E', 'stroke-width': 0.8 });
  add(sit, 'text', { class: 'st-name', x: 304, y: 200 }, 'ГРАНИ');
  add(sit, 'text', { class: 'st-sub', x: 304, y: 224 }, 'мыс Светлый');
  add(sit, 'text', { class: 'st-w', x: 330, y: 70 }, 'озеро');
  add(sit, 'text', { class: 'st-w', x: 384, y: 176 }, 'залив');
  // север и линейка в километрах
  add(sit, 'path', { d: 'M612 18l5 14-5-3.5-5 3.5z', fill: '#1A1C1E' });
  add(sit, 'text', { class: 'st-tech', x: 612, y: 46, 'text-anchor': 'middle' }, 'С');
  const bx = phone ? 104 : 24, by = phone ? 446 : 414;
  [[0, 5, 1], [5, 10, 0], [10, 20, 1]].forEach(([a, b, fill]) => add(sit, 'rect', { class: 'st-bar', x: f1(bx + a * KM), y: by, width: f1((b - a) * KM), height: 4, fill: fill ? '#1A1C1E' : '#FBFAF7' }));
  [[0, '0'], [5, '5'], [10, '10'], [20, '20 км']].forEach(([k, t]) => add(sit, 'text', { class: 'st-km', x: f1(bx + k * KM), y: by - 6, 'text-anchor': k === 0 ? 'start' : 'middle' }, t));

  if (phone) sit.setAttribute('viewBox', '90 60 540 400');
  // маршрут прочерчивается при входе, по нему один раз проходит точка
  if (!reduced) {
    const mask = add(add(sit, 'defs'), 'mask', { id: 'stRoadMask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 640, height: 440 });
    const mp = add(mask, 'path', { d: road.getAttribute('d'), fill: 'none', stroke: '#fff', 'stroke-width': 8, 'stroke-dasharray': f1(L), 'stroke-dashoffset': f1(L) });
    road.setAttribute('mask', 'url(#stRoadMask)');
    const dot = add(sit, 'circle', { class: 'st-dot', r: 4, cx: end[0], cy: end[1], opacity: 0 });
    const o = { t: 0 };
    gsap.timeline({ scrollTrigger: { trigger: sit, start: 'top 75%', once: true } })
      .to(mp, { attr: { 'stroke-dashoffset': 0 }, duration: 1.6, ease: 'power2.inOut' })
      .set(dot, { attr: { opacity: 1 } })
      .to(o, { t: 1, duration: 2.2, ease: 'power1.inOut', onUpdate: () => { const p = road.getPointAtLength(L * (1 - o.t)); dot.setAttribute('cx', f1(p.x)); dot.setAttribute('cy', f1(p.y)); } })
      .to(dot, { attr: { opacity: 0 }, duration: 0.4 });
  }
  // наведение на строку таблицы подсвечивает маршрут; у воды и причала подсвечивается мыс
  const rowsD = $$('#dist > div');
  const show = (r) => {
    rowsD.forEach((d) => d.classList.toggle('is-on', d.dataset.r === r));
    Object.entries(hl).forEach(([k, ps]) => ps.forEach((p) => p.classList.toggle('on', k === r)));
    cape.setAttribute('r', r === 'voda' || r === 'prichal' ? 8 : 5);
  };
  rowsD.forEach((d) => {
    d.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(d.dataset.r); });
    d.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') show(null); });
    d.addEventListener('click', () => show(d.classList.contains('is-on') ? null : d.dataset.r));
  });
}

/* ---------- экран 3: три стороны воды ---------- */
const sides = $('#sidesSvg');
if (sides) {
  const C = 220, RR = 150, R = Math.PI / 180;
  const pt = (az, r) => [C + r * Math.sin(az * R), C - r * Math.cos(az * R)];
  const SIDES = [
    { k: 'Запад', from: 225, to: 315, name: 'открытое озеро', note: 'до другого берега 4 км' },
    { k: 'Север', from: 315, to: 405, name: 'четыре острова' },
    { k: 'Восток', from: 45, to: 135, name: 'залив' },
  ];
  SIDES.forEach((s) => {
    const [x1, y1] = pt(s.from, RR), [x2, y2] = pt(s.to, RR);
    add(sides, 'path', { class: 'sd-sec', d: `M${C} ${C}L${f1(x1)} ${f1(y1)}A${RR} ${RR} 0 0 1 ${f1(x2)} ${f1(y2)}Z` });
  });
  add(sides, 'circle', { class: 'sd-ring2', cx: C, cy: C, r: RR * 0.5 });
  add(sides, 'circle', { class: 'sd-ring', cx: C, cy: C, r: RR });
  for (let a = 0; a < 360; a += 15) { const [x1, y1] = pt(a, RR), [x2, y2] = pt(a, RR - (a % 45 ? 4 : 8)); add(sides, 'line', { class: 'sd-tick', x1: f1(x1), y1: f1(y1), x2: f1(x2), y2: f1(y2) }); }
  [45, 135, 225, 315].forEach((a) => {
    const [x, y] = pt(a, RR);
    add(sides, 'line', { class: 'sd-rad', x1: C, y1: C, x2: f1(x), y2: f1(y) });
    const [tx, ty] = pt(a, RR - 22); add(sides, 'text', { class: 'sd-az', x: f1(tx), y: f1(ty) }, a + '°');
  });
  SIDES.forEach((s) => {
    const mid = (s.from + s.to) / 2, [x, y] = pt(mid, RR * 0.56);
    const words = s.name.split(' '), t = add(sides, 'text', { class: 'sd-lbl', x: f1(x), y: f1(y - (words.length - 1) * 10 + 6) });
    words.forEach((w, i) => add(t, 'tspan', { x: f1(x), dy: i ? 21 : 0 }, w));
    if (s.note) add(sides, 'text', { class: 'sd-dimt', x: f1(x), y: f1(y + 36), 'text-anchor': 'middle' }, s.note);
  });
  add(sides, 'path', { d: `M${C} 18l5 14-5-3.5-5 3.5z`, fill: '#1A1C1E' });
  add(sides, 'text', { class: 'sd-cmp', x: C + 14, y: 26 }, 'С');
  add(sides, 'circle', { class: 'sd-c', cx: C, cy: C, r: 3 });
  // Сторона виллы по азимуту окон (villas.js). Топаз по азимуту (315°) на границе севера, но
  // его окна смотрят на тихий залив, а не на острова: он идёт к западу и подписан своей водой
  // из данных, чтобы схема не спорила с его листом.
  const inSide = (s, a) => { const x = a < s.from ? a + 360 : a; return x >= s.from && x < s.to; };
  const OWN_WATER = { topaz: 'Запад' };
  const sideOf = (v) => OWN_WATER[v.code] || SIDES.find((s) => inSide(s, azMain(v))).k;
  const vLines = (v) => (OWN_WATER[v.code] ? [v.name, `(${v.water})`] : [v.name]);
  // виллы на кольце по азимуту главного фасада
  VILLAS.forEach((v) => {
    const a = azMain(v), [x, y] = pt(a, RR), [tx, ty] = pt(a, RR + 14);
    add(sides, 'circle', { class: 'sd-v', cx: f1(x), cy: f1(y), r: 4 });
    const sn = Math.sin(a * R);
    const t = add(sides, 'text', { class: 'sd-vt', x: f1(tx), y: f1(ty + 4), 'text-anchor': Math.abs(sn) < 0.2 ? 'middle' : sn > 0 ? 'start' : 'end' });
    vLines(v).forEach((w, i) => add(t, 'tspan', { x: f1(tx), dy: i ? 14 : 0 }, w));
  });
  // список сторон: азимуты и виллы, чьи окна смотрят в эту сторону
  $('#sidesList').innerHTML = SIDES.map((s) => {
    const vs = VILLAS.filter((v) => sideOf(v) === s.k).map((v) => vLines(v).join(' ')).join(', ');
    return `<li><b>${s.k}</b><span class="d3">${s.name}</span><span>${s.from % 360}–${s.to % 360}°${vs ? ' · ' + vs : ''}</span></li>`;
  }).join('');
}

/* ---------- экран 4: год на мысе ---------- */
const ysvg = $('#yearSvg'), yfig = $('#year'), tip = $('#yearTip');
if (ysvg) {
  const Y = capeYMD(new Date()).y;
  const start = capeDate(Y, 1, 1, 12), N = Math.round((capeDate(Y + 1, 1, 1, 12) - start) / 86400000);
  const DAYS = Array.from({ length: N }, (_, i) => { const d = new Date(+start + i * 86400000); return { d, t: sunTimes(d), ymd: capeYMD(d) }; });
  const todayI = Math.round((capeDay(new Date()) - capeDay(start)) / 86400000);
  const MARKS = [
    { m: 5, d: 1, t: 'Апрель и май. С озера сходит лёд.' },
    { m: 6, d: 21, t: 'Июнь. Белые ночи, солнце садится после десяти вечера.' },
    { m: 7, d: 20, t: 'Июль. В лесу поспевает черника.' },
    { m: 9, d: 15, t: 'Сентябрь. Брусника, грибы и жёлтые берёзы.' },
    { m: 10, d: 15, t: 'Октябрь. Первый снег.' },
    { m: 12, d: 15, t: 'Декабрь. Залив замерзает.' },
  ];
  const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const idxOf = (m, d) => DAYS.findIndex((x) => x.ymd.m === m && x.ymd.d === d);
  const tipTxt = (x) => `${x.ymd.d} ${MONTHS_GEN[x.ymd.m - 1]}. Восход в ${hm(x.t.rise)}, закат в ${hm(x.t.set)}, день ${dur(x.t.len)}.`;
  let geo = null;
  function render() {
    const W = Math.round(ysvg.getBoundingClientRect().width) || 1200;
    const top = 30, axis = phone ? 210 : 270, l = phone ? 30 : 42, r = phone ? 6 : 12;
    let H = phone ? axis + 34 : axis + 160;
    const X = (i) => l + (i / (N - 1)) * (W - l - r), Yv = (min) => axis - (min / 1440) * (axis - top);
    geo = { X, Yv, l, r, W, axis };
    ysvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    ysvg.setAttribute('height', H);
    ysvg.textContent = '';
    $$('.yr-lab', yfig).forEach((n) => n.remove());
    // сетка по часам
    [6, 12, 18, 24].forEach((h) => {
      add(ysvg, 'line', { class: 'yr-grid', x1: l, y1: f1(Yv(h * 60)), x2: W - r, y2: f1(Yv(h * 60)) });
      add(ysvg, 'text', { class: 'yr-ht', x: 0, y: f1(Yv(h * 60) + 4) }, h + ' ч');
    });
    // месяцы
    for (let m = 1; m <= 12; m++) {
      const i0 = idxOf(m, 1), i1 = m < 12 ? idxOf(m + 1, 1) : N - 1;
      add(ysvg, 'line', { class: 'yr-axis', x1: f1(X(i0)), y1: axis, x2: f1(X(i0)), y2: axis + 6 });
      if (!phone || m % 2) add(ysvg, 'text', { class: 'yr-mt', x: f1((X(i0) + X(i1)) / 2), y: axis + 20 }, MON[m - 1]);
    }
    // кривая длины дня
    const line = DAYS.map((x, i) => `${i ? 'L' : 'M'}${f1(X(i))} ${f1(Yv(x.t.len))}`).join('');
    add(ysvg, 'path', { class: 'yr-fill', d: `${line}L${f1(X(N - 1))} ${axis}L${f1(X(0))} ${axis}Z` });
    add(ysvg, 'path', { class: 'yr-line', d: line });
    add(ysvg, 'line', { class: 'yr-axis', x1: l, y1: axis, x2: W - r, y2: axis });
    // Сезонные отметки. Где места хватает (десктоп), подписи под осью ярусами: ярус выбирается
    // по замеренной ширине подписи, справа налево, так что подписи не налезают друг на друга и
    // выноски не проходят сквозь подписи. Если чисто разложить не выходит (узкое окно, телефон),
    // на кривой номера на короткой ножке, а тексты списком под графиком.
    const numbers = () => {
      yfig.classList.add('is-num');
      H = axis + 34;
      ysvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      ysvg.setAttribute('height', H);
      MARKS.forEach((mk, j) => {
        const i = idxOf(mk.m, mk.d), x = X(i), y = Yv(DAYS[i].t.len), ny = y - 20;
        add(ysvg, 'line', { class: 'yr-ld', x1: f1(x), y1: f1(y), x2: f1(x), y2: f1(ny + 8) });
        add(ysvg, 'circle', { class: 'yr-pt', cx: f1(x), cy: f1(ny), r: 8 });
        add(ysvg, 'text', { class: 'yr-num', x: f1(x), y: f1(ny) }, String(j + 1));
      });
    };
    yfig.classList.remove('is-num');
    if (phone) numbers();
    else {
      const GAP = 16, FIRST = axis + 40;
      const labs = MARKS.map((mk) => {
        const i = idxOf(mk.m, mk.d), x = X(i), y = Yv(DAYS[i].t.len);
        const lab = document.createElement('p');
        lab.className = 'yr-lab';
        const [head, ...rest] = mk.t.split('. ');
        lab.innerHTML = `<b>${head}</b>${rest.join('. ')}`;
        lab.style.cssText = 'position:absolute;left:0;top:0;max-width:230px;visibility:hidden';
        yfig.appendChild(lab);
        const b = lab.getBoundingClientRect();
        return { lab, x, y, w: b.width, h: b.height };
      });
      const placed = [];
      let clash = 0;
      const clashes = (o, row) => placed.reduce((n, p) => {
        if (p.row === row) return n + (o.left < p.left + p.w + GAP && p.left < o.left + o.w + GAP);
        if (p.row < row) return n + (o.x > p.left - 6 && o.x < p.left + p.w + 6);
        return n + (p.x > o.left - 6 && p.x < o.left + o.w + 6);
      }, 0);
      [...labs].reverse().forEach((o) => {
        // подпись начинается у своей выноски; у правого края уходит влево от неё
        o.left = o.x - 4 + o.w > W - r ? o.x + 4 - o.w : o.x - 4;
        let best = 0, bn = Infinity;
        for (let row = 0; row < 3; row++) { const n = clashes(o, row); if (n < bn) { bn = n; best = row; } if (!n) break; }
        o.row = best; clash += bn; placed.push(o);
      });
      if (clash) { labs.forEach((o) => o.lab.remove()); numbers(); }
      else {
        const rows = Math.max(...labs.map((o) => o.row)) + 1;
        const rowH = Array.from({ length: rows }, (_, k) => Math.max(0, ...labs.filter((o) => o.row === k).map((o) => o.h)) + 18);
        labs.forEach((o) => { o.ly = FIRST + rowH.slice(0, o.row).reduce((a, v) => a + v, 0); });
        H = FIRST + rowH.reduce((a, v) => a + v, 0);
        ysvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        ysvg.setAttribute('height', H);
        const svgTop = ysvg.getBoundingClientRect().top - yfig.getBoundingClientRect().top;
        labs.forEach((o) => {
          add(ysvg, 'line', { class: 'yr-ld', x1: f1(o.x), y1: f1(o.y), x2: f1(o.x), y2: o.ly - 6 });
          add(ysvg, 'circle', { class: 'yr-pt', cx: f1(o.x), cy: f1(o.y), r: 3 });
          o.lab.style.cssText = `position:absolute;top:${Math.round(svgTop + o.ly)}px;left:${Math.round(o.left)}px;width:${Math.ceil(o.w)}px;${o.left < o.x - 4 ? 'text-align:right' : ''}`;
        });
      }
    }
    // сегодня
    const tx = X(todayI), ty = Yv(DAYS[todayI].t.len);
    add(ysvg, 'line', { class: 'yr-now', x1: f1(tx), y1: f1(ty), x2: f1(tx), y2: top - 8 });
    add(ysvg, 'circle', { class: 'yr-pt', cx: f1(tx), cy: f1(ty), r: 4, style: 'fill:var(--ink)' });
    add(ysvg, 'text', { class: 'yr-nowt', x: f1(tx + 6), y: top - 10 }, 'сегодня');
    // наведение
    geo.hov = add(ysvg, 'line', { class: 'yr-hov', x1: 0, y1: top, x2: 0, y2: axis });
    geo.hovPt = add(ysvg, 'circle', { class: 'yr-hovpt', cx: 0, cy: 0, r: 4 });
  }
  render();
  if (document.fonts) document.fonts.ready.then(render); // ширина подписей зависит от шрифта
  $('#yearList').innerHTML = MARKS.map((mk, j) => `<li><i>${j + 1}</i><span>${mk.t}</span></li>`).join('');
  tip.textContent = tipTxt(DAYS[todayI]);
  let rw = 0;
  addEventListener('resize', () => { const w = ysvg.getBoundingClientRect().width; if (Math.abs(w - rw) > 2) { rw = w; render(); } });
  const hover = (clientX) => {
    const b = ysvg.getBoundingClientRect(), x = clientX - b.left;
    const i = Math.max(0, Math.min(N - 1, Math.round(((x - geo.l) / (geo.W - geo.l - geo.r)) * (N - 1))));
    const X = geo.X(i), Yy = geo.Yv(DAYS[i].t.len);
    geo.hov.setAttribute('x1', f1(X)); geo.hov.setAttribute('x2', f1(X));
    geo.hovPt.setAttribute('cx', f1(X)); geo.hovPt.setAttribute('cy', f1(Yy));
    yfig.classList.add('is-hov');
    tip.textContent = tipTxt(DAYS[i]);
  };
  ysvg.addEventListener('pointermove', (e) => hover(e.clientX));
  ysvg.addEventListener('pointerdown', (e) => hover(e.clientX));
  ysvg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { yfig.classList.remove('is-hov'); tip.textContent = tipTxt(DAYS[todayI]); } });
}

ScrollTrigger.refresh();
