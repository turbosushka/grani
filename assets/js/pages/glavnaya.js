// Лист 01, главная (index.html). Экран 1: кристалл gem.js (час из часов на мысе) и дуга солнца
// на сегодня, раз в минуту. Экран 2: свет по часам, одна гостиная в трёх светах, час идёт по
// прокрутке (на телефоне и при reduced-motion шкалу тянут). Пролёт в Кварц: видео перематывается
// прокруткой. Экран 3: генплан в лёгком режиме и экспликация. Экран 4: туман v1. Экран 5: ведомость.
import { gsap, ScrollTrigger, reduced, phone, ready, $, $$ } from '../site.js';
import { createGem } from '../gem.js';
import { sunPos, sunTimes, capeHM, hm } from '../sun.js';
import { VILLAS, bedsWord, statusWord } from '../villas.js';
import { T0, T1, MOMENTS, fmt, part, clamp, nearest, gemHour, blend, buildTicks, bindScale } from './svet.js';

const capeMin = (d = new Date()) => { const { h, m } = capeHM(d); return h * 60 + m; };
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (parent, tag, a, txt) => {
  const n = document.createElementNS(NS, tag);
  for (const k in a) n.setAttribute(k, a[k]);
  if (txt != null) n.textContent = txt;
  parent.appendChild(n); return n;
};

/* ---------- кристалл ---------- */
const canvas = $('#gem');
let gem = null;
try { gem = createGem(canvas, { reduced, mobile: phone }); }
catch (e) { console.warn('ГРАНИ: кристалл не запустился', e); }
if (!gem) { canvas.style.display = 'none'; document.documentElement.classList.add('no-gl'); } // нет WebGL

// положение кристалла на первом экране и куда он уходит при прокрутке (доли половины кадра).
// На телефоне кристалл над «ГРАНИ» (DIZAJN 5): под него оставлен верх первого экрана, см. glavnaya.css
const POS = phone
  ? { hero: { x: 0.14, y: 0.9, s: 0.32 }, away: { x: 0.5, y: 0.95, s: 0.26 } }
  : { hero: { x: 0.5, y: 0.27, s: 0.86 }, away: { x: 0.3, y: 0.15, s: 0.6 } };
const lerp = (a, b, t) => a + (b - a) * t;
const st = { hero: 0, out: 0 };
function updateGem() {
  if (!gem) return;
  const T = gem.target, h = st.hero, o = st.out;
  T.x = lerp(POS.hero.x, POS.away.x, h);
  T.y = lerp(POS.hero.y, POS.away.y, h) + o * 0.5;
  T.s = lerp(POS.hero.s, POS.away.s, h) * (1 - o * 0.4);
  T.rot = h * Math.PI * 0.9;
  T.tilt = lerp(0.9, 0.35, h);
  T.hour = gemHour(capeMin());              // тот же час, что у дуги солнца: сейчас на мысе
  T.alpha = Math.max(0, 1 - o - (phone ? h * 0.9 : 0));
  T.grid = lerp(0.5, 0.3, h) * (1 - o);
}
ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true,
  onUpdate: (s) => { st.hero = s.progress; updateGem(); } });
// на «свете по часам» кристалл уходит в прозрачность (DIZAJN 3.1, экран 2)
ScrollTrigger.create({ trigger: '#svet', start: 'top bottom', end: phone ? 'top 60%' : 'top 35%', scrub: true,
  onUpdate: (s) => { st.out = s.progress; updateGem(); } });
updateGem();
if (gem) gem.start();

/* ---------- дуга солнца на сегодня ---------- */
// по горизонтали азимут 30°–330° (крайние восход и закат за год), по вертикали высота;
// масштаб высоты подобран под сегодняшний полдень, числа в подписях настоящие
const arcSvg = $('#sunArcSvg'), arcNow = $('#sunArcNow'), stampSet = $('#stampSet');
const AW = phone ? 360 : 480, AH = 150, H0 = phone ? 100 : 104, AZ0 = 30, AZ1 = 330, PADX = phone ? 6 : 10;
const AX = (az) => PADX + ((clamp(az, AZ0, AZ1) - AZ0) / (AZ1 - AZ0)) * (AW - 2 * PADX);
let arcDrawn = false;
function drawArc() {
  if (!arcSvg) return;
  const now = new Date(), t = sunTimes(now), p = sunPos(now);
  const K = (H0 - 30) / Math.max(t.noonEl, 14);
  const AY = (el) => H0 - el * K;
  const night = p.el < -0.833;
  arcSvg.setAttribute('viewBox', `0 0 ${AW} ${AH}`);
  arcSvg.textContent = '';
  // горизонт, деления через 15°, стороны света
  svgEl(arcSvg, 'line', { class: 'sa-hor', x1: AX(AZ0), y1: H0, x2: AX(AZ1), y2: H0 });
  for (let a = AZ0; a <= AZ1; a += 15) {
    const big = a % 45 === 0;
    svgEl(arcSvg, 'line', { class: 'sa-tick' + (big ? ' sa-tick--b' : ''), x1: AX(a), y1: H0, x2: AX(a), y2: H0 + (big ? 7 : 4) });
  }
  [[90, 'В'], [180, 'Ю'], [270, 'З']].forEach(([a, l]) => svgEl(arcSvg, 'text', { class: 'sa-cmp', x: AX(a), y: H0 + 22 }, l));
  // путь солнца за день
  const pts = [];
  for (let ms = +t.rise; ms < +t.set; ms += 6 * 60000) { const q = sunPos(new Date(ms)); pts.push([AX(q.az), AY(Math.max(0, q.el))]); }
  pts.push([AX(t.setAz), H0]);
  const d = 'M' + AX(t.riseAz).toFixed(1) + ' ' + H0 + pts.map(([x, y]) => ' L' + x.toFixed(1) + ' ' + y.toFixed(1)).join('');
  svgEl(arcSvg, 'path', { class: 'sa-under', d: d + ' Z' });
  const arc = svgEl(arcSvg, 'path', { class: 'sa-arc' + (night ? ' sa-arc--night' : ''), d });
  // восход и закат
  svgEl(arcSvg, 'circle', { class: 'sa-end', cx: AX(t.riseAz), cy: H0, r: 3 });
  svgEl(arcSvg, 'circle', { class: 'sa-end', cx: AX(t.setAz), cy: H0, r: 3 });
  svgEl(arcSvg, 'text', { class: 'sa-t', x: AX(t.riseAz) - 8, y: H0 - 8, 'text-anchor': 'end' }, 'восход ' + hm(t.rise));
  svgEl(arcSvg, 'text', { class: 'sa-t', x: AX(t.setAz) + 8, y: H0 - 8 }, 'закат ' + hm(t.set));
  // солнце сейчас: над горизонтом на дуге, ночью под горизонтом
  const sx = AX(p.az), sy = night ? H0 + Math.min(-p.el, 14) * 1.6 + 8 : AY(Math.max(0, p.el));
  if (!night) svgEl(arcSvg, 'line', { class: 'sa-drop', x1: sx, y1: sy, x2: sx, y2: H0 });
  svgEl(arcSvg, 'circle', { class: 'sa-ring', cx: sx, cy: sy, r: 9 });
  svgEl(arcSvg, 'circle', { class: 'sa-sun', cx: sx, cy: sy, r: 4.5 });
  // подписи
  let line;
  if (!night) line = `сейчас ${hm(now)}, солнце ${Math.round(p.el)}° над горизонтом`;
  else {
    const next = now < t.rise ? t.rise : sunTimes(new Date(+now + 86400000)).rise; // после полуночи сегодняшний
    line = `сейчас ${hm(now)}, солнце встанет в ${hm(next)}`;
  }
  arcNow.textContent = line;
  arcSvg.setAttribute('aria-label', `Солнце над мысом сегодня: восход ${hm(t.rise)}, закат ${hm(t.set)}`);
  if (stampSet) stampSet.textContent = hm(t.set);
  if (!arcDrawn && !reduced) {
    arcDrawn = true;
    const len = arc.getTotalLength();
    gsap.fromTo(arc, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', delay: 0.3,
      onComplete: () => { arc.style.strokeDasharray = ''; arc.style.strokeDashoffset = ''; } });
  }
}
drawArc();
// раз в минуту, в начале минуты; заодно обновляем час кристалла
setTimeout(() => { drawArc(); updateGem(); setInterval(() => { drawArc(); updateGem(); }, 60000); }, (60 - new Date().getSeconds()) * 1000 + 50);

/* ---------- экран 2: свет по часам ---------- */
const lFrames = { frame: $('#lFrame'), den: $('#lDen'), vecher: $('#lVecher') };
const lScale = $('#lScale'), lThumb = $('#lThumb'), lHours = $$('#lHours li'), leads = $('#lLeads');
let lCur = MOMENTS[0].m;
function setLight(m) {
  lCur = clamp(Math.round(m), T0, T1);
  blend(lFrames, lCur);
  lThumb.style.left = (((lCur - T0) / (T1 - T0)) * 100).toFixed(3) + '%';
  lThumb.setAttribute('aria-valuenow', lCur);
  lThumb.setAttribute('aria-valuetext', fmt(lCur) + ', ' + part(lCur));
  const near = nearest(lCur), i = MOMENTS.indexOf(near);
  lHours.forEach((li, j) => li.classList.toggle('is-on', j === i));
  if (leads) $$('path', leads).forEach((p, j) => p.classList.toggle('on', j === i));
}
// выноски от отметок шкалы к строкам под ней
function drawLeads() {
  if (!leads || phone) return;
  const sb = lScale.getBoundingClientRect(), lb = leads.getBoundingClientRect();
  leads.setAttribute('viewBox', `0 0 ${lb.width.toFixed(0)} 18`);
  leads.textContent = '';
  MOMENTS.forEach((o, i) => {
    const mx = sb.left - lb.left + ((o.m - T0) / (T1 - T0)) * sb.width;
    const cx = lHours[i].getBoundingClientRect().left - lb.left + 1;
    svgEl(leads, 'path', { d: `M${mx.toFixed(1)} 0V8H${cx.toFixed(1)}V18` });
  });
  setLight(lCur);
}
if (lScale) {
  buildTicks($('#lTicks'), phone ? 240 : 120);
  if (!phone && !reduced) {
    // закреплён на 200vh: 06:00 → 07:40 (стоит) → 13:00 (стоит) → 20:15 (стоит) → 22:00
    const KF = [[0, T0], [0.1, MOMENTS[0].m], [0.22, MOMENTS[0].m], [0.45, MOMENTS[1].m], [0.56, MOMENTS[1].m], [0.8, MOMENTS[2].m], [0.9, MOMENTS[2].m], [1, T1]];
    const at = (p) => { for (let i = 1; i < KF.length; i++) if (p <= KF[i][0]) { const [p0, m0] = KF[i - 1], [p1, m1] = KF[i]; return m0 + (m1 - m0) * ((p - p0) / (p1 - p0 || 1)); } return T1; };
    lThumb.setAttribute('aria-hidden', 'true');
    ScrollTrigger.create({
      trigger: '#svet', start: 'top top', end: () => '+=' + Math.round(innerHeight * 2),
      pin: '.light__pin', pinSpacing: true, anticipatePin: 1,
      onUpdate: (s) => setLight(at(s.progress)),
    });
    setLight(T0);
  } else {
    // телефон и reduced-motion: шкалу тянут, клик ведёт бегунок
    lThumb.setAttribute('role', 'slider'); lThumb.tabIndex = 0;
    let anim = null;
    const to = (m, smooth) => {
      if (anim) anim.kill();
      if (!smooth || reduced) { setLight(m); return; }
      const o = { v: lCur }; anim = gsap.to(o, { v: m, duration: 0.45, ease: 'power3.out', onUpdate: () => setLight(o.v) });
    };
    bindScale(lScale, lThumb, { get: () => lCur, to });
    const nm = capeMin();
    setLight(nm >= T0 && nm <= T1 ? nm : MOMENTS[0].m);
  }
  drawLeads();
  addEventListener('resize', drawLeads);
  if (document.fonts) document.fonts.ready.then(drawLeads);
}

/* ---------- пролёт: видео на паузе, прокрутка задаёт цель, время догоняет её ---------- */
const flyV = $('#flyV'), flyBar = $('#flyBar');
if (flyV) {
  const s = { progress: 0, cur: 0, dur: 0, live: false };
  let loaded = false;
  const load = () => {
    if (loaded) return; loaded = true;
    flyV.poster = phone ? flyV.dataset.posterM : flyV.dataset.poster;
    flyV.src = phone ? flyV.dataset.srcM : flyV.dataset.src;
    flyV.preload = 'auto';
    flyV.load();
  };
  // грузим при подходе к секции, не на первом экране
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { load(); io.disconnect(); } }), { rootMargin: '60% 0px' });
  io.observe($('#prolet'));
  const meta = () => {
    s.dur = flyV.duration || 0;
    const p = flyV.play(); // будим декодер: iOS не рисует кадр до первого play
    if (p && p.then) p.then(() => flyV.pause()).catch(() => {}); else flyV.pause();
  };
  flyV.addEventListener('loadedmetadata', meta, { once: true });
  if (!reduced) {
    ScrollTrigger.create({
      trigger: '#prolet', start: 'top top', end: () => '+=' + Math.round(innerHeight * (phone ? 2.2 : 2.6)),
      pin: '.fly__pin', pinSpacing: true, anticipatePin: 1,
      onUpdate: (self) => { s.progress = self.progress; if (flyBar) flyBar.style.transform = `scaleX(${self.progress.toFixed(4)})`; },
      onToggle: (self) => { s.live = self.isActive; if (self.isActive) load(); },
    });
    // догоняем цель плавно; новый seek только когда прошлый закончился
    gsap.ticker.add(() => {
      if (!s.dur || flyV.readyState < 1) return;
      if (!flyV.paused) flyV.pause();
      const target = s.progress * (s.dur - 0.04), d = target - s.cur;
      if (Math.abs(d) < 0.001 && Math.abs(flyV.currentTime - target) < 0.002) return;
      const k = 1 - Math.pow(1 - 0.12, gsap.ticker.deltaRatio(60));
      s.cur = Math.abs(d) < 0.001 ? target : s.cur + d * k;
      const gap = Math.abs(s.cur - flyV.currentTime);
      if (!flyV.seeking && (gap > 1 / 48 || (s.cur === target && gap > 0.002))) flyV.currentTime = s.cur;
    });
  }
}

/* ---------- экран 3: генплан в лёгком режиме и экспликация ---------- */
const tbody = $('#expl tbody'), rows = {};
if (tbody) {
  VILLAS.forEach((v, i) => {
    const tr = document.createElement('tr');
    tr.dataset.v = v.code;
    tr.innerHTML = `<td><span class="expl__no">${i + 1}</span></td><td class="expl__name"><a href="villa.html?v=${v.code}">${v.name}</a></td>`
      + `<td class="r">${v.area}</td><td class="r">${v.beds}</td><td>${v.view}</td><td><span class="expl__st${v.res ? ' is-res' : ''}">${statusWord(v)}</span></td>`;
    tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.href = `villa.html?v=${v.code}`; });
    tbody.appendChild(tr); rows[v.code] = tr;
  });
}
const mark = (code) => Object.entries(rows).forEach(([k, tr]) => tr.classList.toggle('is-on', k === code));
// общий компонент генплана (лист 03) грузим отдельно и только при подходе к экрану (это ещё
// ~100 КБ с plans.js): если он упадёт, таблица останется рабочей
const gpIO = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { gpIO.disconnect(); loadGenplan(); } }, { rootMargin: '100% 0px' });
if ($('#gplSvg')) gpIO.observe($('#gplSvg'));
const loadGenplan = () => import('./villy-genplan.js').then(({ drawGenplan }) => {
  const svg = $('#gplSvg');
  if (!svg) return;
  const api = drawGenplan(svg, { mode: 'lite', onEnter: (v) => mark(v.code), onLeave: () => mark(null), onPick: (v) => { location.href = `villa.html?v=${v.code}`; } });
  Object.entries(rows).forEach(([code, tr]) => {
    tr.addEventListener('pointerenter', () => { api.active(code); mark(code); });
    tr.addEventListener('pointerleave', () => { api.active(null); mark(null); });
    tr.querySelector('a').addEventListener('focus', () => { api.active(code); mark(code); });
    tr.querySelector('a').addEventListener('blur', () => { api.active(null); mark(null); });
  });
  ScrollTrigger.refresh();
}).catch((e) => console.warn('ГРАНИ: генплан не загрузился', e));

/* ---------- экран 4: вода с трёх сторон (сцена v1) ---------- */
const mist = $('#mist');
if (mist) {
  let loaded = false;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) {
      if (!loaded) {
        $('#viewMedia').style.backgroundImage = `url(${phone ? mist.dataset.posterM : mist.dataset.poster})`;
        mist.src = phone ? mist.dataset.srcM : mist.dataset.src;
        mist.preload = 'auto'; loaded = true;
      }
      if (!reduced) mist.play().catch(() => {});
    } else if (loaded) mist.pause();
  }), { rootMargin: '300px 0px' });
  io.observe(mist);
  if (!reduced) {
    gsap.fromTo('#viewMedia', { clipPath: phone ? 'inset(6% 4% 6% 4%)' : 'inset(10% 8% 10% 8%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: '.view__stage', start: 'top 80%', end: 'top top', scrub: true } });
    gsap.from('.view__title .lm>span', { yPercent: 105, duration: 1.3, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: '.view__stage', start: 'top 45%', once: true } });
  } else $('#viewMedia').style.clipPath = 'none';
}

/* ---------- вход: «ГРАНИ» из маски, засечки цепочки по очереди ---------- */
ready.then(() => {
  if (reduced) return;
  gsap.from('.hero__title .lm>span', { yPercent: 100, duration: 0.8, ease: 'expo.out' });
  gsap.from('.hero__lead, .hero__cta', { y: 18, autoAlpha: 0, duration: 0.9, ease: 'expo.out', delay: 0.25, stagger: 0.08 });
  gsap.from('.hero__chain > div', { y: 12, autoAlpha: 0, duration: 0.7, ease: 'expo.out', delay: 0.35, stagger: 0.08 });
});
ScrollTrigger.sort();
ScrollTrigger.refresh();
