// Лист 04.x, раздел «Пролёт»: камера снаружи через окно внутрь и разворот к виду, видео
// перематывается прокруткой (как пролёт на главной, glavnaya.js). Подключает pages/villa.js.
//
// Файлы виллы: assets/video/prolet-<код>.mp4 (компьютер), prolet-<код>-m.mp4 (телефон, вертикальный),
// prolet-<код>-poster.webp и prolet-<код>-poster-m.webp. Раздел показывается, только если у виллы
// в villas.js стоит prolet: true; иначе он остаётся hidden и ничего не грузится.
//
// Загрузка: постер при подходе к разделу, видео ближе (или при входе в закрепление, если прокрутку
// прыгнули). reduced-motion: без закрепления и скраба, постер и обычный плеер, видео грузится по «плей».
import { gsap, ScrollTrigger, reduced, phone, $ } from '../site.js';

export function initProlet(v) {
  const sec = $('#prolet'), video = $('#vFlyV'), bar = $('#vFlyBar');
  if (!sec || !video || !v.prolet) return;
  const base = `assets/video/prolet-${v.code}`, m = phone ? '-m' : '';
  sec.hidden = false;

  let posterSet = false, loaded = false;
  const setPoster = () => { if (!posterSet) { posterSet = true; video.poster = `${base}-poster${m}.webp`; } };
  const load = () => {
    if (loaded) return; loaded = true;
    setPoster();
    video.src = `${base}${m}.mp4`;
    if (!reduced) { video.preload = 'auto'; video.load(); } // при reduced-motion видео пойдёт по «плей»
  };
  const near = (margin, fn) => {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin + ' 0px' });
    io.observe(sec);
  };
  near('100%', setPoster);
  near('50%', load);

  if (reduced) { video.controls = true; return; }

  const s = { progress: 0, cur: 0, dur: 0 };
  video.addEventListener('loadedmetadata', () => {
    s.dur = video.duration || 0;
    const p = video.play(); // будим декодер: iOS не рисует кадр до первого play
    if (p && p.then) p.then(() => video.pause()).catch(() => {}); else video.pause();
  }, { once: true });

  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: () => '+=' + Math.round(innerHeight * (phone ? 2.2 : 2.6)),
    pin: '.vfly__pin', pinSpacing: true, anticipatePin: 1,
    onUpdate: (self) => { s.progress = self.progress; if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`; },
    onToggle: (self) => { if (self.isActive) load(); },
  });
  // прокрутка задаёт цель, время видео плавно её догоняет; новый seek только когда прошлый закончился
  gsap.ticker.add(() => {
    if (!s.dur || video.readyState < 1) return;
    if (!video.paused) video.pause();
    const target = s.progress * (s.dur - 0.04), d = target - s.cur;
    if (Math.abs(d) < 0.001 && Math.abs(video.currentTime - target) < 0.002) return;
    const k = 1 - Math.pow(1 - 0.12, gsap.ticker.deltaRatio(60));
    s.cur = Math.abs(d) < 0.001 ? target : s.cur + d * k;
    const gap = Math.abs(s.cur - video.currentTime);
    if (!video.seeking && (gap > 1 / 48 || (s.cur === target && gap > 0.002))) video.currentTime = s.cur;
  });
  // галерея выше раздела строится после этого вызова (villa.js), поэтому пересчёт на следующем кадре
  requestAnimationFrame(() => ScrollTrigger.refresh());
}
