// Лист 02, Архитектура и материалы. Экран 1: фасад Берилла, четыре выноски по одной при прокрутке
// (на десктопе экран закреплён). Экран 2: ползунок времени суток, одна гостиная в трёх светах,
// солнце над мысом на 20 августа по формуле. Экран 3: планшет образцов, паспорт и лупа ×3.
import { gsap, ScrollTrigger, reduced, touch, phone, ready, $, $$ } from '../site.js';
import { sunPos, sunTimes, capeDate, capeYMD, capeHM, hm } from '../sun.js';
import { coverBox, placeLeaders } from './kadr.js';
import { T0, T1, MOMENTS, fmt, part, clamp, nearest, blend, buildTicks, bindScale } from './svet.js';

/* ---------- экран 1: фасад ---------- */
const photo = $('#fasadPhoto');
const leaders = $$('.fasad__ld');
const placeAll = () => { if (photo) placeLeaders(photo, leaders); };
placeAll();
addEventListener('resize', placeAll);
if (photo) $('img', photo).addEventListener('load', placeAll);

const showLeaders = (k) => leaders.forEach((l, i) => l.classList.toggle('is-on', i < k));
if (!phone && !reduced) {
  // экран закреплён на 150vh: первая выноска сразу, остальные по одной
  ready.then(() => showLeaders(1));
  ScrollTrigger.create({
    trigger: '#fasad', start: () => 'top ' + $('.hdr').offsetHeight, end: () => '+=' + Math.round(innerHeight * 1.5),
    pin: '.fasad__pin', pinSpacing: true, anticipatePin: 1,
    onUpdate: (s) => showLeaders(1 + Math.floor(Math.min(0.999, s.progress / 0.75) * 4)),
  });
} else if (reduced) showLeaders(4);
else ready.then(() => leaders.forEach((l, i) => setTimeout(() => l.classList.add('is-on'), 300 + i * 160)));

/* ---------- экран 2: ползунок времени суток ---------- */
// ближайшее 20 августа: в 2027 году закат 20:31, как в эталоне DIZAJN и в тексте копирайтера
const TODAY = capeYMD(new Date());
const YEAR = TODAY.m > 8 || (TODAY.m === 8 && TODAY.d > 20) ? TODAY.y + 1 : TODAY.y;
const AUG20 = sunTimes(capeDate(YEAR, 8, 20, 12));
const SET_MIN = (() => { const { h, m } = capeHM(AUG20.set); return h * 60 + m; })();

const scale = $('#tlScale'), thumb = $('#tlThumb'), ticks = $('#tlTicks');
const frames = { frame: $('#tlFrame'), den: $('#tlDen'), vecher: $('#tlVecher') };
let cur = 0, anim = null;
function setTime(m) {
  cur = clamp(Math.round(m), T0, T1);
  thumb.style.left = (((cur - T0) / (T1 - T0)) * 100).toFixed(3) + '%';
  $('#tlTime').textContent = fmt(cur);
  thumb.setAttribute('aria-valuenow', cur);
  thumb.setAttribute('aria-valuetext', fmt(cur) + ', ' + part(cur));
  blend(frames, cur);
  const s = sunPos(capeDate(YEAR, 8, 20, 0, cur));
  $('#tlSun').textContent = cur >= SET_MIN ? `солнце село в ${hm(AUG20.set)}`
    : `солнце ${Math.round(s.el)}° над горизонтом, азимут ${Math.round(s.az)}°`;
  // под шкалой строка ближайшего момента, меняется только строка солнца
  const near = nearest(cur), mo = $('#tlMoment');
  if (mo.dataset.m !== String(near.m)) { mo.dataset.m = near.m; mo.innerHTML = `<b>${fmt(near.m)}</b><span>${near.txt}</span>`; }
}
function goTo(m, smoothMove) {
  if (anim) anim.kill();
  if (!smoothMove || reduced) { setTime(m); return; }
  const o = { v: cur };
  anim = gsap.to(o, { v: m, duration: 0.45, ease: 'power3.out', onUpdate: () => setTime(o.v) });
}
if (scale) {
  buildTicks(ticks, phone ? 240 : 120);
  bindScale(scale, thumb, { get: () => cur, to: goTo });
  // старт с текущего часа на мысе, если он в 06–22, иначе 07:40
  const now = capeHM(new Date()), nm = now.h * 60 + now.m;
  setTime(nm >= T0 && nm <= T1 ? nm : MOMENTS[0].m);
}

/* ---------- экран 3: планшет образцов ---------- */
const MAT = {
  travertin: { n: 1, name: 'Травертин', from: 'Тиволи, под Римом', size: 'плиты толщиной 40 мм', work: 'шлифовка вручную', where: 'фасад, полы, ванные', line: 'Один камень снаружи и внутри, и дом выглядит цельным.' },
  steklo: { n: 2, name: 'Стекло', from: 'Германия', size: 'грани высотой 4,2 м, тройной стеклопакет', work: 'закалённое, с подогревом кромки', where: 'окна от пола до потолка, гранёные стены', line: 'Зимой стекло не запотевает.' },
  bronza: { n: 3, name: 'Бронза', from: 'мастерская в Петербурге', size: 'переплёт 38 мм', work: 'патинирование вручную', where: 'переплёты, перила, фурнитура', line: 'С годами только лучше.' },
  granit: { n: 4, name: 'Гранит', from: 'Карелия, местный камень', size: 'плиты 50 мм, ступени из цельных блоков', work: 'колотый на цоколе, обожжённый пламенем на ступенях, чтобы не скользили', where: 'цоколь, ступени, опоры террас', line: 'Тот же розовый камень, на котором стоит дом.' },
};
const board = $('#board'), loupe = $('#loupe'), pass = $('#pass');
const samples = $$('.smp');
let curMat = 'travertin', swapT;
function pick(code) {
  if (code === curMat) return;
  curMat = code;
  samples.forEach((s) => { const on = s.dataset.m === code; s.classList.toggle('is-on', on); s.setAttribute('aria-pressed', String(on)); });
  const d = MAT[code];
  const fill = () => {
    $('#passName').textContent = d.name; $('#passFrom').textContent = d.from; $('#passSize').textContent = d.size;
    $('#passWork').textContent = d.work; $('#passWhere').textContent = d.where; $('#passLine').textContent = d.line;
  };
  clearTimeout(swapT);
  if (reduced) { fill(); return; }
  pass.classList.add('is-swap');
  swapT = setTimeout(() => { fill(); pass.classList.remove('is-swap'); }, 180);
}

// лупа: круг с тем же макро в 3 раза крупнее; идёт за курсором с запаздыванием (lerp 0,2)
const ZOOM = 3;
const L = { on: false, smp: null, tx: 0, ty: 0, x: 0, y: 0, raf: 0 };
function loupePaint() {
  const s = L.smp; if (!s) return;
  const img = $('img', s), bb = board.getBoundingClientRect(), sb = s.getBoundingClientRect();
  const r = loupe.offsetWidth / 2;
  const c = coverBox(img, sb);
  // точка под центром лупы в координатах образца
  const px = L.x - (sb.left - bb.left + board.scrollLeft), py = L.y - (sb.top - bb.top);
  const u = (px - c.ox) / c.rw, v = (py - c.oy) / c.rh;
  loupe.style.left = L.x.toFixed(1) + 'px'; loupe.style.top = L.y.toFixed(1) + 'px';
  loupe.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
  loupe.style.backgroundSize = `${(c.rw * ZOOM).toFixed(1)}px ${(c.rh * ZOOM).toFixed(1)}px`;
  loupe.style.backgroundPosition = `${(r - u * c.rw * ZOOM).toFixed(1)}px ${(r - v * c.rh * ZOOM).toFixed(1)}px`;
}
function loupeTick() {
  L.raf = 0;
  const k = reduced ? 1 : 0.2;
  L.x += (L.tx - L.x) * k; L.y += (L.ty - L.y) * k;
  loupePaint();
  if (L.on && (Math.abs(L.tx - L.x) > 0.3 || Math.abs(L.ty - L.y) > 0.3)) L.raf = requestAnimationFrame(loupeTick);
}
// цель лупы: точка в координатах планшета, не дальше краёв образца
function loupeTarget(s, cx, cy, jump) {
  const bb = board.getBoundingClientRect(), sb = s.getBoundingClientRect();
  const x = clamp(cx, sb.left, sb.right) - bb.left + board.scrollLeft, y = clamp(cy, sb.top, sb.bottom) - bb.top;
  if (L.smp !== s) jump = true;
  L.smp = s; L.tx = x; L.ty = y;
  if (jump) { L.x = x; L.y = y; }
  if (!L.raf) L.raf = requestAnimationFrame(loupeTick);
}
const loupeShow = (on) => { L.on = on; loupe.classList.toggle('is-on', on); };

if (board && loupe) {
  samples.forEach((s) => {
    s.addEventListener('focus', () => pick(s.dataset.m));
    s.addEventListener('click', () => pick(s.dataset.m));
  });
  if (!touch) {
    samples.forEach((s) => {
      s.addEventListener('pointerenter', (e) => { pick(s.dataset.m); loupeTarget(s, e.clientX, e.clientY, true); loupeShow(true); });
      s.addEventListener('pointermove', (e) => loupeTarget(s, e.clientX, e.clientY));
      s.addEventListener('pointerleave', () => loupeShow(false));
    });
  } else {
    // касание ставит лупу, ведение пальцем двигает, второе касание прячет
    samples.forEach((s) => {
      let start = null, moved = false;
      s.addEventListener('pointerdown', (e) => { start = [e.clientX, e.clientY]; moved = false; });
      s.addEventListener('pointermove', (e) => {
        if (!start || !(L.on && L.smp === s)) return;
        if (Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) moved = true;
        loupeTarget(s, e.clientX, e.clientY);
      });
      s.addEventListener('pointerup', (e) => {
        if (!start) return;
        const tap = !moved && Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 8;
        start = null;
        if (!tap) return;
        if (L.on && L.smp === s) { loupeShow(false); s.style.touchAction = ''; return; }
        samples.forEach((o) => { o.style.touchAction = ''; });
        s.style.touchAction = 'none';     // пока лупа стоит, ведение пальцем двигает её, а не ленту
        loupeTarget(s, e.clientX, e.clientY, true); loupeShow(true);
      });
    });
    // лента: паспорт показывает образец, который сейчас в центре
    let st;
    board.addEventListener('scroll', () => {
      clearTimeout(st);
      st = setTimeout(() => {
        const mid = board.getBoundingClientRect().left + board.clientWidth / 2;
        const best = samples.reduce((a, b) => {
          const da = Math.abs(a.getBoundingClientRect().left + a.offsetWidth / 2 - mid), db = Math.abs(b.getBoundingClientRect().left + b.offsetWidth / 2 - mid);
          return db < da ? b : a;
        });
        pick(best.dataset.m);
        if (L.on && L.smp !== best) { loupeShow(false); samples.forEach((o) => { o.style.touchAction = ''; }); }
      }, 90);
    }, { passive: true });
  }
  addEventListener('resize', () => { if (L.on) loupeShow(false); });
}

ScrollTrigger.refresh();
