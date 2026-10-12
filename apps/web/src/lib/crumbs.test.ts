import type { KindDto, PlaceDetailDto, SectorDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { crumbsFor } from "./crumbs";

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
      { label: "Israel", href: "/en" },
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
  it("goes straight from Israel to a national kind or a static page", () => {
    expect(crumbsFor("ar", { nationalKind: barbers })).toEqual([
      { label: "إسرائيل", href: "/ar" },
      { label: "Barbershops", href: "/ar/k/barbershops" },
    ]);
    expect(
      crumbsFor("en", { page: { label: "For businesses", href: "/en/for-business" } }),
    ).toHaveLength(2);
  });
});
