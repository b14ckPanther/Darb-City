import { expect, it } from "vitest";
import { locs, shallow } from "../../scripts/warm.mjs";

it("reads sitemap locations and keeps levels 0 and 1", () => {
  const xml = `<urlset><url><loc>https://darb.co.il/</loc></url><url><loc>https://darb.co.il/en/sakhnin</loc></url><url><loc>https://darb.co.il/en/sakhnin/food</loc></url><url><loc>https://darb.co.il/k/restaurants</loc></url><url><loc>https://darb.co.il/en/sakhnin/food/restaurants/caramel</loc></url></urlset>`;
  const all = locs(xml);
  expect(all).toHaveLength(5);
  expect(all.filter((u: string) => shallow(u, "https://darb.co.il"))).toEqual([
    "https://darb.co.il/",
    "https://darb.co.il/en/sakhnin",
  ]);
});
