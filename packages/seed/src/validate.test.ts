import { hasText, isSlug, LOCALES, TEMPLATES, type Localized } from "@darb/core";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { loadKinds, loadPlaces, loadScreens, loadSectors, SCREEN_SCHEMA } from "./index.js";

/** Halal gate: none of these may appear in any kind name or synonym. */
const BLOCKED = [
  "bar",
  "pub",
  "wine",
  "beer",
  "liquor",
  "alcohol",
  "casino",
  "gambling",
  "lottery",
  "pork",
  "nightclub",
  "night club",
  "tattoo",
  "strip",
  "בר",
  "יין",
  "בירה",
  "אלכוהול",
  "קזינו",
  "הימורים",
  "חזיר",
  "מועדון לילה",
  "קעקוע",
  "خمر",
  "نبيذ",
  "بيرة",
  "كحول",
  "كازينو",
  "قمار",
  "خنزير",
  "ملهى ليلي",
  "وشم",
];
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Hebrew attaches one-letter prefixes (ה ב ל ו ש כ מ) to words, so allow one before Hebrew terms. */
const HEBREW_PREFIX = "[הבלושכמ]?";
const BLOCKED_RES = BLOCKED.map((w) => {
  const prefix = /\p{Script=Hebrew}/u.test(w) ? HEBREW_PREFIX : "";
  return { w, re: new RegExp(`(^|[^\\p{L}])${prefix}${escapeRegExp(w)}([^\\p{L}]|$)`, "iu") };
});
const blockedIn = (text: string) => BLOCKED_RES.filter(({ re }) => re.test(text)).map(({ w }) => w);
const complete = (value: Localized) => LOCALES.every((l) => (value[l] ?? "").trim() !== "");

const sectors = loadSectors();
const kinds = loadKinds();

describe("halal gate", () => {
  it("catches blocked terms, including Hebrew with one prefix letter", () => {
    for (const t of ["wine bar", "בר", "הבר", "ובירה", "לקזינו", "بيرة"])
      expect(blockedIn(t), t).not.toEqual([]);
  });
  it("leaves look-alike words alone", () => {
    for (const t of ["barbershops", "bars", "Stripe", "ברכה", "בריכה", "ברבר"])
      expect(blockedIn(t), t).toEqual([]);
  });
});

describe("sectors", () => {
  it("are the 18 sectors with unique slugs, accents and order", () => {
    expect(sectors).toHaveLength(18);
    expect(new Set(sectors.map((s) => s.slug)).size).toBe(18);
    for (const s of sectors) {
      expect(isSlug(s.slug), s.slug).toBe(true);
      expect(s.accent).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  // Gate for Task 15's content: every sector needs an Arabic name and tagline.
  it("have names and taglines in Hebrew, Arabic and English", () => {
    for (const s of sectors) {
      expect(complete(s.name), `${s.slug} name`).toBe(true);
      expect(complete(s.tagline), `${s.slug} tagline`).toBe(true);
    }
  });
});

describe("kinds", () => {
  const sectorSlugs = new Set(sectors.map((s) => s.slug));
  const kindSlugs = new Set(kinds.map((k) => k.slug));

  it("have unique valid slugs, a known sector, parent and template", () => {
    expect(kindSlugs.size).toBe(kinds.length);
    for (const k of kinds) {
      expect(isSlug(k.slug), k.slug).toBe(true);
      expect(sectorSlugs.has(k.sector), `${k.slug} sector`).toBe(true);
      if (k.parent) expect(kindSlugs.has(k.parent), `${k.slug} parent`).toBe(true);
      expect(TEMPLATES).toContain(k.template);
    }
  });
  // Gate for Task 15's content: every kind needs an Arabic name and he/ar/en search synonyms.
  it("have names in all three languages and at least one synonym per language", () => {
    for (const k of kinds) {
      expect(complete(k.name), `${k.slug} name`).toBe(true);
      for (const l of LOCALES)
        expect(k.synonyms[l].length, `${k.slug} synonyms.${l}`).toBeGreaterThan(0);
    }
  });
  it("contain nothing haram", () => {
    for (const k of kinds) {
      const texts = [
        ...Object.values(k.name),
        ...k.synonyms.he,
        ...k.synonyms.ar,
        ...k.synonyms.en,
      ];
      for (const t of texts) expect(blockedIn(t), `${k.slug}: "${t}"`).toEqual([]);
    }
  });
  it("each have a valid experience screen", () => {
    const screens = loadScreens();
    const validate = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);
    for (const k of kinds) {
      const screen = screens[k.slug];
      expect(screen, `${k.slug} screen`).toBeDefined();
      expect(validate(screen), `${k.slug}: ${JSON.stringify(validate.errors)}`).toBe(true);
      expect(hasText(screen!.brand)).toBe(true);
    }
  });
});

describe("places", () => {
  const places = loadPlaces();
  const bySlug = new Map(places.map((p) => [p.slug, p]));
  const byCbs = new Map(places.filter((p) => p.cbsCode).map((p) => [p.cbsCode, p]));
  const FLAGSHIPS = ["4000", "7600", "1292", "7500", "6800", "9500", "8200", "9600", "1063", "522", "8900"];

  it("have unique slugs and parents come first", () => {
    expect(bySlug.size).toBe(places.length);
    const seen = new Set<string>();
    for (const p of places) {
      expect(isSlug(p.slug), p.slug).toBe(true);
      if (p.parent) expect(seen.has(p.parent), `${p.slug} parent ${p.parent}`).toBe(true);
      seen.add(p.slug);
    }
  });
  it("have names in three languages and coordinates inside Israel", () => {
    for (const p of places) {
      expect(complete(p.name), `${p.slug} name`).toBe(true);
      expect(p.lat, p.slug).toBeGreaterThan(29.4);
      expect(p.lat, p.slug).toBeLessThan(33.45);
      expect(p.lng, p.slug).toBeGreaterThan(34.2);
      expect(p.lng, p.slug).toBeLessThan(35.95);
    }
  });
  it("keep flagship northern localities live and slugs disambiguated", () => {
    for (const code of FLAGSHIPS) expect(byCbs.get(code)?.status, code).toBe("live");
    expect(byCbs.get("8900")?.slug).toBe("tamra");
    expect(byCbs.get("547")?.slug).not.toBe("tamra");
    expect(bySlug.get("kiryat-haim")?.parent).toBe("haifa");
  });
  it("are live exactly under the northern and haifa districts", () => {
    for (const p of places.filter((x) => x.cbsCode)) {
      const live = p.parent === "northern-district" || p.parent === "haifa-district";
      expect(p.status, p.slug).toBe(live ? "live" : "soon");
    }
  });
  it("have clean Arabic names, no neighbourhood CBS rows and correct flagship types", () => {
    for (const p of places) {
      expect(p.name.ar, `${p.slug} ar`).not.toMatch(/[A-Za-z\u060C]/);
      if (p.cbsCode) expect(p.type, p.slug).not.toBe("neighbourhood");
    }
    for (const code of ["4000", "7600", "7500", "8900", "6800", "9500", "8200", "9600", "1063", "7300"])
      expect(byCbs.get(code)?.type, code).toBe("city");
    for (const code of ["1292", "522"]) expect(byCbs.get(code)?.type, code).toBe("town");
    expect(places.some((p) => (p.name.he ?? "").startsWith("מחנה"))).toBe(false);
  });
});
