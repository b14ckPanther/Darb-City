// Which municipality or regional council a point stands in, from OpenStreetMap's administrative
// boundaries (admin_level 8 in Israel), so a café in Haifa is Haifa's even where a small
// village's centre is nearer. Data © OpenStreetMap contributors, ODbL.
import { overpass } from "./fetch.mjs";
import { km } from "./places.mjs";

/** Israel's municipalities, local councils and regional councils in the north, with geometry. */
export const fetchBoundaries = () =>
  overpass("boundaries-il", 'rel(area.il)["boundary"="administrative"]["admin_level"="8"];', {
    prelude: 'area["ISO3166-1"="IL"]["admin_level"="2"]->.il;',
    out: "geom",
  });

/** A boundary relation as segments and a bounding box. */
function shape(rel) {
  const segments = [];
  let [s, w, n, e] = [90, 180, -90, -180];
  for (const m of rel.members ?? []) {
    if (m.type !== "way" || !m.geometry || !["outer", "inner", ""].includes(m.role ?? "")) continue;
    for (let i = 1; i < m.geometry.length; i++) {
      const a = m.geometry[i - 1];
      const b = m.geometry[i];
      if (!a || !b) continue;
      segments.push([a.lon, a.lat, b.lon, b.lat]);
      s = Math.min(s, a.lat);
      n = Math.max(n, a.lat);
      w = Math.min(w, a.lon);
      e = Math.max(e, a.lon);
    }
  }
  return { segments, box: { s, w, n, e } };
}

/** Even-odd ray casting over every segment: holes and unordered rings need no assembly. */
function inside(sh, lat, lng) {
  const { box } = sh;
  if (lat < box.s || lat > box.n || lng < box.w || lng > box.e) return false;
  let odd = false;
  for (const [x1, y1, x2, y2] of sh.segments) {
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) odd = !odd;
  }
  return odd;
}

/**
 * createBoundaries(relations).at({ lat, lng }) → { name, nameEn, regional } or null: the
 * smallest boundary holding the point.
 */
export function createBoundaries(relations = []) {
  const shapes = relations
    .filter((r) => r.type === "relation" && r.tags)
    .map((r) => ({
      name: r.tags["name:he"] ?? r.tags.name,
      nameEn: r.tags["name:en"] ?? null,
      regional: /^מועצה אזורית|regional council/i.test(
        `${r.tags["name:he"] ?? r.tags.name} ${r.tags["name:en"] ?? ""}`,
      ),
      ...shape(r),
    }))
    .filter((s) => s.segments.length);
  const area = (s) => (s.box.n - s.box.s) * (s.box.e - s.box.w);
  return {
    at({ lat, lng }) {
      const hits = shapes.filter((s) => inside(s, lat, lng)).sort((a, b) => area(a) - area(b));
      return hits[0] ?? null;
    },
    /** Whether a point is inside the same boundary. */
    holds(boundary, point) {
      return Boolean(boundary) && inside(boundary, point.lat, point.lng);
    },
  };
}

/**
 * The Darb place for a point: the town OSM's address names, else the municipality the point
 * stands in, else (in a regional council) the nearest settlement inside the same council, else
 * the matcher's nearest. Returns the matcher's shape: { place, how } or a conflict.
 */
export function placeAt(matcher, boundaries, { town, lat, lng }) {
  const point = { lat, lng };
  if (town) {
    const m = matcher.match({ town, lat, lng });
    if (m?.how === "conflict" || m?.how === "name") return m;
  }
  const b = boundaries?.at(point);
  if (b && !b.regional) {
    const m = matcher.match({ town: b.name, names: [b.nameEn].filter(Boolean), lat, lng });
    if (m?.how === "name") return { ...m, how: "boundary" };
  }
  if (b?.regional) {
    let best = null;
    for (const p of matcher.settlements) {
      if (p.type === "neighbourhood" || !boundaries.holds(b, p)) continue;
      const d = km(p, point);
      if (d <= 6 && (!best || d < best.km)) best = { place: p, km: d };
    }
    if (best) return { place: best.place, how: "council", km: best.km };
  }
  return matcher.match({ lat, lng });
}
