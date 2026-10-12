// Prints, for one sector, every showroom screen still missing Arabic, shaped like
// data/screens-ar.json with "Hebrew | English" in place of each Arabic string.
// Usage: pnpm --filter @darb/seed exec tsx scripts/arabic-todo.ts <sector-slug>
import type { Localized } from "@darb/core";
import { loadKinds, loadScreens } from "../src/index.js";

const sector = process.argv[2];
if (!sector) throw new Error("Usage: tsx scripts/arabic-todo.ts <sector-slug>");
const screens = loadScreens();
const both = (v: Localized) => `${v.he ?? ""} | ${v.en ?? ""}`;
const todo = Object.fromEntries(
  loadKinds()
    .filter((k) => k.sector === sector && !screens[k.slug]!.brand.ar)
    .map((k) => {
      const s = screens[k.slug]!;
      return [
        k.slug,
        {
          brand: both(s.brand),
          title: both(s.title),
          ...(s.subtitle ? { subtitle: both(s.subtitle) } : {}),
          ...(s.tags ? { tags: s.tags.map(both) } : {}),
          items: s.items.map((i) => ({
            label: both(i.label),
            ...(i.meta ? { meta: both(i.meta) } : {}),
          })),
          cta: both(s.cta),
        },
      ];
    }),
);
console.log(JSON.stringify(todo, null, 2));
