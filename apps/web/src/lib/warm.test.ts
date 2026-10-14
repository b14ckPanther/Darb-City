import { expect, it } from "vitest";
// @ts-expect-error: plain ESM script without types
import { locs, shallow } from "../../scripts/warm.mjs";

it("reads sitemap locations and keeps levels 0 to 2", () => {
  const xml = `<urlset><url><loc>https://darb.co.il/</loc></url><url><loc>https://darb.co.il/en/sakhnin/food</loc></url><url><loc>https://darb.co.il/en/sakhnin/food/restaurants/caramel</loc></url></urlset>`;
  const all = locs(xml);
  expect(all).toHaveLength(3);
  expect(all.filter((u: string) => shallow(u, "https://darb.co.il"))).toEqual([
    "https://darb.co.il/",
    "https://darb.co.il/en/sakhnin/food",
  ]);
});
