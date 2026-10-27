// ГРАНИ v2: ранний скрипт. Подключается обычным <script> в <head> ДО первой отрисовки:
// 1) решает, показывать ли прелоадер (только первый заход за сессию);
// 2) ловит pagereveal и задаёт направление перехода «Грань» по номеру листа.
// pagereveal бывает раньше, чем выполнится модуль site.js, поэтому это здесь, а не там.
(function () {
  var html = document.documentElement;

  // Прелоадер. Если хранилище недоступно (приватный режим), прелоадер не показываем:
  // иначе он шёл бы на каждой странице, а запомнить, что его уже видели, нечем.
  try {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && !sessionStorage.getItem('grani-seen')) html.classList.add('is-first');
  } catch (e) {}

  // Номер листа по адресу: 1, 2, 3, 4.1…4.5, 5, 6, 7. Чужой адрес или незнакомая страница → null.
  var PAGES = { '': 1, index: 1, arhitektura: 2, villy: 3, villa: 4, mesto: 5, klub: 6, pokaz: 7 };
  var VILLAS = ['kvarc', 'berill', 'topaz', 'opal', 'agat'];
  function sheet(href) {
    if (!href) return null;
    var u;
    try { u = new URL(href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin) return null;
    var name = u.pathname.split('/').pop().replace(/\.html$/, '');
    var n = PAGES[name];
    if (n == null) return null;
    if (n === 4) n += (Math.max(0, VILLAS.indexOf(u.searchParams.get('v'))) + 1) / 10; // неверный код → Кварц
    return n;
  }

  // К меньшему листу срез идёт справа налево (тип back), к большему слева направо.
  window.addEventListener('pagereveal', function (e) {
    var vt = e.viewTransition;
    if (!vt || !vt.types) return;
    var act = window.navigation && navigation.activation;
    var from = act && act.from ? act.from.url : document.referrer;
    var a = sheet(from), b = sheet(location.href);
    if (a != null && b != null && b < a) vt.types.add('back');
  });
})();
