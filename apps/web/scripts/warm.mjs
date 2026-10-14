// After a production deploy: render every level 0–2 page once, so a later API outage finds them
// cached (hosting decision, Plan 4). Usage: node apps/web/scripts/warm.mjs https://darb.co.il
export const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

/** Home, place and place/sector pages in any locale (and /k/<kind>), not businesses or kind lists. */
export function shallow(url, site) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts[0] === "ar" || parts[0] === "en") parts.shift();
  return url.startsWith(site) && parts.length <= 2;
}

async function main(site) {
  const urls = [];
  for (const i of [0, 1, 2]) {
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
