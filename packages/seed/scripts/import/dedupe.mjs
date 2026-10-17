// One business, one card: two records are the same business when they share an official id, or
// stand within 120 m of each other under similar names. The richer record is kept.
import { km, loose, normalize } from "./places.mjs";

export const SAME_PLACE_M = 120;

const bigrams = (s) => {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
};
/** Dice coefficient over letter pairs, 0 to 1. */
export function dice(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const x = bigrams(a);
  const y = bigrams(b);
  let both = 0;
  for (const [g, n] of x) both += Math.min(n, y.get(g) ?? 0);
  return (2 * both) / (a.length - 1 + (b.length - 1));
}

/** Words that say what the place is, not which one: never enough on their own to match. */
const GENERIC = new Set(
  ["תחנת", "תחנה", "דלק", "בנק", "סניף", "מוסך", "station", "fuel", "bank", "branch", "garage"].map(
    normalize,
  ),
);
const core = (name) =>
  normalize(name)
    .split(" ")
    .filter((w) => !GENERIC.has(w))
    .join(" ");

/** Similar names: one holds the other, or their letters mostly agree (any shared language). */
export function similarNames(a, b) {
  for (const l of ["he", "en", "ar"]) {
    const x = core(a?.[l] ?? "");
    const y = core(b?.[l] ?? "");
    if (!x || !y) continue;
    const lx = loose(x);
    const ly = loose(y);
    if (lx.length >= 2 && ly.length >= 2 && (lx.includes(ly) || ly.includes(lx))) return true;
    if (dice(x.replace(/\s/g, ""), y.replace(/\s/g, "")) >= 0.6) return true;
  }
  return false;
}

/** How much a record says: the card with more facts wins a tie. */
export function richness(b) {
  return (
    (b.phone ? 2 : 0) +
    (b.website ? 1 : 0) +
    (Object.keys(b.hours?.weekly ?? {}).length ? 2 : 0) +
    (b.experience?.items?.length ?? 0) +
    (b.kinds?.length ?? 0) +
    Object.keys(b.links ?? {}).length +
    Object.keys(b.attributes ?? {}).length
  );
}

/** Same business? `idKeys` are attribute names holding an official id (fuelAdminNo, ...). */
export function sameBusiness(a, b, idKeys = []) {
  for (const key of idKeys) {
    const x = a.attributes?.[key];
    const y = b.attributes?.[key];
    if (x !== undefined && y !== undefined) return x === y;
  }
  // A bank beside a fuel station in one town is two businesses, however alike their names.
  const kinds = new Set(a.kinds ?? []);
  if (a.kinds && b.kinds && !b.kinds.some((k) => kinds.has(k))) return false;
  return km(a, b) * 1000 <= SAME_PLACE_M && similarNames(a.name, b.name);
}

/**
 * Removes duplicates within `records`, and every record that duplicates one in `existing`
 * (already published, kept as it is). Returns { kept, dropped: [{ record, keptAs, why }] }.
 */
export function dedupe(records, { existing = [], idKeys = [] } = {}) {
  const dropped = [];
  const fresh = records.filter((r) => {
    const twin = existing.find((e) => sameBusiness(r, e, idKeys));
    if (twin) dropped.push({ record: r, keptAs: `${twin.place}/${twin.slug}`, why: "existing" });
    return !twin;
  });
  const kept = [];
  for (const r of fresh) {
    const i = kept.findIndex((k) => sameBusiness(r, k, idKeys));
    if (i === -1) {
      kept.push(r);
      continue;
    }
    const [keep, drop] = richness(r) > richness(kept[i]) ? [r, kept[i]] : [kept[i], r];
    kept[i] = keep;
    dropped.push({ record: drop, keptAs: `${keep.place}/${keep.slug}`, why: "duplicate" });
  }
  return { kept, dropped };
}
