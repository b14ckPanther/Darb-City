import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { SeedKind, SeedScreen, SeedSector } from "../src/types.js";

const source = process.argv[2];
if (!source)
  throw new Error("Usage: tsx scripts/import-universe.ts <Darb-2.0>/src/content/universe-data.ts");

type L = { he: string; en: string };
interface UDistrict {
  id: string;
  name: L;
  tagline: L;
  accent: string;
}
interface UTrade {
  id: string;
  district: string;
  name: L;
  category?: string;
  screen?: SeedScreen & { archetype: string };
}

const { districts, trades } = (await import(pathToFileURL(source).href)) as {
  districts: UDistrict[];
  trades: UTrade[];
};

const CATEGORY_TEMPLATE: Record<string, SeedKind["template"]> = {
  restaurants: "menu",
  barbershops: "booking",
  salons: "booking",
  shops: "shop",
};
/** Trades with neither a generated screen nor a category (stations has a hand-written screen in extra-screens.json). */
const TRADE_TEMPLATE: Record<string, SeedKind["template"]> = { stations: "listing" };
const DELIVERY_TEMPLATES = new Set(["menu", "shop"]);
const out = (file: string, data: unknown) =>
  writeFileSync(new URL(`../data/${file}`, import.meta.url), `${JSON.stringify(data, null, 2)}\n`);

const sectors: SeedSector[] = districts.map((d, i) => ({
  slug: d.id,
  name: { he: d.name.he, ar: "", en: d.name.en },
  tagline: { he: d.tagline.he, ar: "", en: d.tagline.en },
  accent: d.accent,
  order: i + 1,
}));

const orderInSector = new Map<string, number>();
const kinds: SeedKind[] = trades.map((t) => {
  const order = (orderInSector.get(t.district) ?? 0) + 1;
  orderInSector.set(t.district, order);
  const template = t.screen
    ? (t.screen.archetype as SeedKind["template"])
    : (TRADE_TEMPLATE[t.id] ?? CATEGORY_TEMPLATE[t.category ?? ""]);
  if (!template) throw new Error(`No template for trade ${t.id}`);
  return {
    slug: t.id,
    sector: t.district,
    parent: null,
    name: { he: t.name.he, ar: "", en: t.name.en },
    synonyms: { he: [], ar: [], en: [] },
    template,
    attributes: DELIVERY_TEMPLATES.has(template) ? ["delivers"] : [],
    icon: null,
    order,
    status: "active",
  };
});

const screens: Record<string, SeedScreen> = {};
for (const t of trades) {
  if (!t.screen) continue;
  const { archetype: _archetype, ...screen } = t.screen;
  screens[t.id] = screen;
}

out("sectors.json", sectors);
out("kinds.json", kinds);
out("screens.json", screens);
console.log(
  `${sectors.length} sectors, ${kinds.length} kinds, ${Object.keys(screens).length} screens`,
);
