// Prints every live settlement in the Northern and Haifa districts with its CBS code and names, to
// curate data/weekend.json by hand. Usage: pnpm --filter @darb/seed exec tsx scripts/weekend-candidates.ts
import { loadPlaces } from "../src/index.js";

for (const p of loadPlaces()
  .filter(
    (x) =>
      x.status === "live" &&
      x.cbsCode &&
      ["northern-district", "haifa-district"].includes(x.parent ?? ""),
  )
  .sort((a, b) => Number(a.cbsCode) - Number(b.cbsCode))) {
  console.log([p.cbsCode, p.slug, p.name.he, p.name.ar, p.name.en].join("\t"));
}
