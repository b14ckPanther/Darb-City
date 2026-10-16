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
  logo: null,
  links: {},
  cardStyle: {},
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

describe("Darb clients (Task 28)", () => {
  const caramel = detail({
    apps: { web: "https://caramel.darb.co.il" },
    website: "https://caramel.darb.co.il",
    experience: {
      brand: { en: "Caramel" },
      title: { en: "A celiac's paradise" },
      items: [{ label: { en: "Meals" } }],
      cta: { en: "Open menu" },
      palette: { bg: "#0D0806", surface: "#1F1712", ink: "#FBF3E6", accent: "#E9A43A" },
      font: "Heebo",
    },
  });
  it("opens the app from the main button, once, and says Built by Darb with a link to Darb", () => {
    const { container } = view(caramel);
    const main = container.querySelector("[data-primary-action]")!;
    expect([main.textContent, main.getAttribute("href")]).toEqual([
      "Open menu",
      "https://caramel.darb.co.il/",
    ]);
    expect(container.querySelectorAll('a[href="https://caramel.darb.co.il/"]')).toHaveLength(1);
    const note = container.querySelector("[data-built-by-darb] a")!;
    expect([note.textContent, note.getAttribute("href")]).toEqual([
      "Built by Darb",
      "/en/for-business",
    ]);
  });
  it("puts the note on every darb-tier listing and never on others", () => {
    const { container, unmount } = view(detail({ tier: "verified" }));
    expect(container.querySelector("[data-built-by-darb]")).toBeNull();
    unmount();
    view(detail(), "he");
    expect(screen.getByText("נבנה על ידי דרב").getAttribute("href")).toBe("/for-business");
  });
  it("shows By appointment instead of open or closed, and no hours table", () => {
    const raghad = detail({
      openNow: null,
      hours: { weekly: {}, exceptions: [], byAppointment: true },
      attributes: { delivers: true, addressHidden: true },
      whatsapp: "+972 50-477-4367",
    });
    const { container } = view(raghad, "he");
    expect(container.querySelector("[data-appointment]")?.textContent).toBe("בתיאום מראש");
    expect(container.querySelector("[data-open]")).toBeNull();
    expect(container.querySelector("table")).toBeNull();
    // A home business: no directions to the town's centre.
    expect(container.querySelector('a[href*="google.com/maps"]')).toBeNull();
  });
  it("navigates from a station's main button", () => {
    const { container } = view(
      detail({ attributes: { primaryAction: "directions" }, lat: 32.8587, lng: 35.0908 }),
    );
    expect(container.querySelector("[data-primary-action]")?.getAttribute("href")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=32.8587,35.0908",
    );
    expect(container.querySelectorAll('a[href*="google.com/maps"]')).toHaveLength(1);
  });
  it("never links Paz's staff app", () => {
    const { container } = view(detail({ apps: {} }));
    expect(container.innerHTML).not.toMatch(/paz\.darb\.co\.il/);
  });
});
