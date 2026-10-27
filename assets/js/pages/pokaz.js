// Лист 07, частный показ. Календарь на 21 день с завтрашнего (в ячейке закат и черта длины дня),
// выбор света, панель солнца выбранного дня, строка «Четверг, 29 октября. Закат в 16:47,
// встретим вас у ворот в 15:30», форма с днём и светом в скрытых полях, демо-подтверждение.
// Вилла из ?v=код выбрана в форме. Всё время считается формулой солнца (sun.js), руками не вписано.
import { gsap, reduced, phone, $, $$ } from '../site.js';
import { VILLAS } from '../villas.js';
import { sunPos, sunTimes, capeDay, capeYMD, capeHM, hm, dur, MONTHS_GEN } from '../sun.js';

const DAY = 86400000, MIN = 60000;
const DOW = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DOW_V = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
const MON_S = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const NS = 'http://www.w3.org/2000/svg';

const form = $('#form');
const sel = $('#fVilla');

// ?v=opal выбирает Опал; неверный или пустой код оставляет «Все виллы»
const code = new URLSearchParams(location.search).get('v');
if (sel && VILLAS.some((v) => v.code === code)) sel.value = code;

/* ---------- дни: завтра и ещё 20 ---------- */
const today = capeDay(new Date());
const tomorrow = new Date(+today + DAY);
const days = Array.from({ length: 21 }, (_, i) => {
  const date = new Date(+tomorrow + i * DAY);
  const ymd = capeYMD(date);
  return { date, ymd, t: sunTimes(new Date(+date + 12 * 3600000)), iso: `${ymd.y}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}` };
});
const dateTxt = (ymd) => ymd.d + ' ' + MONTHS_GEN[ymd.m - 1];
const isTomorrow = (day) => day === days[0];

// приезд: утром восход вниз до :00 или :30, но не раньше 07:00; днём 11:00; на закате закат − 75 мин вниз до :00/:30
const floorHalf = (date) => { const { h, m } = capeHM(date); return h * 60 + (m >= 30 ? 30 : 0); };
const fmtMin = (x) => String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
function arrival(day, light) {
  if (light === 'utro') return fmtMin(Math.max(7 * 60, floorHalf(day.t.rise)));
  if (light === 'den') return '11:00';
  return fmtMin(floorHalf(new Date(+day.t.set - 75 * MIN)));
}
// окно света на дуге (моменты): утро 2 ч от восхода (не раньше 07:00), день 11:00–14:00, закат от заката −1,5 ч
function windowOf(day, light) {
  // утро от восхода, но не раньше приезда в 07:00 (летом восход около трёх ночи)
  if (light === 'utro') { const a = new Date(Math.max(+day.t.rise, +day.date + 7 * 3600000)); return [a, new Date(+a + 2 * 3600000)]; }
  if (light === 'den') return [new Date(+day.date + 11 * 3600000), new Date(+day.date + 14 * 3600000)];
  return [new Date(+day.t.set - 90 * MIN), day.t.set];
}
const windowTxt = (day, light) => {
  const [a, b] = windowOf(day, light);
  return { utro: 'утро ', den: 'день ', zakat: 'закат ' }[light] + hm(a) + '–' + hm(b);
};
function dayLine(day, light) {
  const head = (isTomorrow(day) ? 'Завтра' : DOW[day.ymd.wd]) + ', ' + dateTxt(day.ymd) + '. ';
  if (light === 'utro') return head + `Восход в ${hm(day.t.rise)}, встретим вас у ворот в ${arrival(day, light)}.`;
  if (light === 'den') return head + `Солнце выше всего в ${hm(day.t.noon)}, встретим вас у ворот в 11:00.`;
  return head + `Закат в ${hm(day.t.set)}, встретим вас у ворот в ${arrival(day, light)}.`;
}

/* ---------- штамп: закат завтра ---------- */
const stampSet = $('#stampSet');
if (stampSet) stampSet.textContent = hm(days[0].t.set);

/* ---------- календарь ---------- */
const grid = $('#calGrid');
const months = $('#calMonths');
let cur = null, light = null;
const btns = [];
if (grid) {
  const lead = (days[0].ymd.wd + 6) % 7;                       // сколько дней недели до завтрашнего (Пн = 0)
  const cells = Math.ceil((lead + days.length) / 7) * 7;
  const start = +tomorrow - lead * DAY;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < cells; i++) {
    const date = new Date(start + i * DAY), ymd = capeYMD(date);
    const day = days.find((d) => d.ymd.d === ymd.d && d.ymd.m === ymd.m);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'day';
    let html = `<span class="day__n">${ymd.d}</span>`;
    if (day) {
      if (ymd.d === 1 || day === days[0]) html += `<span class="day__m">${MON_S[ymd.m - 1]}</span>`;
      html += `<span class="day__s">${hm(day.t.set)}</span><i class="day__len" style="--len:${(day.t.len / 1440).toFixed(4)}"></i>`;
      b.setAttribute('aria-label', `${isTomorrow(day) ? 'Завтра' : DOW[ymd.wd]}, ${dateTxt(ymd)}. Закат в ${hm(day.t.set)}, день ${dur(day.t.len)}.`);
      b.setAttribute('aria-pressed', 'false');
      b.tabIndex = btns.length ? -1 : 0;
      b._day = day; btns.push(b);
    } else {
      b.disabled = true;
      b.setAttribute('aria-label', `${dateTxt(ymd)}, недоступно`);
    }
    b.innerHTML = html;
    frag.appendChild(b);
  }
  grid.appendChild(frag);
  if (months) months.textContent = dateTxt(days[0].ymd) + ' – ' + dateTxt(days[days.length - 1].ymd);

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.day');
    if (b && !b.disabled) pickDay(b);
  });
  // стрелки по дням, вверх-вниз по неделям (один таб-стоп на весь календарь)
  grid.addEventListener('keydown', (e) => {
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let j = i;
    if (step) j = Math.max(0, Math.min(btns.length - 1, i + step));
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = btns.length - 1;
    else return;
    e.preventDefault();
    btns[i].tabIndex = -1; btns[j].tabIndex = 0; btns[j].focus();
  });
}

function pickDay(b) {
  btns.forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
  cur = b._day;
  $('#fDay').value = cur.iso;
  $('#calErr').hidden = true;
  render(true);
}

/* ---------- свет ---------- */
const tabs = $$('#lightTabs [data-light]');
function pickLight(t, focus) {
  tabs.forEach((x) => { x.setAttribute('aria-checked', String(x === t)); x.tabIndex = x === t ? 0 : -1; });
  light = t.dataset.light;
  $('#fLight').value = light;
  $('#lightErr').hidden = true;
  if (focus) t.focus();
  render(false);
}
tabs.forEach((t, i) => {
  t.tabIndex = i ? -1 : 0;
  t.addEventListener('click', () => pickLight(t));
  t.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    pickLight(tabs[(i + step + tabs.length) % tabs.length], true);
  });
});

/* ---------- панель солнца ---------- */
const svg = $('#sunSvg'), line = $('#sunLine');
const W = phone ? 380 : 800, HOR = phone ? 136 : 150, L = phone ? 8 : 14, Rr = phone ? 8 : 14, HGT = HOR + 46;
const ELMAX = Math.max(...days.map((d) => d.t.noonEl));  // шкала высоты одна на все 21 день: дни сравнимы
const K = (HOR - 44) / ELMAX;
const X = (date) => L + ((+date - +capeDay(date)) / DAY) * (W - L - Rr);
const Y = (date) => HOR - Math.max(0, sunPos(date).el) * K;
const el = (tag, a, txt) => { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); if (txt != null) n.textContent = txt; svg.appendChild(n); return n; };
function arcPath(a, b) {
  const pts = [];
  for (let t = +a; t < +b; t += 6 * MIN) pts.push(new Date(t));
  pts.push(b);
  return pts.map((p, i) => (i ? 'L' : 'M') + X(p).toFixed(1) + ' ' + Y(p).toFixed(1)).join(' ');
}

function render(newDay) {
  if (!svg) return;
  svg.setAttribute('viewBox', `0 0 ${W} ${HGT}`);
  svg.textContent = '';
  // горизонт и часы: деление каждый час, подпись через 3 ч (на телефоне через 6)
  el('line', { class: 'sp-hor', x1: L, y1: HOR, x2: W - Rr, y2: HOR });
  for (let h = 0; h <= 24; h++) {
    const x = L + (h / 24) * (W - L - Rr), big = h % 3 === 0;
    el('line', { class: 'sp-tick' + (big ? ' sp-tick--b' : ''), x1: x, y1: HOR, x2: x, y2: HOR + (big ? 7 : 4) });
    if (h % (phone ? 6 : 3) === 0 && h > 0 && h < 24) el('text', { class: 'sp-hour', x, y: HGT - 4 }, String(h).padStart(2, '0') + ':00');
  }
  if (!cur) {
    // пустое состояние: пунктирная дуга без чисел
    const t = days[0].t;
    el('path', { class: 'sp-arc sp-arc--empty', d: arcPath(t.rise, t.set) });
    line.textContent = 'Выберите день в календаре, и мы покажем восход и закат на эту дату.';
    svg.setAttribute('aria-label', 'Дуга солнца появится, когда вы выберете день');
    return;
  }
  const t = cur.t;
  const under = arcPath(t.rise, t.set) + ` L${X(t.set).toFixed(1)} ${HOR} L${X(t.rise).toFixed(1)} ${HOR} Z`;
  el('path', { class: 'sp-under', d: under });
  const arc = el('path', { class: 'sp-arc', d: arcPath(t.rise, t.set) });
  if (light) {
    const [a, b] = windowOf(cur, light);
    const seg = arcPath(a, b);
    el('path', { class: 'sp-winfill', d: seg + ` L${X(b).toFixed(1)} ${HOR} L${X(a).toFixed(1)} ${HOR} Z` });
    el('path', { class: 'sp-win', d: seg });
    [a, b].forEach((p) => el('line', { class: 'sp-wl', x1: X(p), y1: Y(p), x2: X(p), y2: HOR }));
    // подпись окна над дугой: высота по самой высокой точке дуги под всей шириной подписи
    const txt = windowTxt(cur, light), half = txt.length * 3.3 + 6;
    const mx = Math.min(W - Rr - half, Math.max(L + half, (X(a) + X(b)) / 2));
    let top = Math.min(Y(a), Y(b));
    for (let p = +t.rise; p <= +t.set; p += 5 * MIN) { const x = X(new Date(p)); if (x >= mx - half && x <= mx + half) top = Math.min(top, Y(new Date(p))); }
    el('text', { class: 'sp-t sp-t--b', x: mx, y: top - 10, 'text-anchor': 'middle' }, txt);
  }
  // восход и закат: точки на горизонте, подписи у концов дуги; длина дня под горизонтом
  [[t.rise, 'end', -8, 'восход '], [t.set, 'start', 8, 'закат ']].forEach(([p, anchor, dx, w]) => {
    el('circle', { class: 'sp-dot', cx: X(p), cy: HOR, r: 3 });
    el('text', { class: 'sp-t', x: X(p) + dx, y: HOR - 8, 'text-anchor': anchor }, w + hm(p));
  });
  el('text', { class: 'sp-t', x: X(t.noon), y: HOR + 24, 'text-anchor': 'middle' }, 'день ' + dur(t.len));

  line.textContent = light ? dayLine(cur, light) : 'Выберите, когда смотреть свет.';
  svg.setAttribute('aria-label', `${dateTxt(cur.ymd)}: восход ${hm(t.rise)}, закат ${hm(t.set)}, день ${dur(t.len)}` + (light ? ', ' + windowTxt(cur, light) : ''));
  if (newDay && !reduced) {
    const len = arc.getTotalLength();
    gsap.fromTo(arc, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' });
  }
}
render(false);

/* ---------- форма ---------- */
if (form) {
  const fld = (id) => $('#' + id).closest('.field');
  const check = () => {
    const name = $('#fName').value.trim();
    const digits = $('#fPhone').value.replace(/\D/g, '');
    const okName = name.length >= 2, okPhone = digits.length >= 10 && digits.length <= 12;
    fld('fName').classList.toggle('is-bad', !okName);
    fld('fPhone').classList.toggle('is-bad', !okPhone);
    $('#calErr').hidden = !!cur;
    $('#lightErr').hidden = !!light;
    return { okName, okPhone };
  };
  ['fName', 'fPhone'].forEach((id) => $('#' + id).addEventListener('input', () => {
    if (fld(id).classList.contains('is-bad')) check();
  }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { okName, okPhone } = check();
    // фокус на первое, что не заполнено: день, свет, имя, телефон
    if (!cur) { (btns[0] || grid).focus(); return; }
    if (!light) { tabs[0].focus(); return; }
    if (!okName || !okPhone) { form.querySelector('.is-bad input').focus(); return; }
    const name = $('#fName').value.trim();
    $('#doneTitle').textContent = `Спасибо, ${name}.`;
    const when = isTomorrow(cur) ? 'завтра' : DOW_V[cur.ymd.wd];
    $('#doneText').textContent = `Ждём вас ${when}, ${dateTxt(cur.ymd)}, встретим у ворот в ${arrival(cur, light)}. Позвоним в течение дня, чтобы всё подтвердить.`;
    const done = $('#formDone');
    done.hidden = false;
    if (!reduced) gsap.from(done, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'expo.inOut' });
    done.focus({ preventScroll: true });
  });
}
