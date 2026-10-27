// Точка исходного кадра на экране при object-fit: cover (выноски на фото листов 02 и 06).
export function coverBox(img, box) {
  const iw = img.naturalWidth || +img.getAttribute('width'), ih = img.naturalHeight || +img.getAttribute('height');
  const s = Math.max(box.width / iw, box.height / ih), rw = iw * s, rh = ih * s;
  const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
  return { rw, rh, ox: (box.width - rw) * px, oy: (box.height - rh) * py };
}
// расставить выноски [data-x, data-y] (проценты кадра) внутри фигуры; ушедшие за край прячутся
export function placeLeaders(fig, leaders, margin = 12) {
  const img = fig.querySelector('img'), box = fig.getBoundingClientRect();
  const c = coverBox(img, box);
  leaders.forEach((l) => {
    const x = c.ox + (+l.dataset.x / 100) * c.rw, y = c.oy + (+l.dataset.y / 100) * c.rh;
    l.style.left = x.toFixed(1) + 'px'; l.style.top = y.toFixed(1) + 'px';
    l.classList.toggle('is-out', x < margin || x > box.width - margin || y < margin || y > box.height - margin);
  });
}
