// «Свет по часам»: одна гостиная в трёх светах (кадры time-utro/den/vecher). Общее для листа 01
// (главная, экран 2) и листа 02 (ползунок времени суток): моменты и строки копирайтера, смешение
// кадров по часу, шкала 06:00–22:00, перетаскивание бегунка. Сценарии страниц решают остальное.
export const T0 = 6 * 60, T1 = 22 * 60;
export const MOMENTS = [
  { m: 7 * 60 + 40, txt: 'Утро. Солнце ещё низко и кладёт на пол длинные тёплые полосы. Над водой держится туман.' },
  { m: 13 * 60, txt: 'День. Высокое солнце берёт на себя кровля, в комнате ровный мягкий свет без бликов.' },
  { m: 20 * 60 + 15, txt: 'Вечер. Солнце садится между островами прямо напротив окна. Камень пола отдаёт тепло до темноты.' },
];
const pad = (n) => String(n).padStart(2, '0');
export const fmt = (m) => { m = Math.round(m); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
export const part = (m) => (m < 11 * 60 ? 'утро' : m < 18 * 60 ? 'день' : 'вечер');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const nearest = (m) => MOMENTS.reduce((a, b) => (Math.abs(b.m - m) < Math.abs(a.m - m) ? b : a));
// прилипание к моменту в пределах 20 минут
export const snap = (m) => { const n = MOMENTS.find((o) => Math.abs(o.m - m) <= 20); return n ? n.m : m; };
// час кристалла gem.js: 0 утро, 1 день, 2 вечер, между моментами плавно
export function gemHour(m) {
  if (m <= MOMENTS[1].m) return ramp(MOMENTS[0].m, MOMENTS[1].m, m);
  return 1 + ramp(MOMENTS[1].m, MOMENTS[2].m, m);
}

// Смешение кадров (DIZAJN 3.2): 06:00–07:40 утро, яркость .75→1; 07:40–13:00 утро→день;
// 13:00–20:15 день→вечер; 20:15–22:00 вечер, яркость 1→.45, насыщенность до .8.
export function blend({ frame, den, vecher }, m) {
  den.style.opacity = ramp(MOMENTS[0].m, MOMENTS[1].m, m).toFixed(3);
  vecher.style.opacity = ramp(MOMENTS[1].m, MOMENTS[2].m, m).toFixed(3);
  const morning = ramp(T0, MOMENTS[0].m, m), night = ramp(MOMENTS[2].m, T1, m);
  const bright = m < MOMENTS[0].m ? 0.75 + 0.25 * morning : 1 - 0.55 * night;
  frame.style.filter = `brightness(${bright.toFixed(3)}) saturate(${(1 - 0.2 * night).toFixed(3)})`;
}

// Шкала: деления каждые 15 мин, крупные каждый час, подписи через labelStep минут, отметки моментов.
export function buildTicks(el, labelStep = 120) {
  let html = '';
  const X = (m) => ((m - T0) / (T1 - T0)) * 100;
  for (let m = T0; m <= T1; m += 15) {
    html += `<i class="${m % 60 ? '' : 'h'}" style="left:${X(m)}%"></i>`;
    if ((m - T0) % labelStep === 0) html += `<b class="${m === T0 ? 'first' : m === T1 ? 'last' : ''}" style="left:${X(m)}%">${fmt(m)}</b>`;
  }
  MOMENTS.forEach((o) => { html += `<u style="left:${X(o.m)}%">${fmt(o.m)}</u>`; });
  el.innerHTML = html;
}

// Перетаскивание по шкале. Клик ведёт бегунок плавно (to(m, true)), ведение двигает сразу,
// на отпускании прилипание к моменту. Клавиши: ←/→ 15 мин, Shift и PageUp/Down час, Home/End.
export function bindScale(scale, thumb, { get, to }) {
  const toMin = (x) => { const r = scale.getBoundingClientRect(); return T0 + clamp((x - r.left) / r.width, 0, 1) * (T1 - T0); };
  let drag = false, moved = false, aim = 0;
  scale.addEventListener('pointerdown', (e) => {
    drag = true; moved = false; scale.setPointerCapture(e.pointerId);
    aim = thumb.contains(e.target) ? get() : toMin(e.clientX);
    if (aim !== get()) to(aim, true);
    thumb.focus({ preventScroll: true });
  });
  scale.addEventListener('pointermove', (e) => { if (drag) { moved = true; to(toMin(e.clientX), false); } });
  const end = () => { if (!drag) return; drag = false; to(snap(moved ? get() : aim), true); };
  scale.addEventListener('pointerup', end);
  scale.addEventListener('pointercancel', end);
  thumb.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 60 : 15, cur = get();
    const m = { ArrowLeft: cur - step, ArrowDown: cur - step, ArrowRight: cur + step, ArrowUp: cur + step,
      PageUp: cur + 60, PageDown: cur - 60, Home: T0, End: T1 }[e.key];
    if (m == null) return;
    e.preventDefault();
    to(clamp(m, T0, T1), false);
  });
}
