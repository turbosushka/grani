// Листы 04.1–04.5, страница виллы (villa.html?v=код). Пустой или неверный код → Кварц.
// Экраны: 1 фото с точками на фасаде и табличка · 2 галерея с лайтбоксом и описание ·
// пролёт камеры, если у виллы есть видео (villa-prolet.js) · 3 план (villa-plan.js) ·
// 4 «Куда смотрят окна» (генплан у виллы, villy-genplan.js) · 5 соседние виллы · 6 позвать на показ.
// Все цифры из данных: villas.js, plans.js (площади, номера помещений), sun.js (восход и закат).
import { gsap, reduced, lenis, scrollToEl, $, $$ } from '../site.js';
import { VILLAS, villaByCode, azMain, sunSide, bedsWord, levelsWord, statusWord, imgSrc, imgSet } from '../villas.js';
import { fmtArea } from '../plans.js';
import { sunTimes, capeDate, capeDay, hm, dur, capeHM } from '../sun.js';
import { drawGenplan, silhouette } from './villy-genplan.js';
import { initPlan } from './villa-plan.js';
import { initProlet } from './villa-prolet.js';

const v = villaByCode(new URLSearchParams(location.search).get('v'));
const idx = VILLAS.indexOf(v);
const html = document.documentElement;
const narrow = matchMedia('(max-width: 760px)');
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const NS = 'http://www.w3.org/2000/svg';
const DAY = 86400000;
const set = (key, text) => { const el = $(`[data-villa="${key}"]`); if (el) el.textContent = text; };
const split = (s) => { const m = /^([\d,]+)\s*(.*)$/.exec(s); return m ? [m[1], m[2]] : [s, '']; };

/* ---------- солнце для штампа, строки показа и «Куда смотрят окна» ---------- */
const now = new Date();
const today = sunTimes(now);
const tomorrow = sunTimes(new Date(+capeDay(now) + DAY + 12 * 3600000));
const side = sunSide(v); // 'rise' у вилл с окнами на восточную половину неба, 'set' у западных
const az = Math.round(azMain(v));

/* ---------- экран 1: подписи ---------- */
document.title = `Вилла «${v.name}» · ГРАНИ`;
set('name', v.name);
set('line', v.line);
set('sheet', `${v.sheet} из 07`);
set('view', `${v.view}, азимут ${az}°`);
set('sunk', side === 'rise' ? 'Восход завтра' : 'Закат завтра');
set('sunv', hm(side === 'rise' ? tomorrow.rise : tomorrow.set));
set('about', v.about);
set('okna', v.okna);
set('pname', v.name);
set('fsheet', `${v.sheet}, пролёт`);
set('fview', `${v.view}, азимут ${az}°`);
set('fwater', v.water);
const status = $('[data-villa="status"]');
status.textContent = statusWord(v);
status.classList.toggle('status--res', v.res);

// цепочка фактов: число и подпись согласуются («1 этаж», «5 спален»); у Агата седьмая ячейка
const cells = [
  [v.area, 'м²', 'площадь'],
  [v.levels, '', levelsWord(v.levels)],
  [v.beds, '', bedsWord(v.beds)],
  [...split(v.plot), 'участок'],
  [...split(v.ceil), 'потолки'],
  [v.view, '', 'окна на', true],
];
if (v.twoLight) cells.push(['два света', '', 'гостиная', true]);
$('[data-villa="chain"]').replaceChildren(...cells.map(([n, unit, label, word]) => {
  const div = document.createElement('div');
  const dt = document.createElement('dt'); dt.textContent = label;
  const dd = document.createElement('dd'); dd.textContent = n;
  if (word) dd.className = 'is-word';
  if (unit) { const i = document.createElement('i'); i.textContent = unit; dd.append(i); }
  div.append(dt, dd);
  return div;
}));

const book = $('[data-villa="book"]');
if (book) book.href = `pokaz.html?v=${v.code}`;
const nx = VILLAS[idx + 1];
const next = $('[data-villa="next"]');
if (next) {
  next.href = nx ? `villa.html?v=${nx.code}` : 'mesto.html';
  next.querySelector('.d2').textContent = nx ? `Лист ${nx.sheet}. ${nx.name}` : 'Лист 05. Место. Ситуационный план';
}
$$('a[href^="villa.html?v="]').forEach((a) => {
  if (a.closest('.vnb')) return;
  if (a.getAttribute('href') === `villa.html?v=${v.code}`) a.setAttribute('aria-current', 'page');
  else a.removeAttribute('aria-current');
});
html.classList.remove('v-wait');

/* ---------- пролёт: до плана, чтобы закрепление уже раздвинуло страницу, когда точки ведут к плану ---------- */
initProlet(v);

/* ---------- экран 3: план (раньше точек: точки ведут к нему) ---------- */
const plan = initPlan(v);
function goToRoom(no) {
  const fl = Number(no.split('.')[0]) - 1;
  plan.show(fl, no, { flash: true });
  scrollToEl($('#plan .vplan'), { duration: 1.1 });
  history.replaceState(null, '', `#pom-${no.replace('.', '-')}`);
}

/* ---------- экран 1: точки на фасаде ---------- */
const ph = $('#vPh'), img = $('#vImg'), layer = $('#vHs'), sheet = $('#vHsSheet');
const spots = narrow.matches ? v.hotspots.slice(0, 3) : v.hotspots;
let open = null, co = null, coLn = null;

function media(h, small) {
  const box = document.createElement('span');
  box.className = 'co__media';
  if (h.photo) { const i = document.createElement('img'); i.src = imgSrc(h.photo, true); i.alt = ''; i.decoding = 'async'; box.append(i); }
  else { const s = document.createElementNS(NS, 'svg'); box.append(s); plan.cut(s, h.no); }
  return box;
}
function panelHTML(h, rm, phone) {
  const wrap = document.createDocumentFragment();
  wrap.append(media(h));
  const nm = document.createElement('p'); nm.className = 'co__nm';
  nm.innerHTML = `<span></span><i>${fmtArea(rm.a)} м²</i>`; nm.firstChild.textContent = rm.n;
  const sub = document.createElement('p'); sub.className = 'co__sub'; sub.textContent = h.sub;
  const fl = h.no.split('.')[0];
  const go = phone ? document.createElement('button') : document.createElement('span');
  go.className = 'co__go';
  if (phone) { go.type = 'button'; go.textContent = 'На плане'; go.addEventListener('click', () => goToRoom(h.no)); }
  else go.textContent = `${fl} этаж, открыть на плане`;
  wrap.append(nm, sub, go);
  return wrap;
}
const buttons = spots.map((h) => {
  const rm = plan.room(h.no);
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'hs';
  b.innerHTML = `<i></i><b>${h.no}</b>`;
  b.setAttribute('aria-label', `${rm ? rm.n : ''}, ${h.no}. ${h.sub}. Открыть на плане`);
  b._h = h; b._rm = rm;
  if (fine) {
    b.addEventListener('pointerenter', () => showCo(b));
    b.addEventListener('pointerleave', (e) => { if (!co || !co.contains(e.relatedTarget)) hideCo(); });
    b.addEventListener('focus', () => showCo(b));
    b.addEventListener('blur', () => hideCo());
    b.addEventListener('click', () => goToRoom(h.no));
  } else {
    // касание: первое открывает панель под фото, второе ведёт к плану
    b.addEventListener('click', () => { if (open === b) goToRoom(h.no); else showSheet(b); });
  }
  layer.append(b);
  return b;
});

function place() {
  const W = ph.clientWidth, H = ph.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !W) return;
  const k = Math.max(W / nw, H / nh), dw = nw * k, dh = nh * k;
  const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((s) => parseFloat(s) / 100);
  const ox = (W - dw) * px, oy = (H - dh) * py;
  for (const b of buttons) {
    const x = ox + b._h.x / 100 * dw, y = oy + b._h.y / 100 * dh;
    b.style.left = x + 'px'; b.style.top = y + 'px';
    b._xy = [x, y];
    // точка, ушедшая за край кадрирования, прячется (с запасом под номер)
    b.hidden = x < 16 || x > W - 60 || y < 16 || y > H - 16;
  }
  if (co && open) showCo(open);
}
function showCo(b) {
  hideCo();
  open = b; b.classList.add('is-on');
  const W = ph.clientWidth, H = ph.clientHeight, [x, y] = b._xy;
  const left = x > W / 2, up = y + 46 + 300 > H && y - 46 - 300 > 0;
  const dx = left ? -1 : 1, dy = up ? -1 : 1, shelf = 120;
  coLn = document.createElement('span'); coLn.className = 'co-ln'; coLn.style.left = x + 'px'; coLn.style.top = y + 'px';
  const d = `M0 0L${dx * 46} ${dy * 46}H${dx * (46 + shelf)}`;
  coLn.innerHTML = `<svg width="1" height="1"><path d="${d}" fill="none" stroke="rgba(26,28,30,.35)" stroke-width="2.2"/><path d="${d}" fill="none" stroke="#FBFAF7" stroke-width="1"/><circle r="2.5" fill="#9C7C4D"/></svg>`;
  co = document.createElement('div'); co.className = 'co';
  co.append(panelHTML(b._h, b._rm, false));
  const cx = left ? x - 46 - shelf - 236 : x + 46 + shelf;
  co.style.left = Math.max(8, Math.min(W - 244, cx)) + 'px';
  layer.append(coLn, co);
  const ch = co.offsetHeight;
  co.style.top = Math.max(8, Math.min(H - ch - 8, up ? y - 46 - ch + 14 : y + 46 - 14)) + 'px';
  co.addEventListener('pointerleave', (e) => { if (e.relatedTarget !== b && !b.contains(e.relatedTarget)) hideCo(); });
  co.addEventListener('click', () => goToRoom(b._h.no));
  if (!reduced) gsap.from(co, { opacity: 0, y: 6, duration: 0.25, ease: 'power2.out' });
}
function hideCo() {
  if (open) open.classList.remove('is-on');
  open = null;
  if (co) { co.remove(); co = null; }
  if (coLn) { coLn.remove(); coLn = null; }
}
function showSheet(b) {
  buttons.forEach((x) => x.classList.toggle('is-on', x === b));
  open = b;
  sheet.replaceChildren(panelHTML(b._h, b._rm, true));
  sheet.hidden = false;
}
if (img.complete && img.naturalWidth) place(); else img.addEventListener('load', place, { once: true });
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(place).observe(ph);
// точки появляются через 600 мс после входа
setTimeout(() => layer.classList.add('is-in'), reduced ? 0 : 600);
// вход: имя из маски, засечки цепочки по очереди
if (!reduced) {
  gsap.from('#villa .d1', { yPercent: 40, opacity: 0, duration: 0.7, ease: 'power3.out', clearProps: 'all' });
  gsap.from('#villa .chain > div', { opacity: 0, duration: 0.4, stagger: 0.08, delay: 0.2, clearProps: 'opacity' });
}

/* ---------- экран 2: галерея и лайтбокс ---------- */
const gal = $('#gal');
const shots = v.gallery;
shots.forEach((g, i) => {
  const f = document.createElement('figure');
  f.className = 'gal__f gal__f--' + 'abc'[i];
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', `Открыть фото ${i + 1} из ${shots.length}: ${g.cap}`);
  const im = document.createElement('img');
  im.loading = 'lazy'; im.decoding = 'async'; // до src, иначе кадр качается сразу
  // браузер сам берёт лёгкую или полную версию по ширине кадра и плотности экрана
  im.sizes = ['(max-width: 760px) 100vw, 62vw', '(max-width: 760px) 100vw, 30vw', '(max-width: 760px) 100vw, 54vw'][i];
  im.srcset = imgSet(g.img); im.src = imgSrc(g.img, true);
  im.alt = g.cap;
  if (g.pos) im.style.objectPosition = g.pos;
  b.append(im);
  b.addEventListener('click', () => openLb(i, im));
  const c = document.createElement('figcaption'); c.textContent = g.cap;
  f.append(b, c);
  gal.append(f);
});
const about = $('.gal__about');
if (about) { gal.append(about); about.classList.add(shots.length > 2 ? 'gal__about--c' : 'gal__about--2'); }

let lb = null, lbI = 0, lbFrom = null;
function buildLb() {
  lb = document.createElement('div');
  lb.className = 'lb'; lb.hidden = true;
  lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Фотографии виллы');
  lb.innerHTML = `<div class="lb__bar"><span class="lb__count"></span><button class="lb__x" type="button" aria-label="Закрыть"><i></i><i></i></button></div>
    <div class="lb__stage"><img class="lb__img" alt=""></div>
    <div class="lb__foot"><p class="lb__cap"></p><div class="lb__nav"><button type="button" data-d="-1" aria-label="Предыдущее фото"></button><button type="button" data-d="1" aria-label="Следующее фото"></button></div></div>`;
  document.body.append(lb);
  $('.lb__x', lb).addEventListener('click', closeLb);
  $$('.lb__nav button', lb).forEach((b) => b.addEventListener('click', () => step(+b.dataset.d)));
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLb();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Tab') { // фокус не выходит из окна
      const f = $$('button', lb), a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  // свайп
  let sx = null;
  const st = $('.lb__stage', lb);
  st.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  st.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 50) step(e.clientX < sx ? 1 : -1); sx = null; });
  st.addEventListener('click', (e) => { if (e.target === st) closeLb(); });
}
function fill(i) {
  lbI = (i + shots.length) % shots.length;
  const g = shots[lbI];
  const im = $('.lb__img', lb);
  im.src = imgSrc(g.img, narrow.matches); im.alt = g.cap;
  $('.lb__cap', lb).textContent = g.cap;
  $('.lb__count', lb).textContent = `${lbI + 1} из ${shots.length}`;
  return im;
}
function openLb(i, from) {
  if (!lb) buildLb();
  lbFrom = from;
  const im = fill(i);
  lb.hidden = false;
  if (lenis) lenis.stop(); else html.style.overflow = 'hidden';
  $('.lb__x', lb).focus();
  if (reduced) return;
  // открытие из миниатюры: кадр летит из своего места (FLIP, 500 мс)
  const go = () => {
    const a = from.getBoundingClientRect(), b = im.getBoundingClientRect();
    if (!b.width) return;
    gsap.fromTo(im, { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2), scale: Math.max(a.width / b.width, a.height / b.height) },
      { x: 0, y: 0, scale: 1, duration: 0.5, ease: 'power3.inOut', clearProps: 'transform' });
    gsap.from([$('.lb__bar', lb), $('.lb__foot', lb)], { opacity: 0, duration: 0.3, delay: 0.25, clearProps: 'opacity' });
  };
  if (im.complete && im.naturalWidth) go(); else im.addEventListener('load', go, { once: true });
}
function step(d) {
  const im = fill(lbI + d);
  if (!reduced) gsap.from(im, { opacity: 0, x: d * 24, duration: 0.35, ease: 'power2.out', clearProps: 'all' });
}
function closeLb() {
  lb.hidden = true;
  if (lenis) lenis.start(); else html.style.overflow = '';
  const btns = $$('.gal__f button');
  (btns[lbI] || lbFrom && lbFrom.parentElement || btns[0]).focus({ preventScroll: true });
}

/* ---------- экран 4: куда смотрят окна ---------- */
const map = drawGenplan($('#vMap'), {
  mode: 'villa', sel: v.code,
  onFit: (api) => { $('#vMapScale').style.width = (100 * api.pxPerM).toFixed(1) + 'px'; },
});
const ev = side === 'rise' ? 'rise' : 'set';
const evAz = side === 'rise' ? 'riseAz' : 'setAz';
const days = map.sunRays(VILLAS.find((x) => x.code === v.code), 'today', now);
const word = side === 'rise' ? 'восход' : 'закат';
const LINES = { today: 'Сегодня', june: '22 июня', dec: '22 декабря' };
function sunLine(k) {
  const t = days[k];
  $('#vSunLine').textContent = `${LINES[k]} ${word} в ${hm(t[ev])}, азимут ${Math.round(t[evAz])}°`;
  map.sunRays(v, k, now);
  $$('#vSunTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.d === k)));
}
$$('#vSunTabs button').forEach((b) => b.addEventListener('click', () => sunLine(b.dataset.d)));
sunLine('today');
// таблица: окна на · азимут · восход или закат сегодня · самый длинный день (21 июня, по формуле)
const longest = sunTimes(capeDate(new Date(+now + 3 * 3600000).getUTCFullYear(), 6, 21, 12));
$('#vOknaT').innerHTML = [
  ['окна на', v.view],
  ['азимут', `${az}°`],
  [side === 'rise' ? 'восход сегодня' : 'закат сегодня', hm(today[ev])],
  ['самый длинный день', dur(longest.len)],
].map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('');

/* ---------- экран 5: соседи по кругу ---------- */
const nb = $('#vNb');
const sil = (code) => {
  const s = document.createElementNS(NS, 'svg'), polys = silhouette(code);
  const xs = polys.flat().map((p) => p[0]), ys = polys.flat().map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0, k = 64 / 30;
  s.setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`); s.setAttribute('width', (w * k).toFixed(1)); s.setAttribute('height', (h * k).toFixed(1));
  s.setAttribute('class', 'vnb__sil'); s.setAttribute('aria-hidden', 'true');
  for (const P of polys) { const p = document.createElementNS(NS, 'polygon'); p.setAttribute('points', P.map((q) => q.join(',')).join(' ')); s.append(p); }
  return s;
};
[VILLAS[(idx + VILLAS.length - 1) % VILLAS.length], VILLAS[(idx + 1) % VILLAS.length]].forEach((n) => {
  const a = document.createElement('a');
  a.className = 'vnb__a'; a.href = `villa.html?v=${n.code}`;
  a.innerHTML = `<span class="vnb__ph"><img src="${imgSrc(n.code + '-ext', true)}" alt="" loading="lazy" decoding="async"></span>`
    + `<span class="vnb__meta"><span class="tech">Лист ${n.sheet}</span><span class="d2">${n.name}</span><i class="vnb__tick" aria-hidden="true"></i></span>`;
  $('.vnb__meta', a).insertBefore(sil(n.code), $('.vnb__tick', a));
  nb.append(a);
});

/* ---------- экран 6: позвать на показ ---------- */
// приезд: закат минус 75 минут, вниз до :00 или :30 (как в календаре показа)
const arrive = (set) => { const { h, m } = capeHM(new Date(+set - 75 * 60000)); return `${String(h).padStart(2, '0')}:${m >= 30 ? '30' : '00'}`; };
// летом восход раньше семи, а показ начинается с 07:00 (как в календаре показа)
const early = capeHM(tomorrow.rise).h < 7;
$('#vBookLine').textContent = side === 'rise'
  ? (early
    ? `Завтра солнце встанет в ${hm(tomorrow.rise)}. Встретим вас у ворот в семь и покажем дом в утреннем свете.`
    : `Завтра солнце встанет в ${hm(tomorrow.rise)}. Покажем дом на восходе.`)
  :`Завтра солнце сядет в ${hm(tomorrow.set)}. Встретим вас у ворот в ${arrive(tomorrow.set)} и покажем дом на закате.`;

/* ---------- адрес вида #pom-1-8: сразу к помещению ---------- */
const m = /^#pom-(\d+)-(\d+)$/.exec(location.hash);
if (m) {
  const no = `${m[1]}.${m[2]}`;
  if (plan.room(no)) setTimeout(() => goToRoom(no), 300);
}
