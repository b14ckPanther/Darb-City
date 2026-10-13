import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BusinessDetailDto, KindDto } from "@darb/contracts";
import { ExperienceView } from "./ExperienceView";

const kind: KindDto = {
  id: "k1",
  slug: "restaurants",
  sectorId: "s1",
  parentKindId: null,
  name: { en: "Restaurants", he: "מסעדות" },
  template: "menu",
  attributes: ["delivers"],
  icon: null,
  order: 1,
};
export const detail = (over: Partial<BusinessDetailDto> = {}): BusinessDetailDto => ({
  id: "b1",
  slug: "caramel",
  name: { en: "Caramel", he: "קרמל" },
  tagline: { en: "A celiac's paradise" },
  tier: "darb",
  primaryKindId: "k1",
  placeId: "p1",
  placeSlug: "akko",
  lat: 32.92,
  lng: 35.07,
  photo: null,
  openNow: true,
  hours: { weekly: { "0": [{ open: "09:00", close: "17:30" }] }, exceptions: [] },
  dietary: [],
  kindIds: ["k1"],
  address: { en: "Akko" },
  phone: "+972 52-438-2229",
  whatsapp: null,
  website: null,
  photos: [],
  attributes: {},
  experience: {},
  apps: {},
  brandId: null,
  ...over,
});
const view = (b: BusinessDetailDto, locale: "he" | "ar" | "en" = "en") =>
  render(
    <ExperienceView
      locale={locale}
      business={b}
      kind={kind}
      placeName="Akko"
      segments={["akko", "food", "restaurants", "caramel"]}
      shareUrl="https://darb.co.il/en/akko/food/restaurants/caramel"
    />,
  );

describe("gluten-free badge (Task 27b)", () => {
  it("shows on a fully gluten-free kitchen, in each language", () => {
    const { container, unmount } = view(detail({ dietary: ["gluten_free"] }));
    expect(container.querySelector("[data-gluten-free]")?.textContent).toBe("Gluten-free");
    unmount();
    view(detail({ dietary: ["gluten_free"] }), "he");
    expect(screen.getByText("ללא גלוטן")).toBeTruthy();
  });
  it("never shows without the dietary fact", () => {
    const { container } = view(detail());
    expect(container.querySelector("[data-gluten-free]")).toBeNull();
  });
});
