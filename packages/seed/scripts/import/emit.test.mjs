import { describe, expect, it } from "vitest";
import { business, createSlugger } from "./emit.mjs";

describe("emit", () => {
  it("makes slugs from a prefix and the latin name, unique in their place", () => {
    const slugFor = createSlugger(["haifa/sonol-haifa"]);
    expect(slugFor("haifa", "sonol", "Sonol Haifa")).toBe("sonol-haifa-2");
    expect(slugFor("haifa", "sonol", "Haifa")).toBe("sonol-haifa-3");
    expect(slugFor("akko", "sonol", "Akko North")).toBe("sonol-akko-north");
    expect(slugFor("akko", "bank-leumi", "Akko")).toBe("bank-leumi-akko");
  });
  it("writes a basic listing with directions first and no long dashes", () => {
    const b = business({
      slug: "sonol-akko",
      place: "akko",
      brand: "sonol",
      kinds: ["stations", "car-wash"],
      name: { he: "סונול עכו – צפון", ar: "سونول عكا", en: "Sonol Akko" },
      tagline: { he: "תחנת דלק סונול", ar: "محطة وقود سونول", en: "Sonol fuel station" },
      address: { he: "דרך הארבעה", ar: "عكا", en: "Akko" },
      lat: 32.9281234567,
      lng: 35.0812345678,
      attributes: { fuelAdminNo: 1 },
      screen: {
        title: { he: "תחנת דלק סונול", ar: "محطة وقود سونول", en: "Sonol fuel station" },
        items: [{ label: { he: "דלק", ar: "وقود", en: "Fuel" } }],
        cta: { he: "ניווט לתחנה", ar: "خذني للمحطة", en: "Navigate to the station" },
      },
      accent: "#6fa8dc",
    });
    expect(b).toMatchObject({
      primaryKind: "stations",
      tier: "basic",
      attributes: { primaryAction: "directions", fuelAdminNo: 1 },
      cardStyle: { accent: "#6fa8dc", icons: "solid" },
      experience: { palette: { accent: "#6FA8DC" }, font: "Heebo" },
    });
    expect(b.name.he).toBe("סונול עכו - צפון");
    expect(b.lat).toBe(32.9281235);
  });
});
