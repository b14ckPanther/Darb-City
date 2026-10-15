import type { KindDto, PlaceDetailDto, SectorDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { crumbsFor, subPlaceChips } from "./crumbs";

const placeDto = (slug: string, type: PlaceDetailDto["type"], name: string) => ({
  id: slug,
  slug,
  type,
  name: { en: name, he: name },
  status: "live" as const,
  lat: 32,
  lng: 35,
  parentId: null,
});
const kiryatHaim: PlaceDetailDto = {
  ...placeDto("kiryat-haim", "neighbourhood", "Kiryat Haim"),
  ancestors: [
    placeDto("israel", "country", "Israel"),
    placeDto("haifa-district", "region", "Haifa District"),
    placeDto("haifa", "city", "Haifa"),
  ],
  children: [],
};
const beauty = { id: "s1", slug: "beauty", name: { en: "Beauty Row" } } as SectorDto;
const barbers = { id: "k1", slug: "barbershops", name: { en: "Barbershops" } } as KindDto;

describe("crumbsFor", () => {
  it("starts at Israel and skips the country and regions", () => {
    expect(crumbsFor("en", { place: kiryatHaim, sector: beauty, kind: barbers })).toEqual([
      { label: "Israel", href: "/en/israel" },
      { label: "Haifa", href: "/en/haifa" },
      { label: "Kiryat Haim", href: "/en/kiryat-haim" },
      { label: "Beauty Row", href: "/en/kiryat-haim/beauty" },
      { label: "Barbershops", href: "/en/kiryat-haim/beauty/barbershops" },
    ]);
  });
  it("ends with the business when there is one", () => {
    const crumbs = crumbsFor("he", {
      place: kiryatHaim,
      sector: beauty,
      kind: barbers,
      business: { slug: "samers-barbershop", name: { en: "Samer's" } },
    });
    expect(crumbs.at(-1)).toEqual({
      label: "Samer's",
      href: "/kiryat-haim/beauty/barbershops/samers-barbershop",
    });
  });
  it("keeps a neighbourhood's business under the listed place", () => {
    const haifa: PlaceDetailDto = {
      ...placeDto("haifa", "city", "Haifa"),
      ancestors: kiryatHaim.ancestors.slice(0, 2),
      children: [placeDto("kiryat-haim", "neighbourhood", "Kiryat Haim")],
    };
    const crumbs = crumbsFor("en", {
      place: haifa,
      sector: beauty,
      kind: barbers,
      business: { slug: "samers-barbershop", name: { en: "Samer's" }, placeSlug: "kiryat-haim" },
    });
    expect(crumbs.at(-2)?.href).toBe("/en/haifa/beauty/barbershops");
    expect(crumbs.at(-1)?.href).toBe("/en/haifa/beauty/barbershops/kiryat-haim/samers-barbershop");
  });
  it("goes straight from Israel to a national kind or a static page", () => {
    expect(crumbsFor("ar", { nationalKind: barbers })).toEqual([
      { label: "إسرائيل", href: "/ar/israel" },
      { label: "Barbershops", href: "/ar/k/barbershops" },
    ]);
    expect(
      crumbsFor("en", { page: { label: "For businesses", href: "/en/for-business" } }),
    ).toHaveLength(2);
  });
});

describe("subPlaceChips", () => {
  const haifa: PlaceDetailDto = {
    ...placeDto("haifa", "city", "Haifa"),
    ancestors: [
      placeDto("israel", "country", "Israel"),
      placeDto("haifa-district", "region", "Haifa District"),
    ],
    children: [placeDto("kiryat-haim", "neighbourhood", "Kiryat Haim")],
  };
  it("offers a city's neighbourhoods with the city itself current", () => {
    expect(subPlaceChips("en", haifa, ["beauty", "barbershops"])).toEqual([
      { key: "haifa", label: "All of Haifa", href: "/en/haifa/beauty/barbershops", current: true },
      {
        key: "kiryat-haim",
        label: "Kiryat Haim",
        href: "/en/kiryat-haim/beauty/barbershops",
        current: false,
      },
    ]);
  });
  it("lets a neighbourhood go back to the whole city", () => {
    expect(subPlaceChips("he", kiryatHaim, [])).toEqual([
      { key: "haifa", label: "כל Haifa", href: "/haifa", current: false },
      { key: "kiryat-haim", label: "Kiryat Haim", href: "/kiryat-haim", current: true },
    ]);
  });
  it("drops neighbourhoods without businesses when given place counts", () => {
    expect(subPlaceChips("en", haifa, [], { haifa: 3, "kiryat-haim": 0 })).toEqual([]);
    expect(subPlaceChips("en", haifa, [], { "kiryat-haim": 2 }).map((c) => c.key)).toEqual([
      "haifa",
      "kiryat-haim",
    ]);
  });
  it("offers nothing for a place without neighbourhoods", () => {
    expect(subPlaceChips("en", { ...haifa, children: [] }, [])).toEqual([]);
  });
});
