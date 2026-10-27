// Лист 04, блок «План»: чертёж из plans.js с переключением этажей, экспликация помещений рядом,
// синхронная подсветка в обе стороны, номера вместо подписей у мелких помещений, «Развернуть» на телефоне.
// Плюс вырезка плана одного помещения для панели точки на фасаде.
//
//   initPlan(v) → { show(floor, no, { flash }), room(no), cut(svg, no) }
//
// Номера помещений (поле no) и площади считает plans.js. Здесь их только показывают.
// Как подписи плана связаны с комнатами: plans.js кладёт группы .pl-lb в порядке террасы → комнаты →
// бассейны, а группы полов .pl-room с data-i по порядку комнат. На этом держится сопоставление ниже;
// если порядок в plans.js поменяется, номера в кружках не появятся (проверка числа групп), чертёж цел.
import { gsap, ScrollTrigger, reduced, $, $$ } from '../site.js';
import { PLANS, renderPlan, fmtArea } from '../plans.js';

const NS = 'http://www.w3.org/2000/svg';
const SMALL = 8; // м²: мельче этого на чертеже только номер (DIZAJN 3.4)
const narrow = matchMedia('(max-width: 760px)');
const byNo = (a, b) => { const [a1, a2] = a.no.split('.').map(Number), [b1, b2] = b.no.split('.').map(Number); return a1 - b1 || a2 - b2; };
const numArea = (a) => fmtArea(a);

// список помещений этажа с элементами текущей отрисовки
function parts(svg, f) {
  const rooms = f.rooms, decks = f.decks || [], pools = f.pools || [];
  const lbs = $$('.pl-labels > g.pl-lb', svg);
  const okLabels = lbs.length === decks.length + rooms.length + pools.length;
  const deckG = $$('.pl-deckg', svg);
  const list = [];
  decks.forEach((d, i) => list.push({ rm: d, g: deckG[i], lb: okLabels ? lbs[i] : null, deck: true }));
  rooms.forEach((r, j) => { if (r.k === 'void') return; list.push({ rm: r, g: svg.querySelector(`.pl-room[data-i="${j}"]`), lb: okLabels ? lbs[decks.length + j] : null }); });
  return list;
}

// номер в кружке у мелких помещений (на телефоне у всех): поверх группы подписи plans.js
function numberLabels(svg, list, all) {
  for (const p of list) {
    if (!p.lb) continue;
    if (!(all || p.rm.a < SMALL)) continue;
    p.lb.classList.add('vl-small');
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'vl-no');
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', 0); c.setAttribute('cy', 0);
    const t = document.createElementNS(NS, 'text'); t.textContent = p.rm.no;
    g.append(c, t); p.lb.append(g);
  }
  sizeNumbers(svg);
}
function sizeNumbers(svg) {
  const vb = svg.viewBox.baseVal, w = svg.getBoundingClientRect().width;
  if (!vb || !w) return;
  const u = vb.width / w;
  $$('.vl-no circle', svg).forEach((c) => c.setAttribute('r', (9 * u).toFixed(3)));
}

export function initPlan(v) {
  const P = PLANS[v.code];
  const svg = $('#vPlan'), tabs = $('#vFloors');
  const nameEl = $('#vRoomName'), areaEl = $('#vRoomArea'), tbody = $('#vRooms');
  let floor = 0, list = [], pinned = null, first = true;

  const setNow = (rm) => {
    if (rm) { nameEl.textContent = rm.n; areaEl.innerHTML = `${numArea(rm.a)}<i>м²</i>`; return; }
    const f = P.floors[floor];
    nameEl.textContent = `${floor + 1} этаж`; areaEl.innerHTML = `${numArea(f.area)}<i>м²</i>`;
  };
  const mark = (p, on) => { if (!p) return; p.g && p.g.classList.toggle('is-on', on); p.lb && p.lb.classList.toggle('is-on', on); p.tr && p.tr.classList.toggle('is-on', on); };
  const find = (no) => list.find((p) => p.rm.no === no);

  function render(fl) {
    floor = fl;
    const f = P.floors[floor];
    renderPlan(svg, v.code, floor, {
      onRoom: (d) => {
        const p = d && list.find((x) => x.rm.n === d.name && x.rm.a === d.area);
        list.forEach((x) => x.tr && x.tr.classList.toggle('is-on', x === p || x === pinned));
        setNow(p ? p.rm : pinned ? pinned.rm : null);
      },
    });
    list = parts(svg, f);
    numberLabels(svg, list, narrow.matches);
    // экспликация
    tbody.replaceChildren(...list.slice().sort((a, b) => byNo(a.rm, b.rm)).map((p) => {
      const tr = document.createElement('tr');
      tr.id = `pom-${p.rm.no.replace('.', '-')}`;
      if (p.deck) tr.className = 'is-deck';
      tr.innerHTML = `<td>${p.rm.no}</td><td>${p.rm.n}</td><td class="r">${numArea(p.rm.a)}</td>`;
      tr.tabIndex = 0;
      const on = () => { if (pinned && pinned !== p) mark(pinned, false); mark(p, true); setNow(p.rm); };
      const off = () => { mark(p, false); if (pinned && pinned !== p) mark(pinned, true); setNow(pinned ? pinned.rm : null); };
      tr.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') on(); });
      tr.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') off(); });
      tr.addEventListener('focus', on); tr.addEventListener('blur', off);
      tr.addEventListener('click', () => { if (pinned === p) { pinned = null; off(); } else { if (pinned) mark(pinned, false); pinned = p; on(); } });
      p.tr = tr;
      return tr;
    }));
    $('#vTotalK').textContent = `${floor + 1} этаж`;
    $('#vTotal').textContent = numArea(f.area);
    const decks = list.filter((p) => p.deck);
    // строка из DIZAJN 3.4, вычитана копирайтером 27.10: «Настил 43,4 м² и мостки 7,0 м² в площадь виллы не входят»
    // (второе имя со строчной, в середине фразы; настилов на этаже не больше двух)
    $('#vDeck').innerHTML = decks.length ? decks.map((p, i) => `${i ? p.rm.n.toLowerCase() : p.rm.n} <i>${numArea(p.rm.a)} м²</i>`).join(' и ') + (decks.length > 1 ? ' в площадь виллы не входят.' : ' в площадь виллы не входит.') : '';
    const ps = $('[data-villa="psheet"]'); if (ps) ps.textContent = `${v.sheet}, план ${floor + 1} этажа`;
    pinned = null;
    setNow(null);
    scale();
    $$('button', tabs).forEach((b, i) => b.setAttribute('aria-selected', String(i === floor)));
    if (first) { first = false; plotter(); }
  }

  // линейка 0–1–2–5 м по настоящему масштабу чертежа
  function scale() {
    const vb = svg.viewBox.baseVal, w = svg.getBoundingClientRect().width;
    if (!vb || !w) return;
    $('#vScale').style.width = (5 * w / vb.width).toFixed(1) + 'px'; // поворот на 90° масштаб не меняет
    sizeNumbers(svg);
  }

  // плоттер: стены открываются слева направо, мебель и подписи следом (один раз)
  function plotter() {
    if (reduced) return;
    const items = $('.pl-items', svg), labels = $('.pl-labels', svg);
    gsap.set(svg, { clipPath: 'inset(0% 100% 0% 0%)' });
    gsap.set([items, labels], { opacity: 0 });
    ScrollTrigger.create({
      trigger: svg, start: 'top 75%', once: true,
      onEnter: () => {
        gsap.to(svg, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power2.inOut', clearProps: 'clipPath' });
        gsap.to($('.pl-items', svg), { opacity: 1, duration: 0.3, delay: 0.2, clearProps: 'opacity' });
        gsap.to($('.pl-labels', svg), { opacity: 1, duration: 0.3, delay: 0.4, clearProps: 'opacity' });
      },
    });
  }

  // табы этажей
  P.floors.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = `${i + 1} этаж`;
    b.addEventListener('click', () => swap(i));
    tabs.append(b);
  });
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = (floor + (e.key === 'ArrowRight' ? 1 : -1) + P.floors.length) % P.floors.length;
    swap(n); tabs.children[n].focus();
  });
  // этажи меняются растворением 250 мс, рамка у этажей общая, дом не прыгает
  function swap(i, done) {
    if (i === floor && !done) return;
    if (reduced) { render(i); done && done(); return; }
    svg.classList.add('is-swap');
    setTimeout(() => { render(i); svg.classList.remove('is-swap'); done && done(); }, 125);
  }

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => requestAnimationFrame(scale)).observe(svg);
  render(0);

  // показать помещение: этаж, подсветка, строка таблицы, вспышка контура
  function show(fl, no, { flash } = {}) {
    const go = () => {
      const p = find(no);
      if (!p) return;
      if (pinned) mark(pinned, false);
      pinned = p; mark(p, true); setNow(p.rm);
      if (flash) {
        const geo = $('.pl-geo', svg);
        const g = document.createElementNS(NS, 'g');
        for (const poly of (p.deck ? [p.rm.p] : p.rm.p)) { const e = document.createElementNS(NS, 'polygon'); e.setAttribute('points', poly.map((q) => q.join(',')).join(' ')); e.setAttribute('class', 'vl-flash'); g.append(e); }
        geo.append(g);
        setTimeout(() => g.remove(), 1000);
      }
    };
    if (fl !== floor) swap(fl, go); else go();
  }

  // «Развернуть»: чертёж на весь экран, прокрутка пальцем, крупнее и мельче кнопками
  const full = $('#vFull'), fsvg = $('#vFullPlan'), fscroll = $('#vFullScroll');
  let fz = 1, ffloor = 0;
  const fRender = () => {
    renderPlan(fsvg, v.code, ffloor, { orient: 'land' });
    fsvg.style.width = Math.round(900 * fz) + 'px';
    $$('#vFullFloors button').forEach((b, i) => b.setAttribute('aria-selected', String(i === ffloor)));
  };
  if (full) {
    document.body.append(full); // из <main>: у него свой слой ниже шапки, окно должно быть над ней
    P.floors.forEach((_, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = `${i + 1} этаж`;
      b.addEventListener('click', () => { ffloor = i; fRender(); });
      $('#vFullFloors').append(b);
    });
    $('#vOpen').addEventListener('click', () => {
      ffloor = floor; fz = 1; full.hidden = false; document.documentElement.style.overflow = 'hidden'; fRender();
      $('.vfull__x', full).focus();
    });
    const close = () => { full.hidden = true; document.documentElement.style.overflow = ''; $('#vOpen').focus(); };
    $('.vfull__x', full).addEventListener('click', close);
    full.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    $$('.vfull__zoom button', full).forEach((b) => b.addEventListener('click', () => {
      const cx = (fscroll.scrollLeft + fscroll.clientWidth / 2) / fscroll.scrollWidth, cy = (fscroll.scrollTop + fscroll.clientHeight / 2) / fscroll.scrollHeight;
      fz = Math.min(2.2, Math.max(0.6, fz * (+b.dataset.z > 0 ? 1.35 : 1 / 1.35)));
      fsvg.style.width = Math.round(900 * fz) + 'px';
      fscroll.scrollLeft = cx * fscroll.scrollWidth - fscroll.clientWidth / 2; fscroll.scrollTop = cy * fscroll.scrollHeight - fscroll.clientHeight / 2;
    }));
  }

  return {
    show,
    room: (no) => { const fl = Number(no.split('.')[0]) - 1, f = P.floors[fl]; return f && [...f.rooms, ...(f.decks || [])].find((r) => r.no === no); },
    // вырезка плана помещения: тот же чертёж, рамка по комнате плюс метр, комната выделена
    cut(cs, no) {
      const fl = Number(no.split('.')[0]) - 1, f = P.floors[fl];
      renderPlan(cs, v.code, fl, { interactive: false, orient: 'land' });
      cs.classList.add('cut');
      const ps = parts(cs, f), p = ps.find((x) => x.rm.no === no);
      if (!p) return;
      const pts = (p.deck ? [p.rm.p] : p.rm.p).flat();
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      let x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1, w = Math.max(...xs) - Math.min(...xs) + 2, h = Math.max(...ys) - Math.min(...ys) + 2;
      // рамка 3:2, как у мини-фото
      if (w / h > 1.5) { const nh = w / 1.5; y0 -= (nh - h) / 2; h = nh; } else { const nw = h * 1.5; x0 -= (nw - w) / 2; w = nw; }
      cs.setAttribute('viewBox', [x0, y0, w, h].map((n) => +n.toFixed(2)).join(' '));
      cs.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      p.g && p.g.classList.add('is-on');
      cs.setAttribute('aria-hidden', 'true');
    },
  };
}
