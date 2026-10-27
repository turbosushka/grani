// ГРАНИ v2: общее для всех страниц (ES-модуль). Сам на странице не подключается:
// его импортирует сценарий страницы assets/js/pages/<страница>.js, браузер выполнит его один раз.
// Здесь: плавный скролл (только мышь), ScrollTrigger, шторка меню, прелоадер первого захода.
// Активный пункт меню и черта под ним стоят в HTML статично: переход «Грань» снимает
// страницу до того, как выполнится этот модуль, и черта должна быть в разметке сразу.
// GSAP, ScrollTrigger и Lenis подключаются обычными <script defer> перед модулем.

export const gsap = window.gsap;
export const ScrollTrigger = window.ScrollTrigger;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const touch = matchMedia('(hover: none) and (pointer: coarse)').matches; // телефон, планшет
export const phone = matchMedia('(max-width: 760px)').matches;                  // раскладка телефона
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

/* ---------- плавный скролл: Lenis только на десктопе с мышью, на таче родной ---------- */
export let lenis = null;
if (!reduced && !touch && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// Прокрутка к элементу с отступом под шапку. Работает и с Lenis, и без него.
export function scrollToEl(el, { offset = 16, duration = 1.1 } = {}) {
  if (!el) return;
  const hdr = $('.hdr');
  const off = -((hdr ? hdr.offsetHeight : 0) + offset);
  if (lenis) { lenis.scrollTo(el, { offset: off, duration }); return; }
  const y = el.getBoundingClientRect().top + window.scrollY + off;
  window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
}

/* ---------- шторка меню (телефон и узкое окно) ---------- */
const burger = $('#burger'), curtain = $('#curtain');
let closeT;
function setCurtain(open) {
  if (!burger || !curtain) return;
  if (open === curtain.classList.contains('is-open')) return;
  clearTimeout(closeT);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  if (open) {
    curtain.hidden = false;
    requestAnimationFrame(() => curtain.classList.add('is-open'));
    if (lenis) lenis.stop(); else html.style.overflow = 'hidden';
    const first = curtain.querySelector('a');
    if (first) first.focus({ preventScroll: true });
  } else {
    curtain.classList.remove('is-open');
    if (lenis) lenis.start(); else html.style.overflow = '';
    closeT = setTimeout(() => { curtain.hidden = true; }, 600);
  }
}
if (burger && curtain) {
  burger.addEventListener('click', () => setCurtain(!curtain.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && curtain.classList.contains('is-open')) { setCurtain(false); burger.focus(); }
  });
  // ушли со страницы и вернулись кнопкой «назад» из кэша: шторка закрыта
  window.addEventListener('pageshow', (e) => { if (e.persisted) setCurtain(false); });
}

/* ---------- прелоадер «ГРАНИ»: только первый заход за сессию ----------
   Решение принято в head.js (класс is-first). ready разрешается, когда страницу видно:
   сразу, если прелоадера нет, или когда вуаль ушла. По нему страницы запускают вход. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function runVeil() {
  const veil = $('.veil');
  if (!veil) { html.classList.remove('is-first'); return Promise.resolve(); }
  try { sessionStorage.setItem('grani-seen', '1'); } catch (e) {}
  const bar = $('.veil__bar i', veil);
  if (bar) bar.style.transform = 'scaleX(.35)';
  return new Promise((resolve) => {
    let done = false;
    const lift = () => {
      if (done) return; done = true;
      if (bar) bar.style.transform = 'scaleX(1)';
      setTimeout(() => {
        veil.classList.add('is-gone');
        resolve();
        setTimeout(() => html.classList.remove('is-first'), 1100);
      }, 350);
    };
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.all([fonts, wait(900)]).then(() => {
      if (bar) bar.style.transform = 'scaleX(.8)';
      requestAnimationFrame(() => requestAnimationFrame(lift));
    });
    setTimeout(lift, 3500);
  });
}
export const ready = html.classList.contains('is-first') ? runVeil() : Promise.resolve();

/* ---------- пересчёт триггеров, когда догрузились шрифты и картинки ---------- */
if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());
