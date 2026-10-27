// ГРАНИ: бриллиант круглой огранки, 57 граней. three r160, свой шейдер.
// Луч от камеры входит в камень, отражается от граней павильона (полное внутреннее отражение)
// и выходит обратно через коронку. На выходе три канала преломляются по-разному: лёгкая дисперсия, «огонь».
// Огранка выпуклая, поэтому путь луча внутри считается точно, перебором плоскостей граней.
import * as THREE from 'three';
import { ConvexGeometry } from './ConvexGeometry.js';

const HOURS = [ // утро, день, вечер: фон страницы, цвет и место главного окна в отражениях
  { bg: new THREE.Color('#EEF1EE'), key: new THREE.Color('#DCEBF0'), kx: -6, ky: 3, sky: new THREE.Color('#E8F0F0') },
  { bg: new THREE.Color('#F4F2ED'), key: new THREE.Color('#FFFFFF'), kx: 1, ky: 8, sky: new THREE.Color('#FFFFFF') },
  { bg: new THREE.Color('#F3E7D8'), key: new THREE.Color('#F2C38C'), kx: 7, ky: 1.5, sky: new THREE.Color('#F6E2CB') },
];

// пропорции идеальной круглой огранки: площадка 56%, угол коронки 34,5°, павильона 40,75°,
// рундист 3%, звёзды 52%, нижние клинья 78%. Диаметр рундиста 2.
function brilliantPoints() {
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const R = 1, table = 0.56, tc = Math.tan(THREE.MathUtils.degToRad(34.5)), tp = Math.tan(THREE.MathUtils.degToRad(40.75));
  const gz = 0.03, star = 0.52, lower = 0.78, c8 = Math.cos(Math.PI / 8), pts = [];
  // высоты подобраны так, чтобы четырёхугольные грани (бизели и главные грани павильона) были плоскими
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; pts.push(P(table * Math.cos(a), gz + (R - table) * tc, table * Math.sin(a))); }
  const rm = table + star * (R - table);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8, r = rm / c8; pts.push(P(r * Math.cos(a), gz + (R - rm) * tc, r * Math.sin(a))); }
  for (let j = 0; j < 16; j++) { const a = j * Math.PI / 8; pts.push(P(R * Math.cos(a), gz, R * Math.sin(a)), P(R * Math.cos(a), -gz, R * Math.sin(a))); }
  const rq = R * (1 - lower);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8, r = rq / c8; pts.push(P(r * Math.cos(a), -gz - (R - rq) * tp, r * Math.sin(a))); }
  pts.push(P(0, -gz - R * tp, 0)); // калетта
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
uniform vec4 uPlanes[NP];
uniform samplerCube uEnv;
uniform vec3 uCam;   // камера в координатах камня
uniform mat3 uRot;   // поворот камня в мир, для выборки окружения
uniform vec3 uIor;   // показатель преломления по каналам r, g, b
uniform vec3 uAbs;   // поглощение: чуть больше красного, отсюда холодный оттенок
varying vec3 vPos;
varying vec3 vN;

vec3 env(vec3 d) { return textureCube(uEnv, normalize(uRot * d)).rgb; }

// Френель для неполяризованного света, ci — косинус угла падения
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
  float ci = clamp(-dot(v, n), 0.0, 1.0);
  float F = fres(ci, 1.0, uIor.g);
  vec3 col = F * env(reflect(v, n));
  vec3 d = refract(v, n, 1.0 / uIor.g);
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
    float c = dot(d, nk);
    // выход наружу: каждый канал со своим показателем, синий раньше уходит в полное отражение
    vec3 Fc = vec3(fres(c, uIor.r, 1.0), fres(c, uIor.g, 1.0), fres(c, uIor.b, 1.0));
    if (Fc.r < 1.0) col.r += w.r * (1.0 - Fc.r) * env(refract(d, -nk, uIor.r)).r;
    if (Fc.g < 1.0) col.g += w.g * (1.0 - Fc.g) * env(refract(d, -nk, uIor.g)).g;
    if (Fc.b < 1.0) col.b += w.b * (1.0 - Fc.b) * env(refract(d, -nk, uIor.b)).b;
    w *= Fc;
    d = reflect(d, -nk);
  }
  col += w * env(d);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// искры на вершинах коронки: вспыхивают, когда отражение у вершины смотрит в окно
const SPARK_VERT = /* glsl */`
attribute vec3 aN;
uniform vec3 uL[3];
uniform float uSize;
varying float vI;
void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 wn = normalize(mat3(modelMatrix) * aN);
  vec3 r = reflect(normalize(wp - cameraPosition), wn);
  float s = 0.0;
  for (int k = 0; k < 3; k++) s += pow(max(dot(r, uL[k]), 0.0), 160.0);
  vI = min(s, 1.4);
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
  vec2 q = vec2(c.x + c.y, c.x - c.y) * 0.7071; // лучи чуть повёрнуты, длинная пара по вертикали
  float rays = exp(-abs(c.x) * 34.0) * exp(-abs(c.y) * 2.6) + exp(-abs(c.y) * 34.0) * exp(-abs(c.x) * 4.0)
             + 0.35 * (exp(-abs(q.x) * 40.0) + exp(-abs(q.y) * 40.0)) * exp(-r * 6.0);
  float a = (exp(-r * r * 30.0) + rays) * vI * smoothstep(1.0, 0.7, r);
  gl_FragColor = vec4(uCol * a, 1.0);
}`;

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
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const bg = HOURS[1].bg.clone();
  scene.background = bg;

  // окружение, которое камень отражает и преломляет: светлое небо, тёмная полоса воды,
  // кольцо ярких окон с тёмными простенками и пара бронзовых отражателей. Контраст окон и простенков
  // и даёт бриллианту рисунок; рисуется в кубическую карту один раз и заново только при смене часа.
  const envScene = new THREE.Scene();
  const sky = new THREE.SphereGeometry(20, 48, 32);
  const c = new THREE.Color(), c1c = new THREE.Color();
  const cols = [], pos = sky.attributes.position;
  const stops = [[1, '#ECEDEA'], [0.45, '#C9D0CD'], [0.12, '#93A4A1'], [0.0, '#1C2B2C'], [-0.15, '#2E403F'], [-0.5, '#7D8985'], [-1, '#B9B1A2']];
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
  const panel = (az, el, w, h, mat, dist = 12) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    m.position.set(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist);
    m.lookAt(0, 0, 0); envScene.add(m); return m;
  };
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 8.6), side: THREE.DoubleSide });
  const darkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#0E1718'), side: THREE.DoubleSide });
  const bronzeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9C7C4D').multiplyScalar(3.2), side: THREE.DoubleSide });
  // [азимут, высота, ширина, высота окна]; азимут 0 — со стороны зрителя
  [[-40, 38, 3.2, 6], [35, 52, 2.2, 7], [150, 40, 4, 5], [-140, 55, 2.4, 6], [95, 25, 1.4, 6], [-95, 22, 1.2, 7], [0, 78, 6, 2.2], [200, 18, 5, 1.4]]
    .forEach(([az, el, w, h]) => panel(az, el, w, h, winMat));
  [[0, 40, 4.4, 10], [-75, 45, 3.6, 9], [70, 48, 3.6, 9], [180, 62, 5, 7], [120, 20, 3.2, 6], [-120, 30, 3.2, 7], [-20, 70, 2.4, 6], [40, 22, 2.4, 6]]
    .forEach(([az, el, w, h]) => panel(az, el, w, h, darkMat, 13));
  [[-20, 12, 5, 2.4], [110, 60, 2.4, 3.6], [-160, 40, 3, 3]].forEach(([az, el, w, h]) => panel(az, el, w, h, bronzeMat, 12.5));
  // главное окно идёт за солнцем: утром слева, днём сверху, вечером справа и тёплое
  const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 9), side: THREE.DoubleSide });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), sunMat);
  envScene.add(sun);

  // окна ярче белого держит только карта с плавающей точкой; где её нет (старые телефоны), блики просто тише
  const hdr = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
  const cubeRT = new THREE.WebGLCubeRenderTarget(mobile ? 128 : 256, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.6, 9);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  const geo = new ConvexGeometry(brilliantPoints());
  geo.center();
  geo.scale(0.95, 0.95, 0.95); // диаметр 1,9: по площади на экране как прежний кристалл
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
  const ior = 2.418, disp = 1.0; // алмаз: красный 2,407, синий 2,451
  const mat = new THREE.ShaderMaterial({
    defines: { NP: planes.length, BOUNCES: mobile ? 4 : 6 },
    uniforms: {
      uPlanes: { value: planes }, uEnv: { value: cubeRT.texture }, uCam: { value: new THREE.Vector3() }, uRot: { value: new THREE.Matrix3() },
      uIor: { value: new THREE.Vector3(ior - 0.011 * disp, ior, ior + 0.033 * disp) },
      uAbs: { value: new THREE.Vector3(0.05, 0.022, 0.012) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
  });
  const gem = new THREE.Mesh(geo, mat);
  gem.position.y = 0.1;
  group.add(gem);

  // искры: вершины коронки, у каждой нормаль как среднее соседних граней
  const sparkPos = [], sparkN = [];
  {
    const p = geo.attributes.position, v = new THREE.Vector3(), seen = [];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (v.y < 0.27 || seen.some((s) => s.distanceToSquared(v) < 1e-6)) continue; // только коронка и верхний край рундиста
      seen.push(v.clone());
      const n = new THREE.Vector3();
      planes.forEach((q) => { if (Math.abs(q.x * v.x + q.y * v.y + q.z * v.z - q.w) < 1e-4) n.add(new THREE.Vector3(q.x, q.y, q.z)); });
      n.normalize();
      sparkPos.push(v.x, v.y, v.z); sparkN.push(n.x, n.y, n.z);
    }
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('aN', new THREE.Float32BufferAttribute(sparkN, 3));
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uL: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] }, uSize: { value: 1 }, uCol: { value: new THREE.Color(1, 0.98, 0.94) } },
    vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.renderOrder = 2;
  gem.add(sparks);
  // окна, по которым вспыхивают искры: два неподвижных и «солнце»
  const dirOf = (az, el) => { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el); return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); };
  sparkMat.uniforms.uL.value[0].copy(dirOf(-40, 38));
  sparkMat.uniforms.uL.value[1].copy(dirOf(35, 52));

  // мягкая тень под камнем вместо подставки
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  const sx = sc.getContext('2d');
  const gr = sx.createRadialGradient(128, 128, 4, 128, 128, 126);
  gr.addColorStop(0, 'rgba(60,52,40,0.28)'); gr.addColorStop(0.55, 'rgba(60,52,40,0.09)'); gr.addColorStop(1, 'rgba(60,52,40,0)');
  sx.fillStyle = gr; sx.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.62; // чуть ниже калетты
  group.add(shadow);

  // цель задаётся снаружи, сцена догоняет её мягко
  const target = { x: 0.4, y: 0.0, s: 1, rot: 0, tilt: 0.3, hour: 1, alpha: 1, grid: 0 };
  let cur = null; // первый кадр встаёт сразу туда, куда попросили, без выезда из умолчаний
  let W = 1, H = 1, halfW = 1, halfH = 1, sparkPx = 1, running = true, t0 = performance.now(), visible = true;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(15)) * 9; halfW = halfH * camera.aspect;
    sparkPx = H * dpr / (2 * halfH / 9); // пикселей на единицу длины на расстоянии 1, как у точек three
  }
  resize();
  window.addEventListener('resize', resize);

  const tmpC = new THREE.Color(), sunDir = new THREE.Vector3();
  let envHour = -1;
  function applyHour(h) {
    const i = Math.min(1, Math.floor(h)), f = h - i;
    const a = HOURS[i], b = HOURS[Math.min(2, i + 1)];
    bg.copy(a.bg).lerp(b.bg, f);
    if (Math.abs(h - envHour) < 0.01) return;
    envHour = h;
    tmpC.copy(a.key).lerp(b.key, f);
    sunDir.set(THREE.MathUtils.lerp(a.kx, b.kx, f), THREE.MathUtils.lerp(a.ky, b.ky, f), 5).normalize();
    sun.position.copy(sunDir).multiplyScalar(11.5); sun.lookAt(0, 0, 0);
    sunMat.color.copy(tmpC).multiplyScalar(9);
    winMat.color.copy(tmpC).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(9);
    skyMat.color.copy(a.sky).lerp(b.sky, f);
    sparkMat.uniforms.uL.value[2].copy(sunDir);
    sparkMat.uniforms.uCol.value.copy(tmpC).lerp(new THREE.Color(1, 1, 1), 0.6);
    cubeCam.update(renderer, envScene);
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
    // медленный поворот вокруг оси камня: восемь одинаковых секторов, каждый проходит за полминуты
    const idle = reduced ? 0 : (now - t0) * 0.000026;
    group.position.set(cur.x * halfW, cur.y * halfH, 0);
    group.scale.setScalar(cur.s);
    sparkMat.uniforms.uSize.value = 0.5 * cur.s * sparkPx; // луч искры около трети ширины камня
    // 0.45 — выверенный ракурс: бронзовый отсвет, искра и тёмные клинья в площадке.
    // С него камень стартует, в нём же стоит при reduced-motion (прокрутка его тогда не крутит).
    group.rotation.y = 0.45 + (reduced ? 0 : cur.rot + idle);
    group.rotation.x = 0.2 + (reduced ? 0.9 : cur.tilt) * 0.25; // вид чуть сверху: читаются площадка и павильон
    applyHour(cur.hour);
    gem.updateWorldMatrix(true, false);
    inv.copy(gem.matrixWorld).invert();
    mat.uniforms.uCam.value.copy(camObj.copy(camera.position).applyMatrix4(inv));
    mat.uniforms.uRot.value.setFromMatrix4(gem.matrixWorld);
    renderer.render(scene, camera);
  }

  return {
    target,
    start() { running = true; requestAnimationFrame(frame); },
    stop() { running = false; },
  };
}
