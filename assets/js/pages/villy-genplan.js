// ГРАНИ: генплан мыса Светлого. Общий компонент листа 03 (villy.html) и страницы виллы (villa.html,
// блок «Куда смотрят окна»); главная может брать его в лёгком режиме.
//
//   drawGenplan(svg, { mode, sel, roi, shift, avoid, callout, small, onEnter, onLeave, onPick, onFit })
//     mode:    'full'  генплан листа 03: наведение, веер, выноска, клик по участку;
//              'lite'  только участки и подсветка (без вееров и выносок), для главной;
//              'villa' приближение к вилле sel (±180 м): веер, лучи солнца, остальное спокойно.
//     roi:     [x0, y0, x1, y1] в единицах генплана, что обязано поместиться в кадр (по умолчанию весь мыс);
//     shift:   [0..1, 0..1] куда сдвинуть лишнее место кадра (0 по центру);
//     avoid:   доли roi [x0, y0, x1, y1], где не ставить подписи изобат и горизонталей (под заголовком);
//     callout: false — без выноски (телефон, там панель); small: true — телефонные места подписей.
//     onEnter(v, how) наведение, фокус или первое касание (how = 'touch'); onPick(v, e) переход на виллу.
//   → { active(code|null), fit(), sunRays(v, 'today'|'june'|'dec'), pxPerM, el: { lots, labels, feet } }
//   Размер svg задаёт страница (CSS); кадр подстраивается под него сам (ResizeObserver).
//
// Единица = 1 метр, север вверх, x на восток, y на юг. Основа берётся из v1: контур мыса (landPath,
// сдвинут макетом на 40 вниз), места участков, причал, клуб; плюс залив к востоку от Кварца
// (решение директора 27.10). Горизонтали и изобаты не рисуются руками: строится поле высот
// (расстояние до берега плюс плавный шум), линии снимаются с него. Поэтому изобаты не пересекают
// берег и друг друга при любой правке контура.
// Дома в настоящем масштабе: контур, терраса, бассейн из plans.js, поворот по полю up.
import { PLANS } from '../plans.js';
import { VILLAS, azMain, bedsWord, statusWord } from '../villas.js';
import { sunTimes, capeDate } from '../sun.js';

const NS = 'http://www.w3.org/2000/svg';
const R = Math.PI / 180;
// Единиц генплана в метре. Контур мыса из v1 живёт в своих единицах; дома, участки, сосны, постройки
// и линейка в метрах, через UPM. Мыс выходит около 570 м поперёк, дома в настоящем масштабе.
export const UPM = 1.4;

// ---------- геометрия мира ----------
// Мыс: путь v1 (как в макете _mock/genplan.html), снизу и справа продолжен за край листа,
// чтобы при любом кадре не было видно обреза суши. Прямой западный берег залива из макета
// (L800 640) заменён плавной линией: прямая читалась как обрез.
const COAST_D = 'M120 640c-30-40-20-90 30-120 60-36 40-90 90-120 50-30 120-10 160-60 34-42 30-110 90-150 40-26 100-30 150-20 40 8 60 0 80-10 22-4 34 6 30 26-6 30-30 52-14 84 14 28 40 34 54 60C804 420 776 520 792 640';
// южнее оконечности берег уходит на юго-восток: за Агатом вода, мыс читается мысом
const LAND_D = COAST_D + 'C806 760 784 900 812 1100L520 1100C480 880 300 770 190 712C150 690 125 668 120 640Z';
// противоположный берег залива (иначе «залив» к востоку от Кварца читается как открытая вода)
const EAST_D = 'M930 -300C900 -120 880 20 896 110C910 190 952 240 930 330C908 420 868 470 884 560C896 640 940 760 930 1100L1400 1100L1400 -300Z';
// четыре острова к северо-западу от Опала (в секторе его окон 285–15°)
const ISLANDS = [
  [[112, 372], [134, 362], [158, 368], [154, 386], [128, 392], [110, 386]],
  [[48, 330], [74, 320], [98, 330], [88, 346], [58, 348]],
  [[150, 334], [168, 326], [182, 334], [174, 346], [156, 346]],
  [[96, 288], [120, 280], [140, 288], [132, 302], [106, 304]],
];
// гранитные лбы: у Опала уступ, у Агата мыс, у Берилла опоры террасы, пара внутри
const ROCKS = [
  [[236, 410], [248, 402], [262, 404], [258, 416], [242, 418]],
  [[112, 560], [124, 550], [134, 558], [126, 570], [114, 572]],
  [[588, 182], [604, 176], [616, 184], [604, 194], [590, 192]],
  [[600, 290], [624, 282], [636, 296], [620, 306], [602, 302]],
  [[340, 520], [360, 512], [372, 524], [356, 536], [340, 532]],
  [[744, 296], [754, 290], [762, 298], [752, 306]],
];
// клуб: дом, причал на 6 мест с катером, сауна у воды (места из v1, подогнаны к берегу)
const CLUB = { at: [216, 484], w: 24, h: 14, rot: -36 };
const SAUNA = { at: [168, 512], w: 7, h: 5, rot: -40 };
const PIER = { from: [200, 470], to: [150, 430], berths: 3 };
// дорога приходит с юга (с материка) и кончается у въезда, дальше только пешком
const ROAD_D = 'M640 1100C628 900 600 760 588 650C582 590 566 540 548 506';
const PARK = { at: [538, 496], w: 30, h: 18, rot: -24 };
const GATE = [552, 524];

// ---------- служебное ----------
function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const f1 = (n) => Math.round(n * 10) / 10;
const pts = (P) => P.map(([x, y]) => f1(x) + ',' + f1(y)).join(' ');
const pathOf = (P, closed) => 'M' + P.map(([x, y]) => f1(x) + ' ' + f1(y)).join('L') + (closed ? 'Z' : '');
// гладкий замкнутый контур по точкам (середины сторон и квадратичные кривые)
function smoothClosed(P) {
  const n = P.length; const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = 'M' + mid(P[n - 1], P[0]).map(f1).join(' ');
  for (let i = 0; i < n; i++) { const m = mid(P[i], P[(i + 1) % n]); d += `Q${f1(P[i][0])} ${f1(P[i][1])} ${f1(m[0])} ${f1(m[1])}`; }
  return d + 'Z';
}
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const pip = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; };
// разбор пути из M, H, L, c, C, Z в ломаную
function flatten(d, n = 16) {
  const tok = d.match(/[MHLcCZz]|-?\d*\.?\d+/g); let i = 0, x = 0, y = 0, cmd = ''; const P = [];
  const num = () => +tok[i++];
  const cubic = (x1, y1, x2, y2, x3, y3) => { for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; P.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]); } x = x3; y = y3; };
  while (i < tok.length) {
    if (/[MHLcCZz]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { x = num(); y = num(); P.push([x, y]); cmd = 'L'; }
    else if (cmd === 'H') { x = num(); P.push([x, y]); }
    else if (cmd === 'L') { x = num(); y = num(); P.push([x, y]); }
    else if (cmd === 'c') { const a = [num(), num(), num(), num(), num(), num()]; cubic(x + a[0], y + a[1], x + a[2], y + a[3], x + a[4], y + a[5]); }
    else if (cmd === 'C') { cubic(num(), num(), num(), num(), num(), num()); }
    else if (cmd === 'Z' || cmd === 'z') { /* замыкание */ }
  }
  return P;
}
// гладкая ломаная по опорным точкам (Катмулл-Ром), для дорожек
function spline(P, n = 8) {
  const out = [P[0]];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    for (let k = 1; k <= n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  return out;
}

const LAND = flatten(LAND_D), EAST = flatten(EAST_D);
// тот же сглаженный контур, что рисует smoothClosed, ломаной (для растра суши)
function smoothPts(P, n = 6) {
  const out = [], N = P.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (let i = 0; i < N; i++) { const a = mid(P[(i + N - 1) % N], P[i]), c = P[i], b = mid(P[i], P[(i + 1) % N]);
    for (let k = 0; k < n; k++) { const t = k / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } }
  return out;
}
const ISL = ISLANDS.map((P) => smoothPts(P));
const onLand = (x, y) => pip(x, y, LAND) || pip(x, y, EAST) || ISL.some((P) => pip(x, y, P));

// ---------- дома ----------
// план → генплан: центр дома в at, верх чертежа смотрит на азимут up
export function villaGeo(v) {
  const p = PLANS[v.code];
  const shell = p.floors.flatMap((f) => f.shell.flat());
  const xs = shell.map((q) => q[0]), ys = shell.map((q) => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const a = p.up * R, c = Math.cos(a), s = Math.sin(a);
  const T = ([x, y]) => { const dx = x - cx, dy = y - cy; return [v.at[0] + (dx * c - dy * s) * UPM, v.at[1] + (dx * s + dy * c) * UPM]; };
  const f0 = p.floors[0];
  const foot = [...new Set(p.floors.flatMap((f) => f.shell.map((q) => JSON.stringify(q))))].map((q) => JSON.parse(q).map(T));
  if (f0.bay) foot.push(bayOuter(f0.bay).map(T));
  const decks = (f0.decks || []).map((d) => d.p.map(T));
  const pools = (f0.pools || []).map((pl) => pl.p.map(T));
  return { T, cx, cy, up: p.up, foot, decks, pools, lot: lotPoly(v, T, cx, cy), c: v.at };
}
// Участок: полоса шириной v.lot (м) поперёк взгляда окон, от воды вглубь мыса. Со стороны воды его
// граница идёт по берегу (полоса обрезается сушей), глубина подбирается так, чтобы площадь была
// ровно v.sot соток. Поэтому подпись «18 сот.» на плане правда, а не округление.
function lotPoly(v, T, cx, cy) {
  const rel = (azMain(v) - PLANS[v.code].up) * R;
  const f = [Math.sin(rel), -Math.cos(rel)], l = [-f[1], f[0]];
  const off = v.lotShift || 0, w = v.lot / 2;
  const rect = (d) => [[off - w, 70], [off + w, 70], [off + w, -d], [off - w, -d]]
    .map(([a, b]) => T([cx + l[0] * a + f[0] * b, cy + l[1] * a + f[1] * b]));
  const target = v.sot * 100 * UPM * UPM;
  let lo = 2, hi = 160, poly = null;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; poly = clipConvex(LAND, rect(mid)); if (area(poly) < target) lo = mid; else hi = mid; }
  return poly;
}
const area = (P) => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]); return Math.abs(a / 2); };
// Сазерленд — Ходжмен: многоугольник P, обрезанный выпуклым C
function clipConvex(P, C) {
  let out = P;
  const ctr = [C.reduce((t, p) => t + p[0], 0) / C.length, C.reduce((t, p) => t + p[1], 0) / C.length];
  for (let i = 0; i < C.length; i++) {
    const a = C[i], b = C[(i + 1) % C.length], inp = out; out = [];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const sc = Math.sign(side(ctr)), inside = (p) => side(p) * sc >= 0;
    const cut = (p, q) => { const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]); const t = d1 / (d1 - d2); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
    for (let k = 0; k < inp.length; k++) { const p = inp[k], q = inp[(k + 1) % inp.length]; const ip = inside(p), iq = inside(q); if (ip) { out.push(p); if (!iq) out.push(cut(p, q)); } else if (iq) out.push(cut(p, q)); }
  }
  return out;
}
// внешний контур гранёного стекла (как в plans.js: сдвиг ломаной наружу на толщину стекла)
function bayOuter(b) {
  const o = [2 * b.pts[1][0] - b.c[0], 2 * b.pts[1][1] - b.c[1]];
  const d = 0.07, P = b.pts;
  const off = P.map((q, i) => {
    const a = P[Math.max(0, i - 1)], bb = P[Math.min(P.length - 1, i + 1)];
    let nx = -(bb[1] - a[1]), ny = bb[0] - a[0]; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
    if ((o[0] - q[0]) * nx + (o[1] - q[1]) * ny < 0) { nx = -nx; ny = -ny; }
    return [q[0] + nx * d, q[1] + ny * d];
  });
  return off;
}
const GEO = Object.fromEntries(VILLAS.map((v) => [v.code, villaGeo(v)]));

// ---------- поле высот, горизонтали и изобаты ----------
const BOX = [-320, -260, 1180, 1100], CELL = 5;
let FIELD = null;
function field() {
  if (FIELD) return FIELD;
  const [X0, Y0, X1, Y1] = BOX, nx = Math.round((X1 - X0) / CELL) + 1, ny = Math.round((Y1 - Y0) / CELL) + 1;
  const land = new Uint8Array(nx * ny);
  // растр суши построчно: пересечения строки с рёбрами многоугольников
  for (const P of [LAND, EAST, ...ISL]) {
    for (let j = 0; j < ny; j++) {
      const y = Y0 + j * CELL, xs = [];
      for (let i = 0, k = P.length - 1; i < P.length; k = i++) { const [xa, ya] = P[i], [xb, yb] = P[k]; if ((ya > y) !== (yb > y)) xs.push(xa + (y - ya) * (xb - xa) / (yb - ya)); }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) { const i0 = Math.max(0, Math.ceil((xs[q] - X0) / CELL)), i1 = Math.min(nx - 1, Math.floor((xs[q + 1] - X0) / CELL)); for (let i = i0; i <= i1; i++) land[j * nx + i] = 1; }
    }
  }
  // расстояние до берега (фаска 3-4, по обе стороны)
  const dist = (inside) => {
    const D = new Float32Array(nx * ny); const INF = 1e9;
    for (let k = 0; k < D.length; k++) D[k] = land[k] === inside ? INF : 0;
    const a = CELL, b = CELL * Math.SQRT2;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let v = D[k]; if (!v) continue;
      if (i > 0) v = Math.min(v, D[k - 1] + a); if (j > 0) { v = Math.min(v, D[k - nx] + a); if (i > 0) v = Math.min(v, D[k - nx - 1] + b); if (i < nx - 1) v = Math.min(v, D[k - nx + 1] + b); } D[k] = v; }
    for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; let v = D[k]; if (!v) continue;
      if (i < nx - 1) v = Math.min(v, D[k + 1] + a); if (j < ny - 1) { v = Math.min(v, D[k + nx] + a); if (i < nx - 1) v = Math.min(v, D[k + nx + 1] + b); if (i > 0) v = Math.min(v, D[k + nx - 1] + b); } D[k] = v; }
    return D;
  };
  const dIn = dist(1), dOut = dist(0);
  // плавный шум: сумма нескольких синусов с фиксированными фазами (одинаков при каждой загрузке)
  const noise = (x, y) => Math.sin(x / 97 + 1.3) * Math.cos(y / 83 - 0.7) + 0.6 * Math.sin((x + y) / 61 + 2.1) + 0.4 * Math.cos((x - 1.7 * y) / 47 + 0.4);
  // крутизна: у Опала уступ (берег круче), в заливах мелко
  const steep = (x, y) => 1 + 1.6 * Math.exp(-((x - 290) ** 2 + (y - 392) ** 2) / 2600) + 0.6 * Math.exp(-((x - 140) ** 2 + (y - 580) ** 2) / 3000);
  const shallow = (x, y) => 1 + 1.2 * Math.exp(-((x - 360) ** 2 + (y - 290) ** 2) / 9000) + 1.4 * Math.exp(-((x - 840) ** 2 + (y - 300) ** 2) / 26000);
  const H = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = X0 + i * CELL, y = Y0 + j * CELL;
    if (land[k]) { const d = dIn[k] * steep(x, y); H[k] = 21 * (1 - Math.exp(-d / 95)) + 2.6 * noise(x, y) * (1 - Math.exp(-d / 28)); }
    else { const d = dOut[k] * steep(x, y) / shallow(x, y); H[k] = -(14 * (1 - Math.exp(-d / 75)) + 1.2 * noise(x * 1.3, y) * (1 - Math.exp(-d / 20))); }
  }
  FIELD = { nx, ny, H, land, X0, Y0 };
  return FIELD;
}
// изолиния уровня lev: квадраты → отрезки → сшитые ломаные → сглаживание
const ISO = new Map();
function isoline(lev) {
  if (ISO.has(lev)) return ISO.get(lev);
  const { nx, ny, H, X0, Y0 } = field();
  const segs = [];
  const P = (i, j) => [X0 + i * CELL, Y0 + j * CELL];
  const lerp = (i0, j0, i1, j1) => { const a = H[j0 * nx + i0] - lev, b = H[j1 * nx + i1] - lev, t = a / (a - b); const p = P(i0, j0), q = P(i1, j1); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = (H[j * nx + i] > lev ? 8 : 0) | (H[j * nx + i + 1] > lev ? 4 : 0) | (H[(j + 1) * nx + i + 1] > lev ? 2 : 0) | (H[(j + 1) * nx + i] > lev ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const top = () => lerp(i, j, i + 1, j), right = () => lerp(i + 1, j, i + 1, j + 1), bot = () => lerp(i, j + 1, i + 1, j + 1), left = () => lerp(i, j, i, j + 1);
    const S = { 1: [left, bot], 2: [bot, right], 3: [left, right], 4: [top, right], 5: [left, top, bot, right], 6: [top, bot], 7: [left, top], 8: [left, top], 9: [top, bot], 10: [left, bot, top, right], 11: [top, right], 12: [left, right], 13: [bot, right], 14: [left, bot] }[c];
    for (let q = 0; q < S.length; q += 2) segs.push([S[q](), S[q + 1]()]);
  }
  // сшивка по совпадающим концам
  const key = (p) => Math.round(p[0] * 10) * 1e6 + Math.round(p[1] * 10);
  const map = new Map();
  segs.forEach((s, n) => { for (const e of [0, 1]) { const k = key(s[e]); if (!map.has(k)) map.set(k, []); map.get(k).push([n, e]); } });
  const used = new Uint8Array(segs.length), lines = [];
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue; used[n] = 1;
    const line = [segs[n][0], segs[n][1]];
    for (const dir of [1, -1]) {
      for (;;) {
        const end = dir > 0 ? line[line.length - 1] : line[0];
        const cand = (map.get(key(end)) || []).find(([m]) => !used[m]);
        if (!cand) break;
        used[cand[0]] = 1; const nxt = segs[cand[0]][1 - cand[1]];
        if (dir > 0) line.push(nxt); else line.unshift(nxt);
      }
    }
    if (line.length > 6) lines.push(line);
  }
  // сглаживание Чайкина, два прохода
  const res = lines.map((L) => { let Q = L; for (let r = 0; r < 2; r++) { const o = [Q[0]]; for (let k = 0; k < Q.length - 1; k++) { const a = Q[k], b = Q[k + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(Q[Q.length - 1]); Q = o; } return Q; });
  ISO.set(lev, res);
  return res;
}

// ---------- дорожки ----------
const PATHS = [
  [GATE, [580, 470], [630, 380], [668, 300], [690, 246]],          // к Кварцу
  [[630, 380], [584, 320], [536, 278], [510, 262]],                 // к Бериллу
  [GATE, [500, 482], [452, 436], [424, 410]],                       // к Топазу
  [[452, 436], [384, 452], [324, 462], [304, 458]],                 // к Опалу
  [[384, 452], [304, 494], [244, 500], [230, 494]],                 // к клубу
  [[244, 500], [212, 534], [194, 558]],                             // к Агату
  [[212, 534], [180, 520]],                                         // к сауне
].map((P) => spline(P));

// ---------- сосны ----------
// Процедурно, с фиксированным зерном (одинаковы при каждой загрузке). Не на участках, дорожках,
// дороге, постройках и не у самой воды. Занятость дорожек смотрится по сетке поля высот.
let PINES = null, GAPS = null;
function pines() {
  if (PINES) return PINES;
  const { nx, ny, H, X0, Y0 } = field();
  const busy = new Uint8Array(nx * ny);
  const mark = (x, y, d) => { const r = Math.ceil(d / CELL); const i0 = Math.round((x - X0) / CELL), j0 = Math.round((y - Y0) / CELL);
    for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) if (i >= 0 && j >= 0 && i < nx && j < ny && Math.hypot((i - i0) * CELL, (j - j0) * CELL) <= d) busy[j * nx + i] = 1; };
  for (const [x, y] of [...PATHS.flat(), ...flatten(ROAD_D, 40)]) mark(x, y, 6);
  mark(CLUB.at[0], CLUB.at[1], 26); mark(PARK.at[0], PARK.at[1], 32); mark(SAUNA.at[0], SAUNA.at[1], 12);
  const lotBox = VILLAS.map((v) => { const P = GEO[v.code].lot, xs = P.map((q) => q[0]), ys = P.map((q) => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), P]; });
  const at = (x, y) => Math.round((y - Y0) / CELL) * nx + Math.round((x - X0) / CELL);
  const R0 = rnd(20261027), out = [];
  for (let i = 0; i < 20000 && out.length < 1500; i++) {
    const x = -60 + R0() * 1080, y = 80 + R0() * 820, k = at(x, y);
    if (!(H[k] > 0.8) || busy[k]) continue;
    if (lotBox.some(([a, b, c, d, P]) => x >= a && x <= c && y >= b && y <= d && pip(x, y, P))) continue;
    out.push([x, y, (2.2 + R0() * 2.4) * UPM]);
  }
  for (const P of ISL) { // острова
    const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
    for (let k = 0, m = 0; k < 60 && m < 7; k++) {
      const x = Math.min(...xs) + R0() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + R0() * (Math.max(...ys) - Math.min(...ys));
      if (pip(x, y, P)) { out.push([x, y, (1.8 + R0() * 1.6) * UPM]); m++; }
    }
  }
  return (PINES = out);
}

// ---------- рисование ----------
export function drawGenplan(svg, opts = {}) {
  const mode = opts.mode || 'full';
  const sel = opts.sel || null;
  const ROI = opts.roi || (mode === 'villa' && sel ? (() => { const c = GEO[sel].c, d = 180 * UPM; return [c[0] - d, c[1] - d, c[0] + d, c[1] + d]; })() : [30, 100, 900, 680]);
  svg.textContent = '';
  svg.classList.add('gp', 'gp--' + mode);
  svg.classList.toggle('gp--nocall', opts.callout === false);
  svg.setAttribute('role', 'group');
  const id = 'gp' + Math.random().toString(36).slice(2, 7);
  const defs = el('defs', {}, svg);
  const hp = el('pattern', { id: id + 'h', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 4, height: 4, class: 'gp-hatch-bg' }, hp);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 4, class: 'gp-hatch-ln' }, hp);
  const rp = el('pattern', { id: id + 'r', width: 22, height: 9, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M0 6c5-3 6-3 11 0s6 3 11 0', class: 'gp-ripple-ln' }, rp);
  const fg = el('radialGradient', { id: id + 'f', cx: 0, cy: 0, r: 1, gradientUnits: 'objectBoundingBox' }, defs);
  el('stop', { offset: 0, class: 'gp-fan-s0' }, fg); el('stop', { offset: 1, class: 'gp-fan-s1' }, fg);
  const clip = el('clipPath', { id: id + 'c' }, defs);
  el('path', { d: LAND_D }, clip); el('path', { d: EAST_D }, clip);

  // вода и рябь
  el('rect', { x: BOX[0] - 400, y: BOX[1] - 400, width: BOX[2] - BOX[0] + 800, height: BOX[3] - BOX[1] + 800, class: 'gp-water' }, svg);
  el('rect', { x: BOX[0] - 400, y: BOX[1] - 400, width: BOX[2] - BOX[0] + 800, height: BOX[3] - BOX[1] + 800, fill: `url(#${id}r)`, class: 'gp-ripple' }, svg);
  // изобаты
  const gIso = el('g', { class: 'gp-iso' }, svg);
  const isoLabels = [];
  for (const lev of [-2, -5, -10]) for (const L of isoline(lev)) { el('path', { d: L.d || (L.d = pathOf(L)) }, gIso); isoLabels.push({ lev, L }); }
  // суша
  const gLand = el('g', { class: 'gp-landg' }, svg);
  el('path', { d: LAND_D, class: 'gp-land' }, gLand);
  el('path', { d: EAST_D, class: 'gp-land' }, gLand);
  for (const P of ISLANDS) el('path', { d: smoothClosed(P), class: 'gp-land gp-isl' }, gLand);
  // горизонтали
  const gTopo = el('g', { class: 'gp-topo', 'clip-path': `url(#${id}c)` }, svg);
  const topoLabels = [];
  for (const lev of [5, 10, 15]) for (const L of isoline(lev)) { el('path', { d: L.d || (L.d = pathOf(L)), class: lev === 10 ? 'gp-topo--b' : null }, gTopo); topoLabels.push({ lev, L }); }
  // гранитные лбы
  const gRock = el('g', { class: 'gp-rocks' }, svg);
  for (const P of ROCKS) el('path', { d: smoothClosed(P), fill: `url(#${id}h)`, class: 'gp-rock' }, gRock);
  // берег поверх
  el('path', { d: COAST_D, class: 'gp-shore' }, svg);
  el('path', { d: EAST_D, class: 'gp-shore' }, svg);
  for (const P of ISLANDS) el('path', { d: smoothClosed(P), class: 'gp-shore' }, svg);
  // кресты сетки через 100 м
  const gCross = el('g', { class: 'gp-cross' }, svg);
  for (let x = -200; x <= 1100; x += 100) for (let y = -200; y <= 1000; y += 100) el('path', { d: `M${x - 4} ${y}h8M${x} ${y - 4}v8` }, gCross);
  // дорога, стоянка, дорожки
  el('path', { d: ROAD_D, class: 'gp-road' }, svg);
  el('rect', { x: f1(PARK.at[0] - PARK.w * UPM / 2), y: f1(PARK.at[1] - PARK.h * UPM / 2), width: f1(PARK.w * UPM), height: f1(PARK.h * UPM), transform: `rotate(${PARK.rot} ${PARK.at[0]} ${PARK.at[1]})`, class: 'gp-park' }, svg);
  const gPath = el('g', { class: 'gp-paths' }, svg);
  for (const P of PATHS) el('path', { d: pathOf(P) }, gPath);

  // участки
  const gLots = el('g', { class: 'gp-lots' }, svg);
  const lots = {};
  for (const v of VILLAS) {
    const g = GEO[v.code];
    const a = el('a', { href: `villa.html?v=${v.code}`, class: 'gp-lot', 'data-v': v.code, 'aria-label': `Вилла «${v.name}», ${v.area} м², ${v.beds} ${bedsWord(v.beds)}, ${statusWord(v)}` }, gLots);
    el('polygon', { points: pts(g.lot), class: 'gp-lot-f' }, a);
    el('polygon', { points: pts(g.lot), class: 'gp-lot-b' }, a);
    el('circle', { cx: g.c[0], cy: g.c[1], r: 1, class: 'gp-hit' }, a); // зона касания, радиус ставит fit()
    lots[v.code] = a;
  }

  // сосны: два контура (кроны и центры) вместо тысяч кружков, считаются один раз на страницу
  const gPine = el('g', { class: 'gp-pines' }, svg);
  const crowns = [], dots = [];
  for (const [x, y, r] of pines()) { crowns.push(`M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0`); dots.push(`M${f1(x - 0.6)} ${f1(y)}a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0 -1.2 0`); }
  el('path', { d: crowns.join(''), class: 'gp-pine' }, gPine);
  el('path', { d: dots.join(''), class: 'gp-pine-c' }, gPine);

  // постройки клуба
  const gB = el('g', { class: 'gp-build' }, svg);
  const rect = (o, cls) => el('rect', { x: f1(o.at[0] - o.w * UPM / 2), y: f1(o.at[1] - o.h * UPM / 2), width: f1(o.w * UPM), height: f1(o.h * UPM), transform: `rotate(${o.rot} ${o.at[0]} ${o.at[1]})`, class: cls }, gB);
  rect(CLUB, 'gp-foot'); rect(SAUNA, 'gp-foot');
  // причал на 6 мест: настил 2,6 м, три пары пальцев по 8 м, у одного места клубный катер
  const [ax, ay] = PIER.from, [bx, by] = PIER.to, L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
  const nxp = -uy, nyp = ux, hw = 1.3 * UPM;
  el('polygon', { points: pts([[ax + nxp * hw, ay + nyp * hw], [bx + nxp * hw, by + nyp * hw], [bx - nxp * hw, by - nyp * hw], [ax - nxp * hw, ay - nyp * hw]]), class: 'gp-pier' }, gB);
  for (let k = 0; k < PIER.berths; k++) {
    const t = 0.34 + k * 0.24, px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
    for (const sg of [1, -1]) {
      const fx = px + nxp * sg * hw, fy = py + nyp * sg * hw, fl = 8 * UPM, fw = 0.5 * UPM;
      el('polygon', { points: pts([[fx - ux * fw, fy - uy * fw], [fx + ux * fw, fy + uy * fw], [fx + ux * fw + nxp * sg * fl, fy + uy * fw + nyp * sg * fl], [fx - ux * fw + nxp * sg * fl, fy - uy * fw + nyp * sg * fl]]), class: 'gp-pier' }, gB);
    }
  }
  { // катер у второго места, корпус 9 м
    const t = 0.46, cxp = ax + (bx - ax) * t + nxp * (hw + 2.6 * UPM), cyp = ay + (by - ay) * t + nyp * (hw + 2.6 * UPM);
    const hl = 4.5 * UPM, hb = 1.3 * UPM;
    el('path', { d: `M${f1(cxp - ux * hl + nxp * hb)} ${f1(cyp - uy * hl + nyp * hb)}L${f1(cxp + ux * (hl - 2.2 * UPM) + nxp * hb)} ${f1(cyp + uy * (hl - 2.2 * UPM) + nyp * hb)}L${f1(cxp + ux * hl)} ${f1(cyp + uy * hl)}L${f1(cxp + ux * (hl - 2.2 * UPM) - nxp * hb)} ${f1(cyp + uy * (hl - 2.2 * UPM) - nyp * hb)}L${f1(cxp - ux * hl - nxp * hb)} ${f1(cyp - uy * hl - nyp * hb)}Z`, class: 'gp-boat' }, gB);
  }

  // дома, террасы, бассейны, причал Агата
  const gV = el('g', { class: 'gp-villas' }, svg);
  const feet = {};
  for (const v of VILLAS) {
    const g = GEO[v.code];
    const vg = el('g', { class: 'gp-house', 'data-v': v.code }, gV);
    for (const P of g.decks) el('polygon', { points: pts(P), class: 'gp-deck' }, vg);
    for (const P of g.pools) el('polygon', { points: pts(P), class: 'gp-pool' }, vg);
    if (v.code === 'agat') el('polygon', { points: pts([[13.6, -4.4], [15.4, -4.4], [15.4, -24], [13.6, -24]].map(g.T)), class: 'gp-deck gp-deck--pier' }, vg);
    for (const P of g.foot) el('polygon', { points: pts(P), class: 'gp-foot' }, vg);
    feet[v.code] = vg;
  }

  // размер между соседями: только там, где это правда (≥ 60 м по ближайшим точкам участков)
  const gDim = el('g', { class: 'gp-dims' }, svg);
  const gap = (A, B) => { let best = [1e9]; const per = (P) => P.flatMap((p, i) => { const q = P[(i + 1) % P.length]; return Array.from({ length: 30 }, (_, k) => [p[0] + (q[0] - p[0]) * k / 30, p[1] + (q[1] - p[1]) * k / 30]); }); const a = per(A), b = per(B); for (const p of a) for (const q of b) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < best[0]) best = [d, p, q]; } return best; };
  const gaps = GAPS || (GAPS = VILLAS.slice(0, -1).map((v, i) => gap(GEO[v.code].lot, GEO[VILLAS[i + 1].code].lot)));
  const shown = gaps.map((g, i) => [g, i]).filter(([g]) => g[0] / UPM >= 60).sort((a, b) => a[0][0] - b[0][0]).slice(0, 2);
  const dimLabels = [];
  for (const [[d, p, q]] of shown) {
    el('path', { d: `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`, class: 'gp-dim' }, gDim);
    for (const [x, y] of [p, q]) el('path', { d: `M${f1(x - 3)} ${f1(y + 3)}L${f1(x + 3)} ${f1(y - 3)}`, class: 'gp-dim-t' }, gDim);
    dimLabels.push({ x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, ang: Math.atan2(q[1] - p[1], q[0] - p[0]) / R, d });
  }

  // веер обзора и лучи солнца (слой под подписями)
  const gFan = el('g', { class: 'gp-fang' }, svg);
  const gSun = el('g', { class: 'gp-sunrays' }, svg);

  // подписи
  const gLab = el('g', { class: 'gp-labels', 'aria-hidden': 'true' }, svg);
  const labels = {};
  for (const v of VILLAS) {
    const [x, y] = (opts.small && v.labelAtM) || v.labelAt;
    const g = el('g', { class: 'gp-vl', 'data-v': v.code, transform: `translate(${x} ${y})` }, gLab);
    el('text', { class: 'gp-t-name' }, g, v.name);
    el('text', { class: 'gp-t-ann gp-t-sub' }, g, v.plot);
    labels[v.code] = g;
  }
  const fixed = [];
  const T = (x, y, cls, t, extra = {}) => { const e = el('text', { x: f1(x), y: f1(y), class: cls, 'data-t': t, ...extra }, gLab, t); fixed.push(e); return e; };
  if (mode !== 'villa') {
    // подписи на карте вычитаны копирайтером 27.10
    T(8, 480, 'gp-t-water gp-t-spaced', 'ОЗЕРО');
    T(40, 412, 'gp-t-water', 'четыре острова');
    T(818, 400, 'gp-t-water', 'залив', { 'text-anchor': 'middle' });
    T(CLUB.at[0] + 18, CLUB.at[1] + 4, 'gp-t-ann', 'клубный дом');
    T(PIER.to[0] - 4, PIER.to[1] - 10, 'gp-t-ann', 'причал на 6 мест', { 'text-anchor': 'middle' });
    T(SAUNA.at[0] - 10, SAUNA.at[1] + 16, 'gp-t-ann', 'сауна', { 'text-anchor': 'end' });
    T(GATE[0] + 14, GATE[1] + 10, 'gp-t-tech', 'ВЪЕЗД');
  }
  // подписи изобат и горизонталей: по одной на уровень, внутри кадра и подальше от подписей вилл,
  // участков, клуба и друг друга
  const cen = (P) => [P.reduce((t, q) => t + q[0], 0) / P.length, P.reduce((t, q) => t + q[1], 0) / P.length];
  const busyPts = [...VILLAS.map((v) => v.labelAt), ...VILLAS.map((v) => GEO[v.code].c), CLUB.at, PIER.to, SAUNA.at, GATE, PARK.at, ...ISLANDS.map(cen)];
  const used = [];
  const inRoi = ([x, y], m) => x > ROI[0] + m && x < ROI[2] - m && y > ROI[1] + m && y < ROI[3] - m;
  const place = (lines, west) => {
    let best = null, bs = -Infinity;
    for (const L of lines) for (let i = 4; i < L.length - 4; i += 3) {
      const p = L[i];
      if (!inRoi(p, 30)) continue;
      if ((opts.avoid || []).some(([a, b, c, d]) => p[0] > ROI[0] + a * (ROI[2] - ROI[0]) && p[0] < ROI[0] + c * (ROI[2] - ROI[0]) && p[1] > ROI[1] + b * (ROI[3] - ROI[1]) && p[1] < ROI[1] + d * (ROI[3] - ROI[1]))) continue;
      let d = Math.min(...[...busyPts, ...used].map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
      if (VILLAS.some((v) => pip(p[0], p[1], GEO[v.code].lot))) d = 0;
      const sc = Math.min(d, 110) - (west ? p[0] * 0.04 : 0);
      if (sc > bs) { bs = sc; best = p; }
    }
    if (best) used.push(best);
    return best;
  };
  for (const lev of [-2, -5, -10]) { const p = place(isoLabels.filter((o) => o.lev === lev).map((o) => o.L), true); if (p) T(p[0], p[1] - 2, 'gp-t-depth', '−' + Math.abs(lev), { 'text-anchor': 'middle' }); }
  for (const lev of [5, 10, 15]) { const p = place(topoLabels.filter((o) => o.lev === lev).map((o) => o.L), false); if (p) T(p[0], p[1] + 4, 'gp-t-topo', '+' + lev, { 'text-anchor': 'middle' }); }
  for (const dl of dimLabels) {
    let a = dl.ang; if (a > 90) a -= 180; if (a < -90) a += 180;
    T(dl.x, dl.y, 'gp-t-ann gp-t-dim', '≥ 60 м', { transform: `rotate(${f1(a)} ${f1(dl.x)} ${f1(dl.y)})`, 'text-anchor': 'middle', dy: '-0.45em' });
  }

  // выноска выбранной виллы
  const gCall = el('g', { class: 'gp-call' }, svg);

  // ---------- состояние ----------
  let u = 1, cur = null;
  function fan(v, kind) {
    gFan.textContent = '';
    if (!v) return;
    const c = GEO[v.code].c, [a1, a2] = v.az, Rr = mode === 'villa' ? 200 : 175;
    const P = (a, r) => [c[0] + r * Math.sin(a * R), c[1] - r * Math.cos(a * R)];
    const p1 = P(a1, Rr), p2 = P(a2, Rr);
    el('path', { d: `M${c[0]} ${c[1]}L${f1(p1[0])} ${f1(p1[1])}A${Rr} ${Rr} 0 0 1 ${f1(p2[0])} ${f1(p2[1])}Z`, fill: `url(#${id}f)`, class: 'gp-fan' }, gFan);
    for (const a of [a1, a2]) { const q = P(a, Rr + 14 * u); el('text', { x: f1(q[0]), y: f1(q[1]), class: 'gp-t-az', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, gFan, (a % 360) + '°'); }
    // что видно: подпись внутри веера, по середине сектора
    const q = P(azMain(v), Rr * 0.62);
    el('text', { x: f1(q[0]), y: f1(q[1]), class: 'gp-t-water gp-t-in', 'text-anchor': 'middle' }, gFan, v.water);
    // на запад у вилл с открытой водой: «до другого берега 4 км» (факт из TEKSTY), только в приближении
    if (mode === 'villa' && v.water === 'открытое озеро') {
      const a = Math.min(a2 - 14, Math.max(a1 + 14, 270)), w = P(a, Rr * 0.86);
      el('text', { x: f1(w[0]), y: f1(w[1]), class: 'gp-t-water gp-t-in', 'text-anchor': 'middle' }, gFan, 'до другого берега 4 км');
    }
  }
  // выноска выбранной виллы: сторона и длина выбираются так, чтобы не лечь на подписи соседей,
  // их участки и край кадра; при равенстве уходит от воды (в сторону, противоположную окнам)
  function callout(v) {
    gCall.textContent = '';
    if (!v || mode !== 'full' || opts.callout === false) return;
    const c = GEO[v.code].c, vb = svg.viewBox.baseVal;
    const view = [vb.x, vb.y, vb.x + vb.width, vb.y + vb.height];
    const shelf = 220 * u, up = 40 * u, down = 26 * u;
    const box = (P) => { const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
    const avoid = [
      ...VILLAS.filter((o) => o !== v).map((o) => [o.labelAt[0] - 4 * u, o.labelAt[1] - 22 * u, o.labelAt[0] + 96 * u, o.labelAt[1] + 20 * u, 3]),
      ...VILLAS.filter((o) => o !== v).map((o) => [...box(GEO[o.code].lot), 1]),
    ];
    const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const back = azMain(v) + 180, bx = Math.sin(back * R) >= 0 ? 1 : -1, by = -Math.cos(back * R) >= -0.2 ? 1 : -1;
    let best = null;
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const k of [46, 84]) {
      const L = k * u, ex = c[0] + sx * L, ey = c[1] + sy * L;
      const b = sx > 0 ? [ex, ey - up, ex + shelf, ey + down] : [ex - shelf, ey - up, ex, ey + down];
      const area = (b[2] - b[0]) * (b[3] - b[1]);
      let sc = avoid.reduce((t, a) => t + a[4] * ov(b, a) / area, 0);
      sc += 10 * (1 - ov(b, view) / area) + (k > 46 ? 0.3 : 0) + (sx !== bx ? 0.15 : 0) + (sy !== by ? 0.15 : 0);
      if (!best || sc < best.sc) best = { sc, sx, ex, ey };
    }
    const { sx, ex, ey } = best;
    el('circle', { cx: c[0], cy: c[1], r: 2.8 * u, class: 'gp-call-dot' }, gCall);
    el('path', { d: `M${c[0]} ${c[1]}L${f1(ex)} ${f1(ey)}h${f1(sx * shelf)}`, class: 'gp-call-ln' }, gCall);
    const tx = sx > 0 ? ex + 6 * u : ex - shelf + 6 * u;
    el('text', { x: f1(tx), y: f1(ey - 8 * u), class: 'gp-t-big' }, gCall, v.name);
    el('text', { x: f1(tx), y: f1(ey + 18 * u), class: 'gp-t-ann gp-t-callsub' }, gCall, `${v.area} м², ${v.beds} ${bedsWord(v.beds)}, ${statusWord(v)}`);
  }
  function active(code) {
    const v = VILLAS.find((x) => x.code === code) || null;
    cur = v;
    svg.classList.toggle('has-active', !!v);
    for (const k in lots) { const on = v && k === v.code; lots[k].classList.toggle('is-on', !!on); feet[k].classList.toggle('is-on', !!on); labels[k].classList.toggle('is-on', !!on); }
    if (mode === 'full') { fan(v); callout(v); }
    // подпись воды, которая повторяет подпись в веере, на время прячется
    for (const e of fixed) e.classList.toggle('is-dup', !!v && mode === 'full' && e.dataset.t === v.water);
  }

  // лучи солнца от виллы: сегодня, 22 июня, 22 декабря (для блока «Куда смотрят окна»)
  function sunRays(v, which = 'today', now = new Date()) {
    gSun.textContent = '';
    const c = GEO[v.code].c, side = azMain(v) < 180 ? 'riseAz' : 'setAz';
    const y = new Date(+now + 3 * 3600000).getUTCFullYear();
    const days = { today: sunTimes(now), june: sunTimes(capeDate(y, 6, 22, 12)), dec: sunTimes(capeDate(y, 12, 22, 12)) };
    const len = 150;
    for (const k of ['june', 'dec', 'today']) {
      const a = days[k][side];
      const q = [c[0] + len * Math.sin(a * R), c[1] - len * Math.cos(a * R)];
      el('path', { d: `M${c[0]} ${c[1]}L${f1(q[0])} ${f1(q[1])}`, class: `gp-ray gp-ray--${k}` + (k === which ? ' is-on' : '') }, gSun);
      if (k === which) el('circle', { cx: f1(q[0]), cy: f1(q[1]), r: 4 * u, class: 'gp-ray-sun' }, gSun);
    }
    return days;
  }

  // ---------- кадр ----------
  function fit() {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const [x0, y0, x1, y1] = ROI, w = x1 - x0, h = y1 - y0;
    const s = Math.min(r.width / w, r.height / h);
    const vw = r.width / s, vh = r.height / s;
    const ox = (opts.shift || [0, 0])[0] * (vw - w), oy = (opts.shift || [0, 0])[1] * (vh - h);
    const vx = x0 - (vw - w) / 2 + ox, vy = y0 - (vh - h) / 2 + oy;
    svg.setAttribute('viewBox', [vx, vy, vw, vh].map(f1).join(' '));
    u = 1 / s;
    svg.style.setProperty('--u', u);
    api.pxPerM = s * UPM;
    // зона касания: не меньше 44 px вокруг дома
    for (const k in lots) lots[k].querySelector('.gp-hit').setAttribute('r', f1(24 * u));
    // подписи вилл: имя и сотки двумя строками
    for (const k in labels) { const [nm, sub] = labels[k].children; nm.setAttribute('y', 0); sub.setAttribute('y', f1(15 * u)); }
    if (cur) { if (mode === 'full') { fan(cur); callout(cur); } }
    if (opts.onFit) opts.onFit(api);
  }

  // ---------- интерактив ----------
  if (mode === 'full' || mode === 'lite') {
    for (const v of VILLAS) {
      const a = lots[v.code];
      a.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { active(v.code); opts.onEnter && opts.onEnter(v); } });
      a.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { active(null); opts.onLeave && opts.onLeave(v); } });
      a.addEventListener('focus', () => { active(v.code); opts.onEnter && opts.onEnter(v); });
      a.addEventListener('blur', () => { active(null); opts.onLeave && opts.onLeave(v); });
      // касание: первое выбирает, второе открывает. Выбранность снимается в pointerdown, до фокуса:
      // на касании фокус приходит раньше клика и сам делает участок выбранным
      let down = null;
      a.addEventListener('pointerdown', (e) => { down = e.pointerType === 'mouse' ? null : !!(cur && cur.code === v.code); });
      a.addEventListener('click', (e) => {
        const first = down === false; down = null;
        if (first) { e.preventDefault(); active(v.code); opts.onEnter && opts.onEnter(v, 'touch'); return; }
        opts.onPick && opts.onPick(v, e);
      });
    }
  } else {
    gLots.setAttribute('aria-hidden', 'true');
    for (const k in lots) { lots[k].removeAttribute('href'); lots[k].setAttribute('tabindex', '-1'); }
  }

  const api = { active, fit, sunRays, fan, pxPerM: 1, el: { lots, labels, feet }, mode };
  if (mode === 'villa' && sel) { active(sel); fan(VILLAS.find((x) => x.code === sel)); }
  fit();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fit()).observe(svg);
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(fit);
  return api;
}

// контур дома в своих осях (для силуэтов в таблице и у соседей): стены, эркер, без террас
export function silhouette(code) {
  const p = PLANS[code];
  const polys = [...new Set(p.floors.flatMap((f) => f.shell.map((q) => JSON.stringify(q))))].map((q) => JSON.parse(q));
  if (p.floors[0].bay) polys.push(bayOuter(p.floors[0].bay));
  return polys;
}

// для проверки раскладки в node: зазоры между участками и расстояние от фасада до воды
export function layoutReport() {
  const out = [];
  const per = (P) => P.flatMap((p, i) => { const q = P[(i + 1) % P.length]; return Array.from({ length: 30 }, (_, k) => [p[0] + (q[0] - p[0]) * k / 30, p[1] + (q[1] - p[1]) * k / 30]); });
  for (let i = 0; i < VILLAS.length; i++) {
    const v = VILLAS[i], g = GEO[v.code];
    const wetLot = per(g.lot).filter(([x, y]) => !onLand(x, y)).length;
    const wetHouse = g.foot.flat().filter(([x, y]) => !onLand(x, y)).length;
    let toWater = 0; const a = azMain(v) * R;
    for (let d = 0; d < 400; d += 0.5) { const x = g.c[0] + d * Math.sin(a), y = g.c[1] - d * Math.cos(a); if (!onLand(x, y)) { toWater = d; break; } }
    let gap = null;
    if (i < VILLAS.length - 1) { const A = per(g.lot), B = per(GEO[VILLAS[i + 1].code].lot); gap = 1e9; for (const p of A) for (const q of B) gap = Math.min(gap, Math.hypot(p[0] - q[0], p[1] - q[1])); }
    out.push({ code: v.code, lotM2: Math.round(area(g.lot) / UPM / UPM), wetHouse, centerToWaterM: Math.round(toWater / UPM), gapToNextM: gap && Math.round(gap / UPM) });
  }
  return out;
}
