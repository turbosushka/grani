// Лист 04.x, первый экран: название виллы и пролёт камеры (снаружи через окно внутрь, разворот к виду),
// видео перематывается прокруткой. Подключает pages/villa.js.
//
// Файлы виллы: assets/video/prolet-<код>.mp4 (компьютер), prolet-<код>-m.mp4 (телефон, вертикальный),
// prolet-<код>-poster.webp и prolet-<код>-poster-m.webp. Постер ставит скрипт в разметке до первой
// отрисовки, видео грузится сразу, как выполнился модуль: это первый экран.
// Если у виллы нет пролёта (prolet: false в villas.js), кадр прячется, остаются имя и строка.
// reduced-motion: без закрепления и скраба, постер и обычный плеер, видео грузится по «плей».
import { gsap, ScrollTrigger, reduced, phone, $ } from '../site.js';

export function initProlet(v) {
  const sec = $('#prolet'), video = $('#vFlyV'), bar = $('#vFlyBar');
  if (!sec || !video) return;
  if (!v.prolet) { sec.classList.add('vfly--none'); video.removeAttribute('poster'); return; }
  const m = phone ? '-m' : '', base = `assets/video/prolet-${v.code}`;
  if (!video.poster) video.poster = `${base}-poster${m}.webp`;
  video.src = `${base}${m}.mp4`;
  if (reduced) { video.controls = true; return; } // preload="none": до «плей» качается только постер
  video.preload = 'auto';
  video.load();

  const s = { progress: 0, cur: 0, dur: 0 };
  video.addEventListener('loadedmetadata', () => {
    s.dur = video.duration || 0;
    const p = video.play(); // будим декодер: iOS не рисует кадр до первого play
    if (p && p.then) p.then(() => video.pause()).catch(() => {}); else video.pause();
  }, { once: true });

  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: () => '+=' + Math.round(innerHeight * (phone ? 2.2 : 2.6)),
    pin: '.vfly__pin', pinSpacing: true,
    onUpdate: (self) => { s.progress = self.progress; if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`; },
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
  // галерея и план ниже строятся после этого вызова (villa.js), поэтому пересчёт на следующем кадре
  requestAnimationFrame(() => ScrollTrigger.refresh());
}
