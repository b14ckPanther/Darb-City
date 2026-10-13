import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { isOpenAt } from "@darb/core";
import {
  loadBrands,
  loadBusinesses,
  loadClients,
  loadKinds,
  loadPlaces,
  SCREEN_SCHEMA,
} from "./index.js";

const clients = loadClients();
const places = new Map(loadPlaces().map((p) => [p.slug, p]));
const kinds = new Map(loadKinds().map((k) => [k.slug, k]));
const screen = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, (b.lat - a.lat) * r) * 6371;
};
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const bySlug = (slug: string) => clients.businesses.find((b) => b.slug === slug)!;

describe("real clients", () => {
  it("has Caramel and Raghad linking to their Darb apps, all four on the darb tier", () => {
    expect(clients.businesses.map((b) => `${b.place}/${b.slug}`).sort()).toEqual([
      "akko/caramel",
      "kiryat-ata/paz-kiryat-ata",
      "kiryat-motzkin/paz-kiryat-motzkin",
      "nahf/raghad",
    ]);
    const webs = clients.businesses.map((b) => b.apps?.web);
    for (const name of ["caramel", "raghad"]) expect(webs).toContain(`https://${name}.darb.co.il`);
    expect(clients.businesses.every((b) => b.tier === "darb")).toBe(true);
  });

  it("never links Paz's staff app, and Paz stations have no public app", () => {
    const raw = readFileSync(new URL("../data/clients.json", import.meta.url), "utf8");
    expect(raw).not.toMatch(/paz\.darb\.co\.il/);
    for (const b of clients.businesses.filter((b) => b.brand === "paz")) {
      expect(b.apps ?? {}).toEqual({});
      expect(b.website ?? null).toBeNull();
    }
  });

  it.each(clients.businesses.map((b) => [`${b.place}/${b.slug}`, b] as const))(
    "%s is complete and consistent",
    (_, b) => {
      const place = places.get(b.place);
      expect(place?.status).toBe("live");
      for (const k of b.kinds) expect(kinds.get(k)?.status).toBe("active");
      expect(b.kinds).toContain(b.primaryKind);
      expect(km(place!, b)).toBeLessThan(15); // the pin sits in or near its town
      expect(screen(b.experience)).toBe(true);
      expect(b.phone ?? "").toMatch(/^\+972[0-9 -]{7,15}$/);
      for (const field of [b.name, b.tagline, b.address]) {
        expect(["he", "ar", "en"].every((l) => (field as Record<string, string>)[l])).toBe(true);
      }
      expect(b.tagline.en!.split(/\s+/).length).toBeLessThanOrEqual(8);
      expect(() => isOpenAt(b.hours, new Date())).not.toThrow();
      const { palette } = b.experience;
      expect(contrast(palette.ink, palette.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.ink, palette.surface)).toBeGreaterThanOrEqual(4.5);
      expect(b.experience.items.length).toBeGreaterThanOrEqual(3);
      expect(b.experience.items.length).toBeLessThanOrEqual(8);
    },
  );

  it("records the owner's answers: hours, gluten-free, appointments and pins", () => {
    const caramel = bySlug("caramel");
    expect(caramel.dietary).toEqual(["gluten_free"]);
    expect(caramel.kinds).toEqual(["restaurants", "sweets"]);
    expect(caramel.attributes.delivers).toBe(true);
    expect(caramel.hours.weekly[5]).toEqual([{ open: "09:00", close: "16:30" }]);
    for (const day of [0, 1, 2, 3, 4, 6] as const)
      expect(caramel.hours.weekly[day]).toEqual([{ open: "09:00", close: "17:30" }]);

    const raghad = bySlug("raghad");
    expect(raghad.hours).toEqual({ weekly: {}, exceptions: [], byAppointment: true });
    expect(raghad.attributes.addressHidden).toBe(true);
    // A home business: the pin is the town's own centre, never a street.
    expect([raghad.lat, raghad.lng]).toEqual([places.get("nahf")!.lat, places.get("nahf")!.lng]);
    expect(raghad.whatsapp).toBe(raghad.phone);

    for (const slug of ["paz-kiryat-ata", "paz-kiryat-motzkin"]) {
      const paz = bySlug(slug);
      expect(paz.primaryKind).toBe("stations");
      expect(paz.attributes).toMatchObject({ delivers: false, primaryAction: "directions" });
      for (const day of [0, 1, 2, 3, 4, 5, 6] as const)
        expect(paz.hours.weekly[day]).toEqual([{ open: "00:00", close: "24:00" }]);
      // Fuel is 24/7; only the shop closes on Yom Kippur, said on its item.
      expect(JSON.stringify(paz.experience.items)).toMatch(/Yom Kippur/);
    }
    expect([bySlug("paz-kiryat-motzkin").lat, bySlug("paz-kiryat-motzkin").lng]).toEqual([
      32.8587, 35.0908,
    ]);
    expect(bySlug("paz-kiryat-motzkin").name.he).toBe("פז כורדני");

    // Pins taken from the town's centre until the owner places them in admin.
    const approximate = clients.businesses.filter((b) => b.pinApproximate).map((b) => b.slug);
    expect(approximate.sort()).toEqual(["caramel", "paz-kiryat-ata"]);
    for (const slug of approximate) {
      const b = bySlug(slug);
      expect([b.lat, b.lng]).toEqual([places.get(b.place)!.lat, places.get(b.place)!.lng]);
    }
  });

  it("never uses the word halal", () => {
    const raw = readFileSync(new URL("../data/clients.json", import.meta.url), "utf8");
    expect(raw).not.toMatch(/halal|חלאל|حلال/i);
  });

  it("is merged into the seed and never collides with a showroom slug", () => {
    const all = loadBusinesses();
    const keys = all.map((b) => `${b.place}/${b.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of clients.businesses) expect(keys).toContain(`${c.place}/${c.slug}`);
    const brands = loadBrands().map((b) => b.slug);
    expect(new Set(brands).size).toBe(brands.length);
    for (const b of clients.businesses) expect(brands).toContain(b.brand);
  });
});
