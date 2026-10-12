// Merges data/screens-ar.json (Arabic for some showroom screens) into data/screens.json, next to
// the Hebrew and English, then deletes screens-ar.json. Shapes must match exactly. Existing Arabic is
// never overwritten unless --force is passed. Usage: tsx scripts/merge-arabic.ts [--force]
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Localized } from "@darb/core";
import type { SeedScreen } from "../src/types.js";

interface ArabicScreen {
  brand: string;
  title: string;
  subtitle?: string;
  tags?: string[];
  items: { label: string; meta?: string }[];
  cta: string;
}

const DATA = (file: string) => new URL(`../data/${file}`, import.meta.url);
const screens = JSON.parse(readFileSync(DATA("screens.json"), "utf8")) as Record<
  string,
  SeedScreen
>;
const arabic = JSON.parse(readFileSync(DATA("screens-ar.json"), "utf8")) as Record<
  string,
  ArabicScreen
>;

const force = process.argv.includes("--force");

function put(target: Localized, ar: string | undefined, where: string) {
  if (ar === undefined || ar.trim() === "" || ar.includes(" | "))
    throw new Error(`No Arabic for ${where}`);
  const existing = target.ar?.trim();
  if (existing && existing !== ar.trim() && !force)
    throw new Error(`${where} already has Arabic ("${existing}"); pass --force to overwrite`);
  target.ar = ar.trim();
}

for (const [kind, ar] of Object.entries(arabic)) {
  const screen = screens[kind];
  if (!screen) throw new Error(`screens.json has no ${kind}`);
  put(screen.brand, ar.brand, `${kind}.brand`);
  put(screen.title, ar.title, `${kind}.title`);
  if (screen.subtitle) put(screen.subtitle, ar.subtitle, `${kind}.subtitle`);
  if ((screen.tags?.length ?? 0) !== (ar.tags?.length ?? 0))
    throw new Error(`${kind}: tag count differs`);
  screen.tags?.forEach((tag, i) => put(tag, ar.tags![i], `${kind}.tags[${i}]`));
  if (screen.items.length !== ar.items.length) throw new Error(`${kind}: item count differs`);
  screen.items.forEach((item, i) => {
    put(item.label, ar.items[i]!.label, `${kind}.items[${i}].label`);
    if (item.meta) put(item.meta, ar.items[i]!.meta, `${kind}.items[${i}].meta`);
  });
  put(screen.cta, ar.cta, `${kind}.cta`);
}

writeFileSync(DATA("screens.json"), `${JSON.stringify(screens, null, 2)}\n`);
rmSync(DATA("screens-ar.json"));
console.log(`Merged Arabic into ${Object.keys(arabic).length} screens`);
