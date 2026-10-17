// Israeli Transverse Mercator (ITM, EPSG:2039) to WGS84 latitude and longitude, for official
// datasets that give X/Y on the Israeli grid. Inverse transverse Mercator on GRS80, then the
// Israel 1993 datum shifted to WGS84 with EPSG:2039's seven parameters (about a metre).

const D2R = Math.PI / 180;
const GRS80 = { a: 6378137, f: 1 / 298.257222101 };
const WGS84 = { a: 6378137, f: 1 / 298.257223563 };
const ITM = {
  lat0: 31.7343936111111 * D2R,
  lon0: 35.2045169444444 * D2R,
  k0: 1.0000067,
  fe: 219529.584,
  fn: 626907.39,
};
/** Israel 1993 to WGS84 (EPSG:2039's +towgs84): metres, arc seconds and parts per million. */
const SHIFT = {
  dx: -24.0024,
  dy: -17.1032,
  dz: -17.8444,
  rx: -0.33077,
  ry: -1.85269,
  rz: 1.66969,
  ppm: 5.4248,
};

const e2 = (el) => 2 * el.f - el.f * el.f;

function meridianArc(lat, a, es) {
  const e4 = es * es;
  const e6 = e4 * es;
  return (
    a *
    ((1 - es / 4 - (3 * e4) / 64 - (5 * e6) / 256) * lat -
      ((3 * es) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * lat) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * lat) -
      ((35 * e6) / 3072) * Math.sin(6 * lat))
  );
}

/** Grid easting/northing to GRS80 latitude/longitude in radians (Snyder's inverse). */
function inverseTm(x, y) {
  const { a } = GRS80;
  const es = e2(GRS80);
  const ep2 = es / (1 - es);
  const { k0, fe, fn, lat0, lon0 } = ITM;
  const m = meridianArc(lat0, a, es) + (y - fn) / k0;
  const mu = m / (a * (1 - es / 4 - (3 * es * es) / 64 - (5 * es ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - es)) / (1 + Math.sqrt(1 - es));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const c1 = ep2 * cos1 * cos1;
  const t1 = tan1 * tan1;
  const n1 = a / Math.sqrt(1 - es * sin1 * sin1);
  const r1 = (a * (1 - es)) / (1 - es * sin1 * sin1) ** 1.5;
  const d = (x - fe) / (n1 * k0);
  const lat =
    phi1 -
    ((n1 * tan1) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon =
    lon0 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) /
      cos1;
  return { lat, lon };
}

/** GRS80 geodetic (Israel 1993) to WGS84 through ECEF and the 7-parameter Helmert of EPSG:2039. */
function helmert(lat, lon) {
  const toEcef = (el, phi, lam) => {
    const es = e2(el);
    const n = el.a / Math.sqrt(1 - es * Math.sin(phi) ** 2);
    return [
      n * Math.cos(phi) * Math.cos(lam),
      n * Math.cos(phi) * Math.sin(lam),
      n * (1 - es) * Math.sin(phi),
    ];
  };
  const [x, y, z] = toEcef(GRS80, lat, lon);
  const sec = D2R / 3600;
  const { dx, dy, dz, rx, ry, rz, ppm } = SHIFT;
  const [r1, r2, r3, s] = [rx * sec, ry * sec, rz * sec, 1 + ppm * 1e-6];
  // Position vector convention (proj4's +towgs84).
  const X = dx + s * (x - r3 * y + r2 * z);
  const Y = dy + s * (r3 * x + y - r1 * z);
  const Z = dz + s * (-r2 * x + r1 * y + z);
  const es = e2(WGS84);
  const p = Math.hypot(X, Y);
  let phi = Math.atan2(Z, p * (1 - es));
  for (let i = 0; i < 6; i++) {
    const n = WGS84.a / Math.sqrt(1 - es * Math.sin(phi) ** 2);
    phi = Math.atan2(Z + es * n * Math.sin(phi), p);
  }
  return { lat: phi, lon: Math.atan2(Y, X) };
}

/** ITM X (easting) and Y (northing) in metres to { lat, lng } in WGS84 degrees. */
export function itmToWgs84(x, y) {
  const grs = inverseTm(Number(x), Number(y));
  const w = helmert(grs.lat, grs.lon);
  return { lat: w.lat / D2R, lng: w.lon / D2R };
}
