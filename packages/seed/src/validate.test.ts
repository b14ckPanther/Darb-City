import { hasText, isReservedSlug, isSlug, LOCALES, TEMPLATES, type Localized } from "@darb/core";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import {
  loadBrands,
  loadBusinesses,
  loadKinds,
  loadPlaces,
  loadScreens,
  loadSectors,
  loadWeekend,
  SCREEN_SCHEMA,
  type SeedScreen,
} from "./index.js";
import { COMMON_KINDS } from "./showroom.js";

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

/** Spec §11 flagships: 11 CBS localities plus Kiryat Haim, a Haifa neighbourhood with no CBS code. */
const FLAGSHIP_CBS = [
  "4000",
  "7600",
  "1292",
  "7500",
  "6800",
  "9500",
  "8200",
  "9600",
  "1063",
  "522",
  "8900",
];
const FLAGSHIP_SLUGS = ["kiryat-haim"];

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

describe("slugs", () => {
  it("never take a route the web app reserves", () => {
    const slugs = [
      ...loadPlaces().map((p) => `place ${p.slug}`),
      ...sectors.map((s) => `sector ${s.slug}`),
      ...kinds.map((k) => `kind ${k.slug}`),
    ];
    expect(slugs.filter((s) => isReservedSlug(s.split(" ")[1]!))).toEqual([]);
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
    for (const code of FLAGSHIP_CBS) expect(byCbs.get(code)?.status, code).toBe("live");
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
    for (const code of [
      "4000",
      "7600",
      "7500",
      "8900",
      "6800",
      "9500",
      "8200",
      "9600",
      "1063",
      "7300",
    ])
      expect(byCbs.get(code)?.type, code).toBe("city");
    for (const code of ["1292", "522"]) expect(byCbs.get(code)?.type, code).toBe("town");
    expect(places.some((p) => (p.name.he ?? "").startsWith("מחנה"))).toBe(false);
  });
});

describe("showroom businesses", () => {
  const businesses = loadBusinesses();
  const places = new Map(loadPlaces().map((p) => [p.slug, p]));
  const kindSlugs = new Set(loadKinds().map((k) => k.slug));
  const brandSlugs = new Set(loadBrands().map((b) => b.slug));
  const validate = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);

  it("are examples in live places, with known kinds and brands", () => {
    for (const b of businesses) {
      expect(b.tier).toBe("example");
      expect(places.get(b.place)?.status, `${b.place}/${b.slug}`).toBe("live");
      for (const k of b.kinds) expect(kindSlugs.has(k), k).toBe(true);
      if (b.brand) expect(brandSlugs.has(b.brand), b.brand).toBe(true);
      expect(validate(b.experience), `${b.place}/${b.slug}`).toBe(true);
    }
  });
  it("have slugs unique within their place", () => {
    const keys = businesses.map((b) => `${b.place}/${b.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  const allPlaces = loadPlaces();
  const flagships = new Set([
    ...allPlaces.filter((p) => p.cbsCode && FLAGSHIP_CBS.includes(p.cbsCode)).map((p) => p.slug),
    ...FLAGSHIP_SLUGS,
  ]);
  const kindsIn = (place: string) =>
    new Set(businesses.filter((b) => b.place === place).map((b) => b.primaryKind));

  it("give each of the 12 flagships one business per active kind", () => {
    expect(flagships.size).toBe(12);
    const active = loadKinds().filter((k) => k.status === "active");
    expect(active).toHaveLength(205);
    for (const slug of flagships) {
      const here = businesses.filter((b) => b.place === slug);
      expect(here, slug).toHaveLength(205);
      expect(kindsIn(slug).size, slug).toBe(205);
    }
  });
  it("give every other live settlement exactly the common kinds", () => {
    const common = [...COMMON_KINDS].sort();
    const others = allPlaces.filter(
      (p) =>
        p.status === "live" &&
        ["city", "town", "village"].includes(p.type) &&
        !flagships.has(p.slug),
    );
    expect(others.length).toBeGreaterThan(0);
    for (const p of others) {
      expect(
        businesses.filter((b) => b.place === p.slug),
        p.slug,
      ).toHaveLength(common.length);
      expect([...kindsIn(p.slug)].sort(), p.slug).toEqual(common);
    }
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe("screen palettes", () => {
  it("keep ink readable (WCAG AA) on the background and the surface", () => {
    for (const [slug, s] of Object.entries(loadScreens())) {
      expect(contrast(s.palette.ink, s.palette.bg), `${slug} ink/bg`).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(s.palette.ink, s.palette.surface),
        `${slug} ink/surface`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/** Brands copied into every town must not belong to one. */
const GENERIC_BRANDS: Record<string, string> = {
  municipal: "City Services",
  "school-registration": "School Registration Desk",
  parking: "Parking Services",
  permits: "Local Planning Committee",
  "football-academies": "Galilee Stars Academy",
  "it-support": "Abu Ghanem NetSupport",
  hotels: "Rose Valley Cabins",
};
/** Brand words that are also tiny localities' names, but here are common words or personal names. */
const ALLOWED_PLACE_WORDS = new Set([
  "app-developers:sulam",
  "architects:shahar",
  "beekeepers:nahala",
  "carpentry:erez",
  "catering:adi",
  "cleaning:zohar",
  "community-centres:navve",
  "ev-charging:barak",
  "ladies-spa:hamaam",
  "libraries:manara",
  "meal-prep:sallama",
  "metalworks:hadid",
  "orthodontics:basma",
]);

describe("showroom brands", () => {
  const screens = loadScreens();
  it("give civic services generic names", () => {
    for (const [kind, en] of Object.entries(GENERIC_BRANDS))
      expect(screens[kind]?.brand.en, kind).toBe(en);
  });
  it("never name a real locality", () => {
    const matchers = loadPlaces()
      .filter((p) => ["city", "town", "village"].includes(p.type))
      .map((p) => {
        const en = p.name.en ?? "";
        const he = p.name.he ?? "";
        return {
          slug: p.slug,
          en:
            en.length >= 5 ? new RegExp(`(?<![A-Za-z])${escapeRegExp(en)}(?![A-Za-z])`, "i") : null,
          he: he.length >= 3 ? new RegExp(`(^|\\s)${escapeRegExp(he)}($|\\s)`) : null,
        };
      });
    const hits: string[] = [];
    for (const [kind, screen] of Object.entries(screens)) {
      for (const m of matchers) {
        if (m.en?.test(screen.brand.en ?? "") || m.he?.test(screen.brand.he ?? ""))
          hits.push(`${kind}:${m.slug}`);
      }
    }
    expect(hits.filter((hit) => !ALLOWED_PLACE_WORDS.has(hit))).toEqual([]);
  });
});

describe("weekend pattern", () => {
  const { arabDruze, christian } = loadWeekend();
  const byCbs = new Map(
    loadPlaces()
      .filter((p) => p.cbsCode)
      .map((p) => [p.cbsCode!, p]),
  );
  it("lists unique live localities in the north, in no more than one pattern", () => {
    for (const list of [arabDruze, christian]) {
      expect(new Set(list).size).toBe(list.length);
      for (const code of list) {
        const place = byCbs.get(code);
        expect(place?.status, code).toBe("live");
        expect(["northern-district", "haifa-district"], code).toContain(place?.parent);
      }
    }
    expect(arabDruze.filter((code) => christian.includes(code))).toEqual([]);
  });
  it("includes the known localities and leaves out Jewish and mixed ones", () => {
    for (const code of [
      "473",
      "482",
      "490",
      "494",
      "502",
      "509",
      "522",
      "531",
      "534",
      "649",
      "1292",
      "2710",
      "4501",
      "4201",
      "7300",
      "7500",
      "8800",
      "8900",
    ])
      expect(arabDruze, code).toContain(code);
    for (const code of ["487", "518", "530", "535"]) expect(christian, code).toContain(code);
    for (const code of [
      "4000",
      "7600",
      "1063",
      "1139",
      "1061",
      "7700",
      "2300",
      "8000",
      "9100",
      "4100",
      "6800",
      "9500",
      "8200",
      "9600",
      "535",
      "530",
    ])
      expect(arabDruze, code).not.toContain(code);
    for (const code of ["4000", "7600", "1063", "1061", "7500", "7300"])
      expect(christian, code).not.toContain(code);
  });
  it("gives showroom businesses there the local week, but not restaurants or mosques", () => {
    const businesses = loadBusinesses();
    const at = (place: string, kind: string) =>
      businesses.find((b) => b.place === place && b.primaryKind === kind)!;
    expect(at("sakhnin", "barbershops").hours.weekly[6]?.length).toBeGreaterThan(0);
    expect(at("sakhnin", "barbershops").hours.weekly[5]).toEqual([
      { open: "09:00", close: "12:00" },
    ]);
    expect(at("haifa", "barbershops").hours.weekly[6] ?? []).toEqual([]);
    expect(at("sakhnin", "mosques").hours).toEqual(at("haifa", "mosques").hours);
    const fassuta = at("fassuta", "barbershops");
    expect(fassuta.hours.weekly[0] ?? []).toEqual([]);
    expect(fassuta.hours.weekly[6]?.length).toBeGreaterThan(0);
    expect(at("fassuta", "mosques").hours).toEqual(at("haifa", "mosques").hours);
  });
});

/** Sectors whose showroom screens are fully Arabic. Task 26 makes this every sector. */
const ARABIC_SECTORS = new Set([
  "food",
  "beauty",
  "health",
  "sports",
  "kids",
  "education",
  "tech",
  "services",
  "home",
]);

describe("showroom screens in Arabic", () => {
  const screens = loadScreens();
  const texts = (s: SeedScreen): Localized[] => [
    s.brand,
    s.title,
    ...(s.subtitle ? [s.subtitle] : []),
    ...(s.tags ?? []),
    ...s.items.flatMap((i) => [i.label, ...(i.meta ? [i.meta] : [])]),
    s.cta,
  ];
  it.each(kinds.filter((k) => ARABIC_SECTORS.has(k.sector)).map((k) => k.slug))(
    "%s has Arabic everywhere",
    (slug) => {
      for (const text of texts(screens[slug]!)) {
        expect(text.ar?.trim(), JSON.stringify(text)).toBeTruthy();
        expect(blockedIn(text.ar ?? ""), text.ar).toEqual([]);
      }
    },
  );
});
