// ГРАНИ: вытянутый гранёный камень, площадка сверху, длинный острый павильон. three r160, свой шейдер.
// Три варианта материала и формы, выбираются адресом страницы: ?gem=a|b|c (по умолчанию DEFAULT).
//   a  горный хрусталь: шесть граней, прозрачный, почти без цвета
//   b  дымчатое стекло: восемь граней, лёгкое серо-зелёное поглощение в толще (цвет --glass сайта)
//   c  матовые грани и полированная площадка: восьмигранная колонна с острым низом
// Свет: отражение и преломление по Френелю, 2–3 отражения внутри (огранка выпуклая, путь луча
// считается точно, перебором плоскостей граней). Окружение размыто по шероховатости (PMREM),
// поэтому блики мягкие, как в музейной витрине. Дисперсии и искр нет намеренно (слово Саши, 27.10).
import * as THREE from 'three';
import { ConvexGeometry } from './ConvexGeometry.js';

const DEFAULT = 'b';
const VARIANTS = {
  // ior — показатель преломления, abs — поглощение r, g, b на единицу длины, rough — полировка
  // граней (0 зеркало), frost — шероховатость матовых граней (0 — матовых нет), h/w — высота к ширине
  a: { ior: 1.544, abs: [0.05, 0.03, 0.018], rough: 0.03, frost: 0, bounces: 3,
       shape: { n: 6, table: 0.58, crown: 0.4, band: 0.55, pav: 2.8, brk: 0.4, brkR: 0.64 } },
  b: { ior: 1.52, abs: [0.4, 0.26, 0.26], rough: 0.05, frost: 0, bounces: 3,
       shape: { n: 8, table: 0.6, crown: 0.36, band: 0.5, pav: 2.9, brk: 0.35, brkR: 0.7 } },
  c: { ior: 1.52, abs: [0.08, 0.05, 0.03], rough: 0.03, frost: 0.45, bounces: 2,
       shape: { n: 8, table: 0.62, crown: 0.32, band: 1.4, pav: 1.9, brk: 0, brkR: 0 } },
};
const HEIGHT = 2.3; // высота камня в единицах сцены, одинаковая у всех вариантов: POS на главной общий

const HOURS = [ // утро, день, вечер: фон страницы, цвет и место главного окна в отражениях
  { bg: new THREE.Color('#EEF1EE'), key: new THREE.Color('#DCEBF0'), kx: -6, ky: 3, sky: new THREE.Color('#E8F0F0') },
  { bg: new THREE.Color('#F4F2ED'), key: new THREE.Color('#FFFFFF'), kx: 1, ky: 8, sky: new THREE.Color('#FFFFFF') },
  { bg: new THREE.Color('#F3E7D8'), key: new THREE.Color('#F2C38C'), kx: 7, ky: 1.5, sky: new THREE.Color('#F6E2CB') },
];

// Кольца вершин сверху вниз: площадка, верх и низ пояса, излом павильона (если есть), остриё.
// Кольца выровнены по углу, поэтому грани между ними — плоские трапеции, без мелкой огранки.
function stonePoints({ n, table, crown, band, pav, brk, brkR }) {
  const pts = [], ring = (r, y) => { for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a))); } };
  ring(table, band / 2 + crown);
  ring(1, band / 2);
  ring(1, -band / 2);
  if (brk > 0) ring(brkR, -band / 2 - brk * pav);
  pts.push(new THREE.Vector3(0, -band / 2 - pav, 0));
  return pts;
}

const VERT = /* glsl */`
varying vec3 vPos;
varying vec3 vN;
void main() {
  vPos = position; vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
#include <cube_uv_reflection_fragment>
uniform vec4 uPlanes[NP];
uniform sampler2D uEnv;
uniform vec3 uCam;   // камера в координатах камня
uniform mat3 uRot;   // поворот камня в мир, для выборки окружения
uniform float uIor;
uniform vec3 uAbs;
uniform float uRough;
uniform float uFrost;
varying vec3 vPos;
varying vec3 vN;

vec3 env(vec3 d, float r) { return textureCubeUV(uEnv, normalize(uRot * d), r).rgb; }

float fres(float ci, float n1, float n2) {
  float s = n1 / n2, st2 = s * s * (1.0 - ci * ci);
  if (st2 >= 1.0) return 1.0;
  float ct = sqrt(1.0 - st2);
  float rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  float rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
  return 0.5 * (rs * rs + rp * rp);
}

void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(vPos - uCam);
  // матовая грань рассеивает: всё, что прошло через неё, дальше видно размыто
  float r = (uFrost > 0.0 && n.y < 0.999) ? uFrost : uRough;
  float F = fres(clamp(-dot(v, n), 0.0, 1.0), 1.0, uIor);
  vec3 col = F * env(reflect(v, n), r);
  vec3 d = refract(v, n, 1.0 / uIor);
  vec3 p = vPos;
  vec3 w = vec3(1.0 - F);
  for (int b = 0; b < BOUNCES; b++) {
    float tmin = 1e4; vec3 nk = vec3(0.0, 1.0, 0.0);
    for (int i = 0; i < NP; i++) {
      vec4 pl = uPlanes[i];
      float dn = dot(d, pl.xyz);
      if (dn > 1e-5) { float t = (pl.w - dot(p, pl.xyz)) / dn; if (t < tmin) { tmin = t; nk = pl.xyz; } }
    }
    p += d * tmin;
    w *= exp(-uAbs * tmin);
    if (uFrost > 0.0 && nk.y < 0.999) r = max(r, uFrost);
    float c = dot(d, nk);
    float Fi = fres(c, uIor, 1.0);
    if (Fi < 1.0) col += w * (1.0 - Fi) * env(refract(d, -nk, uIor), r);
    w *= Fi;
    d = reflect(d, -nk);
  }
  col += w * env(d, max(r, 0.35)); // остаток света после последнего отражения, мягко
  // матовая грань светится рассеянным светом, как пескоструйное стекло
  if (uFrost > 0.0 && n.y < 0.999) col = mix(col, env(n, 1.0) * 1.15, 0.4);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createGem(canvas, { reduced = false, mobile = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;

  const key = new URLSearchParams(location.search).get('gem');
  const V = VARIANTS[key] || VARIANTS[DEFAULT];

  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const bg = HOURS[1].bg.clone();
  scene.background = bg;

  // окружение в духе музейной витрины: светлый свод, мягкий верхний свет, большой боковой софтбокс,
  // узкие контровые полосы для рёбер, серые простенки и бронзовый отсвет снизу. Перерисовывается
  // только при смене часа.
  const envScene = new THREE.Scene();
  const sky = new THREE.SphereGeometry(20, 48, 32);
  const c = new THREE.Color(), c1c = new THREE.Color();
  const cols = [], pos = sky.attributes.position;
  const stops = [[1, '#F7F7F3'], [0.4, '#DCE1DE'], [0.1, '#B7C2BF'], [0.0, '#93A09E'], [-0.2, '#848D8A'], [-0.6, '#A39D91'], [-1, '#C9C1B2']];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 20;
    let j = 0; while (j < stops.length - 2 && y < stops[j + 1][0]) j++;
    const [y0, s0] = stops[j], [y1, s1] = stops[j + 1];
    c.set(s0).lerp(c1c.set(s1), (y0 - y) / (y0 - y1));
    cols.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(sky, skyMat));
  const panel = (az, el, w, h, mat, dist = 12) => { // азимут 0 — со стороны зрителя
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    m.position.set(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist);
    m.lookAt(0, 0, 0); envScene.add(m); return m;
  };
  const lit = (k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 0.97), side: THREE.DoubleSide });
  const soft = lit(2.2), strip = lit(4.5), top = lit(6);
  panel(20, 72, 3.4, 3.4, top);                 // верхний свет витрины
  panel(-60, 22, 6, 9, soft);                   // большой софтбокс слева
  panel(130, 18, 1.1, 10, strip); panel(-150, 14, 0.9, 9, strip); // контровые полосы
  // тёмные карточки по бокам, как у предметного фотографа: из них тёмные линии рёбер на светлом фоне
  const grey = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5E6869'), side: THREE.DoubleSide });
  panel(70, 8, 1, 14, grey, 13); panel(-95, 6, 0.9, 14, grey, 13); panel(165, 10, 1.2, 14, grey, 13); panel(-160, 30, 3, 2.4, grey, 13);
  panel(-25, 4, 6, 3, new THREE.MeshBasicMaterial({ color: new THREE.Color('#9C7C4D').multiplyScalar(1.5), side: THREE.DoubleSide }), 12.5);
  const sunMat = lit(5); // окно за солнцем: утром слева, днём сверху, вечером справа и тёплое
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), sunMat);
  envScene.add(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.6, 9);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  const geo = new ConvexGeometry(stonePoints(V.shape));
  geo.computeBoundingBox();
  const k0 = HEIGHT / (geo.boundingBox.max.y - geo.boundingBox.min.y);
  geo.center();
  geo.scale(k0, k0, k0);
  // плоскости граней из оболочки: треугольники одной грани сливаются в одну плоскость
  const planes = [];
  {
    const p = geo.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); d.fromBufferAttribute(p, i + 2);
      nn.subVectors(b, a).cross(d.sub(a)).normalize();
      const w = nn.dot(a);
      if (!planes.some((q) => q.x * nn.x + q.y * nn.y + q.z * nn.z > 0.99999 && Math.abs(q.w - w) < 1e-4)) planes.push(new THREE.Vector4(nn.x, nn.y, nn.z, w));
    }
  }
  const uni = {
    uPlanes: { value: planes }, uEnv: { value: null }, uCam: { value: new THREE.Vector3() }, uRot: { value: new THREE.Matrix3() },
    uIor: { value: V.ior }, uAbs: { value: new THREE.Vector3(...V.abs).divideScalar(k0) }, // поглощение задано в размерах до масштаба
    uRough: { value: V.rough }, uFrost: { value: V.frost },
  };
  let mat = null;
  const gem = new THREE.Mesh(geo);
  gem.position.y = 0.1;
  group.add(gem);
  // тонкие светлые рёбра: огранка читается, как у резного стекла
  gem.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1),
    new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.32 })));

  // мягкая тень под остриём
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  const sx = sc.getContext('2d');
  const gr = sx.createRadialGradient(128, 128, 4, 128, 128, 126);
  gr.addColorStop(0, 'rgba(60,52,40,0.22)'); gr.addColorStop(0.55, 'rgba(60,52,40,0.07)'); gr.addColorStop(1, 'rgba(60,52,40,0)');
  sx.fillStyle = gr; sx.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = gem.position.y - HEIGHT / 2 - 0.12;
  group.add(shadow);

  // цель задаётся снаружи, сцена догоняет её мягко
  const target = { x: 0.4, y: 0.0, s: 1, rot: 0, tilt: 0.3, hour: 1, alpha: 1, grid: 0 };
  let cur = null; // первый кадр встаёт сразу туда, куда попросили, без выезда из умолчаний
  let W = 1, H = 1, halfW = 1, halfH = 1, running = true, t0 = performance.now(), visible = true;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(15)) * 9; halfW = halfH * camera.aspect;
  }
  resize();
  window.addEventListener('resize', resize);

  const tmpC = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  let envHour = -1;
  function applyHour(h) {
    const i = Math.min(1, Math.floor(h)), f = h - i;
    const a = HOURS[i], b = HOURS[Math.min(2, i + 1)];
    bg.copy(a.bg).lerp(b.bg, f);
    if (Math.abs(h - envHour) < 0.01) return;
    envHour = h;
    tmpC.copy(a.key).lerp(b.key, f);
    sun.position.set(THREE.MathUtils.lerp(a.kx, b.kx, f), THREE.MathUtils.lerp(a.ky, b.ky, f), 5).setLength(11.5);
    sun.lookAt(0, 0, 0);
    sunMat.color.copy(tmpC).multiplyScalar(5);
    for (const [m, k] of [[soft, 2.2], [strip, 4.5], [top, 6]]) m.color.copy(tmpC).lerp(white, 0.55).multiplyScalar(k);
    skyMat.color.copy(a.sky).lerp(b.sky, f);
    const rt = pmrem.fromScene(envScene, 0, 0.1, 100);
    if (envRT) envRT.dispose();
    envRT = rt;
    uni.uEnv.value = rt.texture;
    if (!mat) { // размеры атласа PMREM нужны шейдеру как константы, поэтому материал собирается после первой карты
      const hgt = rt.texture.image.height, maxMip = Math.log2(hgt) - 2;
      mat = new THREE.ShaderMaterial({
        defines: {
          NP: planes.length, BOUNCES: V.bounces, ENVMAP_TYPE_CUBE_UV: '',
          CUBEUV_TEXEL_WIDTH: (1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16))).toFixed(8),
          CUBEUV_TEXEL_HEIGHT: (1 / hgt).toFixed(8), CUBEUV_MAX_MIP: maxMip.toFixed(1),
        },
        uniforms: uni, vertexShader: VERT, fragmentShader: FRAG,
      });
      gem.material = mat;
    }
  }

  const camObj = new THREE.Vector3(), inv = new THREE.Matrix4();
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!cur) cur = { ...target };
    const k = reduced ? 1 : 0.08;
    for (const p in target) cur[p] += (target[p] - cur[p]) * k;
    if (cur.alpha < 0.01 && target.alpha < 0.01) {
      if (visible) { canvas.style.opacity = '0'; visible = false; }
      return;
    }
    if (!visible) { visible = true; }
    canvas.style.opacity = cur.alpha.toFixed(3);
    // медленный поворот вокруг оси камня, полный оборот примерно за шесть минут
    const idle = reduced ? 0 : (now - t0) * 0.000018;
    group.position.set(cur.x * halfW, cur.y * halfH, 0);
    group.scale.setScalar(cur.s);
    // 0.3 — стартовый ракурс; в нём же камень стоит при reduced-motion (прокрутка его тогда не крутит)
    group.rotation.y = 0.3 + (reduced ? 0 : cur.rot + idle);
    group.rotation.x = 0.15 + (reduced ? 0.9 : cur.tilt) * 0.2; // чуть сверху: видна площадка и весь павильон
    applyHour(cur.hour);
    gem.updateWorldMatrix(true, false);
    inv.copy(gem.matrixWorld).invert();
    uni.uCam.value.copy(camObj.copy(camera.position).applyMatrix4(inv));
    uni.uRot.value.setFromMatrix4(gem.matrixWorld);
    renderer.render(scene, camera);
  }

  return {
    target,
    start() { running = true; requestAnimationFrame(frame); },
    stop() { running = false; },
  };
}
