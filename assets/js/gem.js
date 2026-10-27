// ГРАНИ: стеклянная грань на каменной плите. three r160.
import * as THREE from 'three';
import { ConvexGeometry } from './ConvexGeometry.js';

const HOURS = [ // утро, день, вечер
  { bg: new THREE.Color('#EEF1EE'), key: new THREE.Color('#DCEBF0'), kx: -6, ky: 3, ki: 2.2, amb: 0.55 },
  { bg: new THREE.Color('#F4F2ED'), key: new THREE.Color('#FFFFFF'), kx: 1, ky: 8, ki: 2.6, amb: 0.7 },
  { bg: new THREE.Color('#F3E7D8'), key: new THREE.Color('#F2C38C'), kx: 7, ky: 1.5, ki: 2.4, amb: 0.45 },
];

export function createGem(canvas, { reduced = false, mobile = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const bg = HOURS[1].bg.clone();
  scene.background = bg;
  const pmrem = new THREE.PMREMGenerator(renderer);
  // окружение «небо и озеро»: грани отражают воду и горизонт
  const envScene = new THREE.Scene();
  const sky = new THREE.SphereGeometry(20, mobile ? 24 : 48, mobile ? 16 : 32);
  const c = new THREE.Color(), c1c = new THREE.Color();
  function paint(g, stops) {
    const cols = [], pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 20;
      let j = 0; while (j < stops.length - 2 && y < stops[j + 1][0]) j++;
      const [y0, c0] = stops[j], [y1, c1] = stops[j + 1];
      c.set(c0).lerp(c1c.set(c1), (y0 - y) / (y0 - y1));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }
  // для отражений контрастно: светлое небо, тёмная полоса воды у горизонта
  paint(sky, [[1, '#FFFFFF'], [0.35, '#F1F2EE'], [0.08, '#C4D0CD'], [0.0, '#2E4341'], [-0.12, '#3F5755'], [-0.45, '#7E918D'], [-1, '#C9C2B4']]);
  // для преломления мягче, иначе стекло выглядит бутылочным
  const skyLight = paint(sky.clone(), [[1, '#FBFAF6'], [0.3, '#EEF0EC'], [0.06, '#CAD5D2'], [0.0, '#86A09C'], [-0.1, '#A3B5B1'], [-0.5, '#C9D1CC'], [-1, '#E4DFD4']]);
  envScene.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  // светлые софтбоксы: дают чёткие белые блики на отдельных гранях
  const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 5.6), side: THREE.DoubleSide });
  [[-8, 6, -10, 3, 9], [9, 4, -6, 2, 10], [0, 12, 6, 10, 2], [-12, 3, 8, 1.5, 7], [11, 2, 9, 1.2, 8], [3, 6, 14, 6, 1.2]].forEach(([x, y, z, w, h]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), win); m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  });
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  // задник «небо и озеро» виден только стеклу: рисуется в проходе преломления (там свой render target),
  // а в основном кадре цвет не пишет. Так кристалл преломляет горизонт, а страница остаётся светлой.
  let skyTint = null;
  const backdrop = new THREE.Group();
  envScene.children.forEach((m) => {
    const c2 = new THREE.Mesh(m.geometry === sky ? skyLight : m.geometry, m.material.clone());
    c2.material.depthWrite = false;
    if (m.geometry === sky) skyTint = c2.material;
    c2.position.copy(m.position); c2.quaternion.copy(m.quaternion);
    c2.onBeforeRender = (r) => { c2.material.colorWrite = r.getRenderTarget() !== null; };
    backdrop.add(c2);
  });
  backdrop.scale.setScalar(1.6);
  // тонкие светлые полосы прямо за кристаллом: каждая грань сдвигает их по-своему, отсюда блеск стекла
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.7, 1.62), depthWrite: false });
  [[-2.2, 0.5, 0.16], [0.9, 0.2, 0.07], [2.8, -0.3, 0.22], [-0.6, 0, 0.05]].forEach(([x, y, w]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 14), strip);
    m.position.set(x, y, -6); m.rotation.z = 0.12;
    m.onBeforeRender = (r) => { strip.colorWrite = r.getRenderTarget() !== null; };
    scene.add(m);
  });
  scene.add(backdrop);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.6, 9);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  // монолит: гранёный объём, как дом на скале. Точки фиксированы, форма всегда одна.
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  // кристалл: шестигранная призма со срезанными вершинами (площадка сверху, короткий клин снизу).
  // радиусы чуть разные, чтобы грани ловили свет по-разному, но силуэт оставался строгим.
  const pts = [];
  const R = [0.78, 0.7, 0.8, 0.74, 0.82, 0.72];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.26, r = R[i], cx = Math.cos(a), cz = Math.sin(a);
    pts.push(P(cx * r, 0.62, cz * r), P(cx * r, -0.78, cz * r)); // пояс призмы
    pts.push(P(cx * r * 0.34, 1.32, cz * r * 0.34));                // площадка-срез сверху
    pts.push(P(cx * r * 0.42, -1.12, cz * r * 0.42));               // срез снизу
  }
  const geo = new ConvexGeometry(pts);
  geo.center();
  geo.scale(0.72, 0.72, 0.72);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, thickness: 1.6, ior: 1.6,
    attenuationColor: new THREE.Color('#C9D8D4'), attenuationDistance: 3.4,
    clearcoat: mobile ? 0 : 0.6, clearcoatRoughness: 0.02, iridescence: mobile ? 0 : 0.12, iridescenceIOR: 1.3,
    specularIntensity: 1, envMapIntensity: 1.7, flatShading: true,
  });
  const gem = new THREE.Mesh(geo, glass);
  gem.position.y = 0.15;
  group.add(gem);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 8),
    new THREE.LineBasicMaterial({ color: 0x9C7C4D, transparent: true, opacity: 0.55 }));
  gem.add(edges);

  // мягкая тень под объёмом вместо подставки
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  const sx = sc.getContext('2d');
  const gr = sx.createRadialGradient(128, 128, 4, 128, 128, 126);
  gr.addColorStop(0, 'rgba(60,52,40,0.32)'); gr.addColorStop(0.55, 'rgba(60,52,40,0.10)'); gr.addColorStop(1, 'rgba(60,52,40,0)');
  sx.fillStyle = gr; sx.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.95;
  group.add(shadow);

  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  const fill = new THREE.DirectionalLight(new THREE.Color('#8FA6A6'), 0.9);
  fill.position.set(-4, -2, 3);
  scene.add(amb, key, fill);

  // цель задаётся снаружи, сцена догоняет её мягко
  const target = { x: 0.4, y: 0.0, s: 1, rot: 0, tilt: 0.3, hour: 1, alpha: 1, grid: 0 };
  const cur = { ...target };
  let W = 1, H = 1, halfW = 1, halfH = 1, running = true, t0 = performance.now(), visible = true;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(15)) * 9; halfW = halfH * camera.aspect;
  }
  resize();
  window.addEventListener('resize', resize);

  const tmpC = new THREE.Color();
  function applyHour(h) {
    const i = Math.min(1, Math.floor(h)), f = h - i;
    const a = HOURS[i], b = HOURS[Math.min(2, i + 1)];
    bg.copy(a.bg).lerp(b.bg, f);
    key.color.copy(a.key).lerp(b.key, f);
    key.position.set(THREE.MathUtils.lerp(a.kx, b.kx, f), THREE.MathUtils.lerp(a.ky, b.ky, f), 5);
    key.intensity = THREE.MathUtils.lerp(a.ki, b.ki, f);
    amb.intensity = THREE.MathUtils.lerp(a.amb, b.amb, f);
    tmpC.copy(a.key).lerp(b.key, f);
    glass.attenuationColor.copy(HOURS[0].key).lerp(tmpC, 0.5).lerp(new THREE.Color('#C9D8D4'), 0.7);
    // задник преломления окрашивается светом часа: вечером в кристалле тёплый закат
    if (skyTint) skyTint.color.setRGB(1, 1, 1).lerp(tmpC, 0.55);
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const k = reduced ? 1 : 0.08;
    for (const p in target) cur[p] += (target[p] - cur[p]) * k;
    if (cur.alpha < 0.01 && target.alpha < 0.01) {
      if (visible) { canvas.style.opacity = '0'; visible = false; }
      return;
    }
    if (!visible) { visible = true; }
    canvas.style.opacity = cur.alpha.toFixed(3);
    const idle = reduced ? 0 : (now - t0) * 0.00008;
    group.position.set(cur.x * halfW, cur.y * halfH, 0);
    group.scale.setScalar(cur.s);
    group.rotation.y = cur.rot + idle;
    group.rotation.x = cur.tilt * 0.35;
    gem.rotation.y = -idle * 0.6;
    applyHour(cur.hour);
    renderer.render(scene, camera);
  }

  return {
    target,
    start() { running = true; requestAnimationFrame(frame); },
    stop() { running = false; },
  };
}
