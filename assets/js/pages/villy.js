// Лист 03, Генплан (villy.html): генплан мыса, солнечная диаграмма, экспликация вилл, сравнение двух вилл.
// Общее (скролл, шторка, прелоадер) через site.js. Карта: villy-genplan.js. Планы: plans.js.
import { gsap, reduced, $, $$ } from '../site.js';
import { VILLAS, bedsWord, levelsWord, statusWord, imgSrc } from '../villas.js';
import { PLANS, renderPlan } from '../plans.js';
import { sunTimes, capeDate } from '../sun.js';
import { drawGenplan, silhouette } from './villy-genplan.js';

const R = Math.PI / 180;
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs, parent, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
const img = imgSrc;
const narrow = matchMedia('(max-width: 760px)');

/* ---------- экран 1: генплан ---------- */
const panel = $('#gpPanel');
const scaleEl = $('#gpScale');
function openPanel(v) {
  if (!panel) return;
  $('[data-p="name"]', panel).textContent = v.name;
  $('[data-p="facts"]', panel).textContent = `${v.area} м², ${v.beds} ${bedsWord(v.beds)}, ${statusWord(v)}`;
  const ph = $('[data-p="ph"]', panel);
  ph.replaceChildren(...[`${v.code}-ext`, ...v.gallery.map((g) => g.img).filter((n) => n !== `${v.code}-ext`)].slice(0, 3).map((n) => {
    const i = document.createElement('img'); i.src = img(n, true); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; return i;
  }));
  $('[data-p="go"]', panel).href = `villa.html?v=${v.code}`;
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
}
function closePanel() {
  if (!panel || panel.hidden) return;
  panel.classList.remove('is-open');
  setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 460);
}
if (panel) $('.gpx__panel-x', panel).addEventListener('click', () => { closePanel(); gp.active(null); });

const gpSvg = $('#gp');
const gp = drawGenplan(gpSvg, {
  mode: 'full',
  callout: !narrow.matches, small: narrow.matches,
  avoid: narrow.matches ? [] : [[-0.1, -0.1, 0.36, 0.42]], // под заголовком на воде подписи не ставим
  roi: narrow.matches ? [64, 140, 850, 690] : [30, 100, 900, 680],
  shift: narrow.matches ? [0, 0] : [0.18, 0],
  onEnter: (v, how) => { if (how === 'touch') openPanel(v); },
  onFit: (api) => { if (scaleEl) scaleEl.style.width = (100 * api.pxPerM).toFixed(1) + 'px'; },
});
// касание мимо участков закрывает панель
gpSvg.addEventListener('click', (e) => { if (!e.target.closest('.gp-lot')) { gp.active(null); closePanel(); } });

/* солнечная диаграмма: восход и закат 22 июня, в равноденствие и 22 декабря, азимуты по формуле */
const rose = $('#gpRose');
if (rose) {
  const days = [
    ['june', sunTimes(capeDate(2027, 6, 22, 12))],
    ['eq', sunTimes(capeDate(2027, 3, 20, 12))],
    ['dec', sunTimes(capeDate(2026, 12, 22, 12))],
  ];
  const r = 42;
  svgEl('circle', { cx: 0, cy: 0, r, class: 'rose-ring' }, rose);
  for (let a = 0; a < 360; a += 15) { const r1 = a % 90 ? r - 3 : r - 7; svgEl('line', { x1: r1 * Math.sin(a * R), y1: -r1 * Math.cos(a * R), x2: r * Math.sin(a * R), y2: -r * Math.cos(a * R), class: 'rose-tick' }, rose); }
  for (const [k, t] of days) for (const a of [t.riseAz, t.setAz]) svgEl('line', { x1: 0, y1: 0, x2: (r - 1) * Math.sin(a * R), y2: -(r - 1) * Math.cos(a * R), class: 'rose-sun' + (k === 'eq' ? ' rose-sun--eq' : '') }, rose);
  svgEl('path', { d: `M0 ${-r - 16}l4 12l-4 -3l-4 3z`, class: 'rose-n' }, rose);
  svgEl('text', { x: 0, y: -r - 19, class: 'rose-t' }, rose, 'С');
  const az = (n) => Math.round(n) + '°';
  // подписи диаграммы из макета DIZAJN, вычитаны копирайтером 27.10
  $('#sun-cap').innerHTML = days.map(([k, t]) => `<span class="${k === 'eq' ? 'eq' : ''}">${{ june: '22 июня', eq: '20 марта', dec: '22 декабря' }[k]}, восход ${az(t.riseAz)}, закат ${az(t.setAz)}</span>`).join('');
}

// вход: берег прочерчивается, сосны проявляются, затем участки и подписи (один раз)
if (!reduced) {
  const shore = $$('.gp-shore', gpSvg);
  shore.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
  const tl = gsap.timeline({ delay: 0.15 });
  tl.to(shore, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', onComplete: () => shore.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }) })
    .from($$('.gp-pine', gpSvg), { opacity: 0, duration: 0.5, stagger: { each: 0.0005, from: 'random' }, clearProps: 'opacity' }, 0.5)
    .from($$('.gp-lot-b, .gp-house', gpSvg), { opacity: 0, duration: 0.45, stagger: 0.06, clearProps: 'opacity' }, 1.1)
    .from($$('.gp-labels', gpSvg), { opacity: 0, duration: 0.4, clearProps: 'opacity' }, 1.4);
}

/* ---------- экран 2: экспликация ---------- */
// силуэт в общем масштабе 1:500 для всех вилл: один множитель на всех
const SIL_K = 64 / 30; // 30 м в 64 px: самый длинный дом (Топаз, 26,4 м с эркером) помещается
function silSvg(code, k = SIL_K) {
  const s = document.createElementNS(NS, 'svg');
  const polys = silhouette(code);
  const xs = polys.flat().map((p) => p[0]), ys = polys.flat().map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  s.setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`);
  s.setAttribute('width', (w * k).toFixed(1)); s.setAttribute('height', (h * k).toFixed(1));
  s.setAttribute('aria-hidden', 'true');
  for (const P of polys) svgEl('polygon', { points: P.map((p) => p.join(',')).join(' ') }, s);
  return s;
}
const body = $('#eksBody');
const ph = $('#eksPh'), phImg = $('#eksImg');
if (body) {
  VILLAS.forEach((v, i) => {
    const tr = document.createElement('tr');
    tr.dataset.v = v.code;
    tr.innerHTML = `<td><span class="eks__no">${i + 1}</span></td>`
      + `<td class="eks__name"><a href="villa.html?v=${v.code}">${v.name}</a></td>`
      + `<td class="eks__sil"></td>`
      + `<td class="num">${v.area}</td><td class="num">${v.levels}</td><td class="num">${v.beds}</td><td class="num">${v.sot}</td>`
      + `<td>${v.view}</td><td class="eks__st"><span class="status${v.res ? ' status--res' : ''}">${statusWord(v)}</span></td>`
      + `<td class="eks__meta">${v.area} м², ${statusWord(v)}</td>`
      + `<td class="eks__go"><i aria-hidden="true"></i></td>`;
    $('.eks__sil', tr).append(silSvg(v.code));
    const on = () => {
      $$('tr', body).forEach((r) => r.classList.toggle('is-on', r === tr));
      gp.active(v.code);
      if (ph && !narrow.matches) {
        phImg.src = img(`${v.code}-ext`, true);
        ph.style.top = (tr.offsetTop + tr.offsetHeight / 2 - 80) + 'px';
        ph.classList.add('is-on');
      }
    };
    const off = () => { tr.classList.remove('is-on'); gp.active(null); if (ph) ph.classList.remove('is-on'); };
    tr.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') on(); });
    tr.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') off(); });
    const a = $('a', tr);
    a.addEventListener('focus', on); a.addEventListener('blur', off);
    body.append(tr);
  });
}

/* ---------- экран 3: сравнение двух вилл ---------- */
const cmp = { a: 'kvarc', b: 'berill', mode: 'over' };
const MINUS = '−';
const signed = (n, s) => (n > 0 ? '+' : MINUS) + Math.abs(n) + s;
const ROWS = [
  ['площадь', (v) => v.area + ' м²', (a, b) => b.area - a.area, (d) => signed(d, ' м²')],
  ['этажей', (v) => String(v.levels), (a, b) => b.levels - a.levels, (d) => signed(d, ' ' + levelsWord(Math.abs(d)))],
  ['спален', (v) => String(v.beds), (a, b) => b.beds - a.beds, (d) => signed(d, ' ' + bedsWord(Math.abs(d)))],
  ['участок', (v) => v.plot, (a, b) => b.sot - a.sot, (d) => signed(d, ' сот.')],
  ['потолки', (v) => v.ceil, (a, b) => (a.ceil === b.ceil ? 0 : 1), () => ''],
  ['окна на', (v) => v.view, null, null],
  ['второй свет', (v) => (v.twoLight ? 'есть' : 'нет'), null, null],
];
function renderCmp() {
  const A = VILLAS.find((v) => v.code === cmp.a), B = VILLAS.find((v) => v.code === cmp.b);
  $$('.cmp__tabs').forEach((g) => $$('button', g).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === cmp[g.dataset.side]))));
  $('[data-c="a"]').textContent = A.name;
  $('[data-c="b"]').textContent = B.name;
  const same = A === B;
  $('#cmpSame').hidden = !same;
  $('#cmpBody').replaceChildren(...ROWS.map(([label, val, diff, fmt]) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th'); th.scope = 'row'; th.textContent = label;
    const ta = document.createElement('td'); ta.textContent = val(A);
    const tb = document.createElement('td'); tb.textContent = val(B);
    const differs = val(A) !== val(B);
    if (diff && !same) {
      const d = diff(A, B), sp = document.createElement('span');
      sp.className = 'cmp__d' + (d ? '' : ' cmp__d--eq');
      sp.textContent = d ? fmt(d) : 'столько же';
      if (fmt(d) !== '' || !d) tb.append(sp);
    }
    if (differs && !same) tb.classList.add('is-diff');
    tr.append(th, ta, tb);
    return tr;
  }));
  // планы первых этажей в одном масштабе, совмещены по северо-западному углу контура (0, 0)
  const sa = $('#cmpA'), sb = $('#cmpB');
  renderPlan(sa, A.code, 0, { interactive: false, orient: 'land' });
  renderPlan(sb, B.code, 0, { interactive: false, orient: 'land' });
  const ext = (code) => { const f = PLANS[code].floors[0]; return [...f.shell.flat(), ...(f.decks || []).flatMap((d) => d.p), ...(f.pools || []).flatMap((p) => p.p)]; };
  const all = [...ext(A.code), ...ext(B.code), [0, 0]];
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]), pad = 1;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
  for (const s of [sa, sb]) { s.setAttribute('viewBox', vb.map((n) => +n.toFixed(2)).join(' ')); s.setAttribute('aria-label', `План первого этажа, вилла «${s === sa ? A.name : B.name}»`); }
  $$('.cmp__cap').forEach((c) => c.remove());
  [[sa, A], [sb, B]].forEach(([s, v]) => { const c = document.createElement('p'); c.className = 'cmp__cap'; c.textContent = v.name; s.parentElement.append(c); });
  $('#cmpLegend').innerHTML = cmp.mode === 'over' && !same ? `<b>${A.name}</b> тёмным, <i>${B.name}</i> бронзовым пунктиром.` : '';
  cmpScale();
}
function cmpScale() {
  const s = $('#cmpA'), el = $('#cmpScale');
  const vb = (s.getAttribute('viewBox') || '').split(' ').map(Number);
  const w = s.getBoundingClientRect().width;
  if (vb.length === 4 && w) el.style.width = (5 * w / vb[2]).toFixed(1) + 'px';
}
$$('.cmp__tabs').forEach((g) => {
  for (const v of VILLAS) {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.v = v.code; b.textContent = v.name;
    b.addEventListener('click', () => { cmp[g.dataset.side] = v.code; renderCmp(); });
    g.append(b);
  }
  // стрелки внутри группы, как у радиокнопок
  g.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const i = VILLAS.findIndex((v) => v.code === cmp[g.dataset.side]);
    const n = (i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + VILLAS.length) % VILLAS.length;
    cmp[g.dataset.side] = VILLAS[n].code; renderCmp();
    $(`button[data-v="${VILLAS[n].code}"]`, g).focus();
  });
});
$$('.cmp__mode button').forEach((b) => b.addEventListener('click', () => {
  cmp.mode = b.dataset.m;
  $$('.cmp__mode button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  const sh = $('#cmpSheet');
  sh.classList.toggle('is-over', cmp.mode === 'over'); sh.classList.toggle('is-side', cmp.mode === 'side');
  renderCmp();
}));
if ($('#cmp')) {
  renderCmp();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(cmpScale).observe($('#cmpA'));
}
