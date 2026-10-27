// ГРАНИ: гранёный кристалл с настраиваемой формой и материалом. three r160, свой шейдер.
// Свет считается честно: отражение и преломление по Френелю, отражения внутри камня (огранка
// выпуклая, путь луча находится перебором плоскостей граней), окружение размыто по шероховатости
// (PMREM). Параметры (все, кроме огранки и числа граней, от 0 до 1, если не сказано иначе):
//   cut    огранка: 0 бриллиантовая (звёзды, клинья), 1 ступенчатая (ровные грани между кольцами)
//   n      граней по кругу, 5–12
//   hw     высота к ширине, 0,5–2,2
//   crown  доля высоты под коронкой, pav — под павильоном; остаток уходит в пояс
//   frost  матовость боковых граней (площадка всегда полированная)
//   tone   оттенок: 0 серый, 1 зелёный (цвет --glass сайта); sat — насыщенность, 0 бесцветный
//   gloss  блеск: 0 спокойное стекло, 1 бриллиант круга 4 (алмазное преломление, дисперсия, искры)
//   speed  скорость вращения
// Источник параметров: createGem(canvas, { params }), иначе адрес ?k=… или ?gem=a|b|c, иначе пресет sasha (выбор Саши).
import * as THREE from 'three';
import { ConvexGeometry } from './ConvexGeometry.js';

export const KEYS = ['cut', 'n', 'hw', 'crown', 'pav', 'frost', 'tone', 'sat', 'gloss', 'speed'];
export const PRESETS = {
  r4: { cut: 0, n: 8, hw: 0.61, crown: 0.25, pav: 0.7, frost: 0, tone: 0, sat: 0, gloss: 1, speed: 0.33 },
  a: { cut: 1, n: 6, hw: 1.88, crown: 0.11, pav: 0.75, frost: 0, tone: 0, sat: 0, gloss: 0, speed: 0.22 },
  b: { cut: 1, n: 8, hw: 1.88, crown: 0.1, pav: 0.77, frost: 0, tone: 1, sat: 0.5, gloss: 0, speed: 0.22 },
  c: { cut: 1, n: 8, hw: 1.7, crown: 0.09, pav: 0.56, frost: 0.9, tone: 0, sat: 0.05, gloss: 0, speed: 0.22 },
  mid: { cut: 1, n: 7, hw: 1.25, crown: 0.1, pav: 0.76, frost: 0, tone: 0.5, sat: 0.25, gloss: 0, speed: 0.22 },
  // выбор Саши 28.10 в конструкторе: kristall.html?k=0,7,1.03,0.09,0.79,0,0.5,0.25,0,0.22, огранка «Бриллиант»
  // (до этого 1,7,1.03,… «Ступени» и 0,7,1.22,0.09,0.76,0.06,0.21,0.27,0.16,0.52)
  sasha: { cut: 0, n: 7, hw: 1.03, crown: 0.09, pav: 0.79, frost: 0, tone: 0.5, sat: 0.25, gloss: 0, speed: 0.22 },
};
const RANGE = { cut: [0, 1], n: [5, 12], hw: [0.5, 2.2], crown: [0.04, 0.4], pav: [0.3, 0.9] };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function cleanParams(p) {
  const o = {};
  for (const k of KEYS) {
    const [a, b] = RANGE[k] || [0, 1];
    o[k] = clamp(Number.isFinite(+p[k]) ? +p[k] : PRESETS.b[k], a, b);
  }
  o.cut = Math.round(o.cut); o.n = Math.round(o.n);
  return o;
}
export const toK = (p) => KEYS.map((k) => (k === 'cut' || k === 'n') ? String(p[k]) : String(+(+p[k]).toFixed(2))).join(',');
export function fromK(s) {
  const v = String(s || '').split(',');
  if (v.length !== KEYS.length || v.some((x) => x === '' || !Number.isFinite(+x))) return null;
  const p = {}; KEYS.forEach((k, i) => { p[k] = +v[i]; });
  return cleanParams(p);
}
function paramsFromUrl() {
  const q = new URLSearchParams(location.search);
  return fromK(q.get('k')) || PRESETS[q.get('gem')] || null;
}

const MAXP = 112;   // плоскостей граней не больше: бриллиант на 12 граней по кругу даёт 109
const HEIGHT = 2.3; // больший из размеров камня в единицах сцены

const HOURS = [ // утро, день, вечер: фон страницы, цвет и место главного окна в отражениях
  { bg: new THREE.Color('#EEF1EE'), key: new THREE.Color('#DCEBF0'), kx: -6, ky: 3, sky: new THREE.Color('#E8F0F0') },
  { bg: new THREE.Color('#F4F2ED'), key: new THREE.Color('#FFFFFF'), kx: 1, ky: 8, sky: new THREE.Color('#FFFFFF') },
  { bg: new THREE.Color('#F3E7D8'), key: new THREE.Color('#F2C38C'), kx: 7, ky: 1.5, sky: new THREE.Color('#F6E2CB') },
];

// Вершины камня, радиус пояса 1. Бриллиантовая: площадка, звёзды, клинья коронки, верхние и нижние
// клинья у пояса, главные грани павильона, калетта; высоты подобраны так, чтобы четырёхугольные
// грани были плоскими. Ступенчатая: кольца площадки, пояса и излома павильона, остриё.
function stonePoints(p) {
  const H = p.hw * 2;
  let cr = p.crown, pv = p.pav; const s = cr + pv;
  if (s > 0.97) { cr *= 0.97 / s; pv *= 0.97 / s; }
  const crownH = cr * H, pavH = pv * H, gz = (H - crownH - pavH) / 2, n = p.n, pts = [];
  const V = (r, a, y) => pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
  const step = Math.PI * 2 / n;
  if (p.cut === 0) {
    const table = 0.56, star = 0.52, lower = 0.78, cs = Math.cos(Math.PI / n), tc = crownH / (1 - table);
    for (let i = 0; i < n; i++) V(table, i * step, gz + crownH);
    const rm = table + star * (1 - table);
    for (let i = 0; i < n; i++) V(rm / cs, i * step + step / 2, gz + (1 - rm) * tc);
    for (let j = 0; j < 2 * n; j++) { V(1, j * step / 2, gz); V(1, j * step / 2, -gz); }
    const rq = 1 - lower;
    for (let i = 0; i < n; i++) V(rq / cs, i * step + step / 2, -gz - (1 - rq) * pavH);
  } else {
    const ring = (r, y) => { for (let i = 0; i < n; i++) V(r, (i + 0.5) * step, y); };
    ring(0.6, gz + crownH); ring(1, gz); ring(1, -gz); ring(0.68, -gz - 0.38 * pavH);
  }
  pts.push(new THREE.Vector3(0, -gz - pavH, 0));
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
uniform vec4 uPlanes[${MAXP}];
uniform int uNP;      // сколько плоскостей занято
uniform int uB;       // сколько отражений внутри считать
uniform sampler2D uEnv;
uniform vec3 uCam;    // камера в координатах камня
uniform mat3 uRot;    // поворот камня в мир, для выборки окружения
uniform float uIor, uDisp, uRough, uFrost, uMilk, uLeft;
uniform vec3 uAbs;    // поглощение r, g, b на единицу длины
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
  bool matte = uFrost > 0.0 && n.y < 0.999; // площадка всегда полированная
  float r = matte ? max(uRough, uFrost) : uRough;
  float F = fres(clamp(-dot(v, n), 0.0, 1.0), 1.0, uIor);
  vec3 col = F * env(reflect(v, n), r);
  vec3 d = refract(v, n, 1.0 / uIor);
  vec3 p = vPos;
  vec3 w = vec3(1.0 - F);
  vec3 ic = vec3(uIor - 0.011 * uDisp, uIor, uIor + 0.033 * uDisp);
  for (int b = 0; b < 6; b++) {
    if (b >= uB) break;
    float tmin = 1e4; vec3 nk = vec3(0.0, 1.0, 0.0);
    for (int i = 0; i < ${MAXP}; i++) {
      if (i >= uNP) break;
      vec4 pl = uPlanes[i];
      float dn = dot(d, pl.xyz);
      if (dn > 1e-5) { float t = (pl.w - dot(p, pl.xyz)) / dn; if (t < tmin) { tmin = t; nk = pl.xyz; } }
    }
    p += d * tmin;
    w *= exp(-uAbs * tmin);
    if (uFrost > 0.0 && nk.y < 0.999) r = max(r, uFrost);
    float c = dot(d, nk);
    if (uDisp > 0.001) { // каналы выходят каждый со своим показателем: огонь
      vec3 Fc = vec3(fres(c, ic.r, 1.0), fres(c, ic.g, 1.0), fres(c, ic.b, 1.0));
      if (Fc.r < 1.0) col.r += w.r * (1.0 - Fc.r) * env(refract(d, -nk, ic.r), r).r;
      if (Fc.g < 1.0) col.g += w.g * (1.0 - Fc.g) * env(refract(d, -nk, ic.g), r).g;
      if (Fc.b < 1.0) col.b += w.b * (1.0 - Fc.b) * env(refract(d, -nk, ic.b), r).b;
      w *= Fc;
    } else {
      float Fi = fres(c, uIor, 1.0);
      if (Fi < 1.0) col += w * (1.0 - Fi) * env(refract(d, -nk, uIor), r);
      w *= Fi;
    }
    d = reflect(d, -nk);
  }
  col += w * env(d, max(r, uLeft)); // остаток света после последнего отражения
  if (matte) col = mix(col, env(n, 1.0) * 1.15, uMilk); // матовая грань светится рассеянным светом
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// искры на вершинах коронки: вспыхивают, когда отражение у вершины смотрит в окно
const SPARK_VERT = /* glsl */`
attribute vec3 aN;
uniform vec3 uL[3];
uniform float uSize, uOn;
varying float vI;
void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 wn = normalize(mat3(modelMatrix) * aN);
  vec3 r = reflect(normalize(wp - cameraPosition), wn);
  float s = 0.0;
  for (int k = 0; k < 3; k++) s += pow(max(dot(r, uL[k]), 0.0), 160.0);
  vI = min(s, 1.4) * uOn;
  vec4 mv = viewMatrix * vec4(wp + normalize(cameraPosition - wp) * 0.04, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vI < 0.02 ? 0.0 : uSize * (0.35 + 0.65 * min(vI, 1.0)) / -mv.z;
}`;
const SPARK_FRAG = /* glsl */`
uniform vec3 uCol;
varying float vI;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  vec2 q = vec2(c.x + c.y, c.x - c.y) * 0.7071;
  float rays = exp(-abs(c.x) * 34.0) * exp(-abs(c.y) * 2.6) + exp(-abs(c.y) * 34.0) * exp(-abs(c.x) * 4.0)
             + 0.35 * (exp(-abs(q.x) * 40.0) + exp(-abs(q.y) * 40.0)) * exp(-r * 6.0);
  float a = (exp(-r * r * 30.0) + rays) * vI * smoothstep(1.0, 0.7, r);
  gl_FragColor = vec4(uCol * a, 1.0);
}`;

export function createGem(canvas, { reduced = false, mobile = false, params = null } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;

  let P = cleanParams(params || paramsFromUrl() || PRESETS.sasha);

  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const bg = HOURS[1].bg.clone();
  scene.background = bg;

  // Окружение, которое камень отражает и преломляет. Два набора света, смешиваются блеском:
  // «витрина» (светлый свод, верхний свет, софтбокс, узкие серые карточки для рёбер) и «ювелирный»
  // (кольцо ярких окон с тёмными простенками, как в круге 4). Перерисовывается при смене часа и блеска.
  const envScene = new THREE.Scene();
  const sky = new THREE.SphereGeometry(20, 48, 32);
  const SKY_CALM = [[1, '#F7F7F3'], [0.4, '#DCE1DE'], [0.1, '#B7C2BF'], [0.0, '#93A09E'], [-0.2, '#848D8A'], [-0.6, '#A39D91'], [-1, '#C9C1B2']];
  const SKY_JEWEL = [[1, '#ECEDEA'], [0.45, '#C9D0CD'], [0.12, '#93A4A1'], [0.0, '#1C2B2C'], [-0.15, '#2E403F'], [-0.5, '#7D8985'], [-1, '#B9B1A2']];
  const grad = (stops, y, out) => {
    let j = 0; while (j < stops.length - 2 && y < stops[j + 1][0]) j++;
    const [y0, s0] = stops[j], [y1, s1] = stops[j + 1];
    return out.set(s0).lerp(new THREE.Color(s1), (y0 - y) / (y0 - y1));
  };
  const skyCols = new Float32Array(sky.attributes.position.count * 3);
  sky.setAttribute('color', new THREE.BufferAttribute(skyCols, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(sky, skyMat));
  const panel = (az, el, w, h, dist) => { // азимут 0 — со стороны зрителя
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    m.position.set(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist);
    m.lookAt(0, 0, 0); envScene.add(m); return m.material;
  };
  const WHITE = new THREE.Color(1, 1, 1), BRONZE = new THREE.Color('#9C7C4D'), GREYC = new THREE.Color('#5E6869'), DARK = new THREE.Color('#0E1718');
  // [материал, цвет, яркость, набор (0 витрина, 1 ювелирный), окрашивать ли светом часа]
  const lamps = [];
  const add = (mat, col, k, set, lit) => lamps.push([mat, col, k, set, lit]);
  add(panel(20, 72, 3.4, 3.4, 12), WHITE, 6, 0, 1);
  add(panel(-60, 22, 6, 9, 12), WHITE, 2.2, 0, 1);
  add(panel(130, 18, 1.1, 10, 12), WHITE, 4.5, 0, 1); add(panel(-150, 14, 0.9, 9, 12), WHITE, 4.5, 0, 1);
  [[70, 8, 1, 14], [-95, 6, 0.9, 14], [165, 10, 1.2, 14], [-160, 30, 3, 2.4]].forEach(([az, el, w, h]) => add(panel(az, el, w, h, 13), GREYC, 1, 0, 0));
  add(panel(-25, 4, 6, 3, 12.5), BRONZE, 1.5, 0, 0);
  [[-40, 38, 3.2, 6], [35, 52, 2.2, 7], [150, 40, 4, 5], [-140, 55, 2.4, 6], [95, 25, 1.4, 6], [-95, 22, 1.2, 7], [0, 78, 6, 2.2], [200, 18, 5, 1.4]]
    .forEach(([az, el, w, h]) => add(panel(az, el, w, h, 11.5), WHITE, 9, 1, 1));
  [[0, 40, 4.4, 10], [-75, 45, 3.6, 9], [70, 48, 3.6, 9], [180, 62, 5, 7], [120, 20, 3.2, 6], [-120, 30, 3.2, 7], [-20, 70, 2.4, 6], [40, 22, 2.4, 6]]
    .forEach(([az, el, w, h]) => add(panel(az, el, w, h, 12.8), DARK, 1, 1, 0));
  [[-20, 12, 5, 2.4], [110, 60, 2.4, 3.6], [-160, 40, 3, 3]].forEach(([az, el, w, h]) => add(panel(az, el, w, h, 12.2), BRONZE, 3.2, 1, 0));
  const sunMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); // окно за солнцем: утром слева, днём сверху, вечером справа
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), sunMat);
  envScene.add(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.6, 9);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  const planes = Array.from({ length: MAXP }, () => new THREE.Vector4());
  const uni = {
    uPlanes: { value: planes }, uNP: { value: 0 }, uB: { value: 3 }, uEnv: { value: null },
    uCam: { value: new THREE.Vector3() }, uRot: { value: new THREE.Matrix3() },
    uIor: { value: 1.52 }, uDisp: { value: 0 }, uRough: { value: 0.05 }, uFrost: { value: 0 }, uMilk: { value: 0 }, uLeft: { value: 0.35 },
    uAbs: { value: new THREE.Vector3() },
  };
  let mat = null;
  const gem = new THREE.Mesh(new THREE.BufferGeometry());
  gem.position.y = 0.1;
  group.add(gem);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.32 });
  const edges = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMat);
  gem.add(edges);
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uL: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] }, uSize: { value: 1 }, uOn: { value: 0 }, uCol: { value: new THREE.Color(1, 0.98, 0.94) } },
    vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const sparks = new THREE.Points(new THREE.BufferGeometry(), sparkMat);
  sparks.renderOrder = 2;
  gem.add(sparks);
  const dirOf = (az, el) => { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el); return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); };
  sparkMat.uniforms.uL.value[0].copy(dirOf(-40, 38));
  sparkMat.uniforms.uL.value[1].copy(dirOf(35, 52));

  // мягкая тень под камнем
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  const sx = sc.getContext('2d');
  const gr = sx.createRadialGradient(128, 128, 4, 128, 128, 126);
  gr.addColorStop(0, 'rgba(60,52,40,0.24)'); gr.addColorStop(0.55, 'rgba(60,52,40,0.08)'); gr.addColorStop(1, 'rgba(60,52,40,0)');
  sx.fillStyle = gr; sx.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  group.add(shadow);

  let scaledH = HEIGHT;
  function buildShape() {
    const geo = new ConvexGeometry(stonePoints(P));
    geo.computeBoundingBox();
    const bb = geo.boundingBox, h = bb.max.y - bb.min.y, w = bb.max.x - bb.min.x;
    const k0 = HEIGHT / Math.max(h, w);
    geo.center(); geo.scale(k0, k0, k0);
    scaledH = h * k0;
    // плоскости граней из оболочки: треугольники одной грани сливаются в одну плоскость
    const pos = geo.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), nn = new THREE.Vector3();
    let np = 0;
    for (let i = 0; i < pos.count && np < MAXP; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); d.fromBufferAttribute(pos, i + 2);
      nn.subVectors(b, a).cross(d.sub(a)).normalize();
      const pw = nn.dot(a);
      let seen = false;
      for (let j = 0; j < np; j++) { const q = planes[j]; if (q.x * nn.x + q.y * nn.y + q.z * nn.z > 0.99999 && Math.abs(q.w - pw) < 1e-4) { seen = true; break; } }
      if (!seen) planes[np++].set(nn.x, nn.y, nn.z, pw);
    }
    uni.uNP.value = np;
    // искры: вершины верхней половины, нормаль как среднее соседних граней
    const sp = [], sn = [], uniq = [], v = new THREE.Vector3(), top = scaledH / 2;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y < top - scaledH * 0.45 || uniq.some((u) => u.distanceToSquared(v) < 1e-6)) continue;
      uniq.push(v.clone());
      const nv = new THREE.Vector3();
      for (let j = 0; j < np; j++) { const q = planes[j]; if (Math.abs(q.x * v.x + q.y * v.y + q.z * v.z - q.w) < 1e-4) nv.x += q.x, nv.y += q.y, nv.z += q.z; }
      nv.normalize(); sp.push(v.x, v.y, v.z); sn.push(nv.x, nv.y, nv.z);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('aN', new THREE.Float32BufferAttribute(sn, 3));
    sparks.geometry.dispose(); sparks.geometry = sg;
    edges.geometry.dispose(); edges.geometry = new THREE.EdgesGeometry(geo, 1);
    gem.geometry.dispose(); gem.geometry = geo;
    shadow.position.y = gem.position.y - scaledH / 2 - 0.12;
    const sw = Math.min(w * k0, 2.4) * 1.3; shadow.scale.set(sw, sw * 0.55, 1);
    return k0;
  }
  function applyMaterial(k0) {
    const g = P.gloss, smoke = new THREE.Color(0.5, 0.5, 0.5).lerp(new THREE.Color(1, 0.65, 0.65), P.tone);
    uni.uIor.value = 1.52 + 0.9 * g;            // от стекла до алмаза
    uni.uDisp.value = g * g;                    // радуга появляется только у самого блестящего
    uni.uRough.value = 0.05 * (1 - g);
    uni.uLeft.value = 0.35 * (1 - g);
    uni.uFrost.value = 0.5 * P.frost;
    uni.uMilk.value = 0.45 * P.frost;
    uni.uB.value = Math.min(Math.round(3 + 3 * g), mobile ? 4 : 6);
    // поглощение задано на радиус 1, в шейдере длины уже в масштабе сцены
    uni.uAbs.value.set(0.05, 0.03, 0.018).addScaledVector(new THREE.Vector3(smoke.r, smoke.g, smoke.b), 0.8 * P.sat).divideScalar(k0);
    edgeMat.opacity = 0.32 * (1 - g) * (P.cut ? 1 : 0.6);
    edges.visible = edgeMat.opacity > 0.01;
    sparkMat.uniforms.uOn.value = g * g;
    sparks.visible = g > 0.05;
  }
  let shapeKey = '', k0 = 1, envGloss = -1, envHour = -1;
  function applyParams() {
    const sk = [P.cut, P.n, P.hw, P.crown, P.pav].join();
    if (sk !== shapeKey) { shapeKey = sk; k0 = buildShape(); }
    applyMaterial(k0);
  }
  applyParams();

  // цель задаётся снаружи, сцена догоняет её мягко
  const target = { x: 0.4, y: 0.0, s: 1, rot: 0, tilt: 0.3, hour: 1, alpha: 1, grid: 0 };
  let cur = null; // первый кадр встаёт сразу туда, куда попросили, без выезда из умолчаний
  let W = 1, H = 1, halfW = 1, halfH = 1, sparkPx = 1, running = true, last = performance.now(), idle = 0, visible = true;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(15)) * 9; halfW = halfH * camera.aspect;
    sparkPx = H * dpr / (2 * halfH / 9);
  }
  resize();
  window.addEventListener('resize', resize);

  const tmpC = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color(), skyMid = new THREE.Color('#C9D0CD');
  let lastBake = 0;
  function applyEnv(h, now) {
    const i = Math.min(1, Math.floor(h)), f = h - i;
    const a = HOURS[i], b = HOURS[Math.min(2, i + 1)];
    bg.copy(a.bg).lerp(b.bg, f);
    const g = P.gloss;
    if (Math.abs(h - envHour) < 0.01 && Math.abs(g - envGloss) < 0.005) return;
    if (envRT && now - lastBake < 90) return; // ползунок тянут: карту не чаще десяти раз в секунду
    envHour = h; envGloss = g; lastBake = now;
    tmpC.copy(a.key).lerp(b.key, f);
    const pos = sky.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v) / 20;
      grad(SKY_CALM, y, c2).lerp(grad(SKY_JEWEL, y, c3), g).toArray(skyCols, v * 3);
    }
    sky.attributes.color.needsUpdate = true;
    for (const [m, col, k, set, lit] of lamps) {
      const on = set ? g : 1 - g; // лампа своего набора в полную силу, чужого гаснет до цвета свода
      c2.copy(col).multiplyScalar(k);
      if (lit) c2.multiply(c3.copy(tmpC).lerp(WHITE, 0.55));
      m.color.copy(skyMid).lerp(c2, on);
    }
    sun.position.set(THREE.MathUtils.lerp(a.kx, b.kx, f), THREE.MathUtils.lerp(a.ky, b.ky, f), 5).setLength(11.5);
    sun.lookAt(0, 0, 0);
    sunMat.color.copy(tmpC).multiplyScalar(5 + 4 * g);
    skyMat.color.copy(a.sky).lerp(b.sky, f);
    sparkMat.uniforms.uL.value[2].copy(sun.position).normalize();
    sparkMat.uniforms.uCol.value.copy(tmpC).lerp(WHITE, 0.6);
    const rt = pmrem.fromScene(envScene, 0, 0.1, 100);
    if (envRT) envRT.dispose();
    envRT = rt;
    uni.uEnv.value = rt.texture;
    if (!mat) { // размеры атласа PMREM нужны шейдеру как константы, поэтому материал собирается после первой карты
      const hgt = rt.texture.image.height, maxMip = Math.log2(hgt) - 2;
      mat = new THREE.ShaderMaterial({
        defines: {
          ENVMAP_TYPE_CUBE_UV: '',
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
    const dt = Math.min(100, Math.max(0, now - last)); last = now;
    if (cur.alpha < 0.01 && target.alpha < 0.01) {
      if (visible) { canvas.style.opacity = '0'; visible = false; }
      return;
    }
    if (!visible) { visible = true; }
    canvas.style.opacity = cur.alpha.toFixed(3);
    if (!reduced) idle += dt * P.speed * 0.00008; // speed 1: оборот примерно за 80 секунд
    group.position.set(cur.x * halfW, cur.y * halfH, 0);
    group.scale.setScalar(cur.s);
    sparkMat.uniforms.uSize.value = 0.5 * cur.s * sparkPx;
    // 0.35 — стартовый ракурс; при reduced-motion камень в нём и стоит (прокрутка его тогда не крутит)
    group.rotation.y = 0.35 + (reduced ? 0 : cur.rot + idle);
    // плоский камень видно сверху сильнее, вытянутый почти сбоку: читаются площадка и павильон
    const tall = clamp((P.hw - 0.6) / 1.3, 0, 1), t = reduced ? 0.9 : cur.tilt;
    group.rotation.x = THREE.MathUtils.lerp(0.2 + t * 0.25, 0.15 + t * 0.2, tall);
    applyEnv(cur.hour, now);
    gem.updateWorldMatrix(true, false);
    inv.copy(gem.matrixWorld).invert();
    uni.uCam.value.copy(camObj.copy(camera.position).applyMatrix4(inv));
    uni.uRot.value.setFromMatrix4(gem.matrixWorld);
    renderer.render(scene, camera);
  }

  return {
    target,
    start() { running = true; last = performance.now(); requestAnimationFrame(frame); },
    stop() { running = false; },
    // для конструктора: поменять часть параметров, форма перестраивается без перекомпиляции шейдера
    set(p) { P = cleanParams({ ...P, ...p }); applyParams(); },
    get params() { return { ...P }; },
  };
}
