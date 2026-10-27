// ГРАНИ: солнце над мысом Светлым (62°08′ с. ш., 34°01′ в. д.), время на мысе UTC+3 круглый год.
// Общий модуль для всех листов. Без библиотек, формулы NOAA (как в _mock/sun.mjs).
// Восход и закат по верхнему краю диска с рефракцией: высота центра −0,833°.
// Азимут от севера по часовой (90 восток, 270 запад), высота над горизонтом, оба в градусах.
// Эталон для проверки: DIZAJN-v2.md, раздел «Эталон солнца» (допуск ±2 мин).
//
//   sunPos(date)    → { el, az }            положение солнца в момент date
//   sunTimes(date)  → { rise, set, noon, len, riseAz, setAz, noonEl }
//                     для суток на мысе, в которые попадает date; rise, set, noon это Date,
//                     len длина дня в минутах
//   capeDate(y, m, d, h, min) → Date        момент по часам мыса (m от 1 до 12)
//   capeDay(date)   → Date                  00:00 на мысе тех суток, где лежит date
//   capeYMD(date)   → { y, m, d, wd }       число на мысе (wd: 0 вс … 6 сб)
//   capeHM(date)    → { h, m }              часы и минуты на мысе, округление до минуты
//   hm(date)        → «07:59»
//   dur(min)        → «8 ч 42 мин»
//   MONTHS_GEN      → «января» … «декабря»

export const LAT = 62 + 8 / 60, LON = 34 + 1 / 60, TZ = 3; // 62°08′ с. ш. 34°01′ в. д., 27.10: было 61,8 и 34,3 (центр города)
const R = Math.PI / 180, MIN = 60000, H = 3600000, DAY = 86400000;
const REFR = -0.833; // высота центра диска в момент восхода и заката

// склонение (рад) и уравнение времени (мин) в момент t (мс)
function solar(t) {
  const T = (t / DAY + 2440587.5 - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * R) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * R);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * R);
  const dec = Math.asin(Math.sin(eps * R) * Math.sin(lam * R));
  const y = Math.tan(eps * R / 2) ** 2;
  const eot = 4 * (y * Math.sin(2 * L0 * R) - 2 * e * Math.sin(M * R) + 4 * e * y * Math.sin(M * R) * Math.cos(2 * L0 * R)
    - 0.5 * y * y * Math.sin(4 * L0 * R) - 1.25 * e * e * Math.sin(2 * M * R)) / R;
  return { dec, eot };
}

export function sunPos(date) {
  const t = +date;
  const { dec, eot } = solar(t);
  const utcMin = (((t % DAY) + DAY) % DAY) / MIN;
  const ha = ((((utcMin + eot + 4 * LON) % 1440) + 1440) % 1440 / 4 - 180) * R; // часовой угол
  const lat = LAT * R;
  const cz = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const el = 90 - Math.acos(Math.max(-1, Math.min(1, cz))) / R;
  const az = (Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) / R + 540) % 360;
  return { el, az };
}

export const capeDate = (y, m, d, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h - TZ, min));
export function capeYMD(date) {
  const d = new Date(+date + TZ * H);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() };
}
export function capeDay(date) { const { y, m, d } = capeYMD(date); return capeDate(y, m, d); }

// Полдень и восход/закат считаются прямо, без перебора по минутам: момент уточняется
// три раза по склонению и уравнению времени в нём самом (сходится до секунд).
export function sunTimes(date) {
  const { y, m, d } = capeYMD(date);
  const utc0 = Date.UTC(y, m - 1, d); // полночь UTC той же даты; местный полдень (09:00 UTC) внутри неё
  const lat = LAT * R;
  const at = (sign) => {             // sign: −1 восход, +1 закат, 0 полдень
    let t = utc0 + (12 - TZ) * H;
    for (let i = 0; i < 3; i++) {
      const { dec, eot } = solar(t);
      let ha = 0;
      if (sign) ha = Math.acos((Math.sin(REFR * R) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec))) / R;
      t = utc0 + (720 - 4 * LON - eot + sign * 4 * ha) * MIN;
    }
    return new Date(Math.round(t / 1000) * 1000);
  };
  const rise = at(-1), set = at(1), noon = at(0);
  return {
    rise, set, noon,
    len: (set - rise) / MIN,
    riseAz: sunPos(rise).az, setAz: sunPos(set).az, noonEl: sunPos(noon).el,
  };
}

export function capeHM(date) {
  const t = new Date(Math.round((+date + TZ * H) / MIN) * MIN);
  return { h: t.getUTCHours(), m: t.getUTCMinutes() };
}
export function hm(date) {
  const { h, m } = capeHM(date);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function dur(min) {
  const t = Math.round(min);
  return Math.floor(t / 60) + ' ч ' + (t % 60) + ' мин';
}
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
