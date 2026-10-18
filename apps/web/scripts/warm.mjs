// After a production deploy: render the home and place pages once, so a later API outage finds
// them cached (hosting decision, Plan 4). Usage: node apps/web/scripts/warm.mjs https://darb.co.il
// Levels 0–1 only: with sector pages it was about 30,000 renders (1,138 places × 18 sectors × 3
// languages), which outran the job's 20 minutes and spent a Vercel function call on each.
export const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

/** Home and place pages in any locale, not sector, kind or business pages. */
export function shallow(url, site) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts[0] === "ar" || parts[0] === "en") parts.shift();
  return url.startsWith(site) && parts.length <= 1 && parts[0] !== "k";
}

async function main(site) {
  const urls = [];
  // The page sitemaps (ids 0, 100, 200: lib/sitemap-ids): business slices hold no shallow page.
  for (const i of [0, 100, 200]) {
    const res = await fetch(`${site}/sitemap/${i}.xml`);
    if (!res.ok) throw new Error(`sitemap ${i}: ${res.status}`);
    urls.push(...locs(await res.text()).filter((u) => shallow(u, site)));
  }
  let done = 0;
  let failed = 0;
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const res = await fetch(url).catch(() => null);
        if (!res?.ok) failed += 1;
        done += 1;
      }
    }),
  );
  console.log(`Warmed ${done - failed}/${done} pages`);
  if (failed > done * 0.05) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`)
  await main(process.argv[2]?.replace(/\/+$/, "") ?? "");
