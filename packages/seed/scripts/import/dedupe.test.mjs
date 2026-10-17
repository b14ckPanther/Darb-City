import { describe, expect, it } from "vitest";
import { dedupe, sameBusiness, similarNames } from "./dedupe.mjs";

const rec = (over) => ({
  slug: "x",
  place: "haifa",
  name: { he: "סונול חיפה", ar: "سونول حيفا", en: "Sonol Haifa" },
  lat: 32.8,
  lng: 35.0,
  attributes: {},
  kinds: ["stations"],
  experience: { items: [] },
  ...over,
});

describe("dedupe", () => {
  it("knows similar names", () => {
    expect(similarNames({ he: "סונול חיפה" }, { he: "תחנת דלק סונול חיפה" })).toBe(true);
    expect(similarNames({ en: "Delek Karmiel" }, { en: "Delek Karmiel East" })).toBe(true);
    expect(similarNames({ he: "סונול חיפה" }, { he: "דלק עכו" })).toBe(false);
  });
  it("is one business within 120 m under a similar name, or under one official id", () => {
    const a = rec({});
    expect(sameBusiness(a, rec({ lat: 32.8008 }))).toBe(true); // ~90 m
    expect(sameBusiness(a, rec({ lat: 32.802 }))).toBe(false); // ~220 m
    expect(sameBusiness(a, rec({ name: { he: "דלק עכו", en: "Delek Akko" } }))).toBe(false);
    const ids = ["fuelAdminNo"];
    const far = rec({ lat: 33, attributes: { fuelAdminNo: 7 } });
    expect(sameBusiness(rec({ attributes: { fuelAdminNo: 7 } }), far, ids)).toBe(true);
    expect(
      sameBusiness(
        rec({ attributes: { fuelAdminNo: 8 } }),
        rec({ attributes: { fuelAdminNo: 7 } }),
        ids,
      ),
    ).toBe(false);
  });
  it("keeps the richer record and drops what is already published", () => {
    const poor = rec({ slug: "poor" });
    const rich = rec({ slug: "rich", phone: "+972 4-812-3456", kinds: ["stations", "car-wash"] });
    const other = rec({ slug: "other", lat: 32.9 });
    const { kept, dropped } = dedupe([poor, rich, other]);
    expect(kept.map((r) => r.slug)).toEqual(["rich", "other"]);
    expect(dropped).toMatchObject([
      { record: { slug: "poor" }, keptAs: "haifa/rich", why: "duplicate" },
    ]);
    const again = dedupe([other], { existing: [rec({ slug: "paz", lat: 32.9 })] });
    expect(again.kept).toEqual([]);
    expect(again.dropped[0].why).toBe("existing");
  });
});
