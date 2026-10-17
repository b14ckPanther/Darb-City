// EV chargers the Ministry of Transport lists by name only, matched to a fuel station whose
// point is official (the Energy Ministry's list): "סונול כרמיאל" is Sonol's Karmiel station when
// exactly one Sonol station in the north answers to that name.
import { loose, normalize } from "./places.mjs";

/** Chain words in charger names, to the brand slug they mean. */
const CHAIN_WORDS = [
  [/(^|\s)(סונול|sonol)(\s|$)/i, "sonol"],
  [/(^|\s)(דור אלון|דור-אלון|dor alon)(\s|$)/i, "dor-alon"],
  [/(^|\s)(דלק|delek)(\s|$)/i, "delek"],
  [/(^|\s)(פז|paz)(\s|$)/i, "paz"],
  [/(^|\s)(טן|ten)(\s|$)/i, "ten"],
  [/(^|\s)(תפוז|tapuz)(\s|$)/i, "tapuz"],
  [/(^|\s)(סד"ש|סדש|sadash)(\s|$)/i, "sadash"],
];
const NOISE = /(תחנת|תחנה|דלק|טעינה|חניון|חניה|-|_|\(|\)|")/g;

/** The chain a charger's name names, and the rest of its name, or null. */
export function chainInName(name) {
  const text = String(name ?? "").replace(/[-_]/g, " ");
  for (const [re, brand] of CHAIN_WORDS) {
    if (!re.test(text)) continue;
    const rest = text.replace(re, " ").replace(NOISE, " ").replace(/\s+/g, " ").trim();
    return { brand, rest };
  }
  return null;
}

/**
 * `stations`: [{ brand, keys: [names the station answers to], ref }]. Returns the one station
 * the charger names, or null when none or several do.
 */
export function stationForCharger(name, stations) {
  const hit = chainInName(name);
  if (!hit || loose(hit.rest).length < 3) return null;
  const key = loose(normalize(hit.rest));
  const found = stations.filter(
    (s) => s.brand === hit.brand && s.keys.some((k) => loose(normalize(k)) === key),
  );
  return found.length === 1 ? found[0].ref : null;
}

/** Fast and slow charger counts as a station screen item's meta. */
export function chargerMeta(fast, slow) {
  const he = [];
  const ar = [];
  const en = [];
  if (fast > 0) {
    he.push(`${fast} מהירות`);
    ar.push(`${fast} سريعة`);
    en.push(`${fast} fast`);
  }
  if (slow > 0) {
    he.push(`${slow} רגילות`);
    ar.push(`${slow} عادية`);
    en.push(`${slow} standard`);
  }
  return en.length ? { he: he.join(" · "), ar: ar.join(" · "), en: en.join(" · ") } : null;
}
