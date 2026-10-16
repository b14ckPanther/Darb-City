import { JoinCreateSchema } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { join } from "@/content/join";
import {
  emptyFields,
  fieldErrors,
  fromSuggestion,
  joinBody,
  lookupBody,
  type JoinFields,
} from "./join-form";
import { presetWeek } from "./week-hours";

const filled = (patch: Partial<JoinFields> = {}): JoinFields => ({
  ...emptyFields(),
  name: { he: "", ar: "صالون أبو سمير", en: "" },
  kindSlug: "barbershops",
  placeSlug: "sakhnin",
  point: { lat: 32.8638, lng: 35.3023 },
  address: "  Main St 10 ",
  phone: "04-674-1234",
  instagram: "@abusamir",
  week: presetWeek("sunThu"),
  photos: [{ key: "pending/0190a000-0000-4000-8000-000000000001.webp", url: "u" }],
  ownerName: "Samir",
  ownerPhone: "050-123-4567",
  ...patch,
});
const body = (f: JoinFields) =>
  joinBody(f, { locale: "ar", source: "manual", lookup: null, website2: "" });

describe("the join form", () => {
  it("builds a body the API accepts, WhatsApp from the phone by default", () => {
    const b = body(filled());
    const parsed = JoinCreateSchema.parse(b);
    expect(parsed).toMatchObject({
      name: { ar: "صالون أبو سمير" },
      address: { ar: "Main St 10" },
      phone: "04-674-1234",
      whatsapp: "04-674-1234",
      links: { instagram: "https://www.instagram.com/abusamir/" },
      cardStyle: { accent: "#d9a54c", icons: "line" },
      owner: { name: "Samir", phone: "050-123-4567" },
    });
    expect(Object.keys(parsed.hours.weekly)).toHaveLength(6);
    expect(b).not.toHaveProperty("note");
    expect(body(filled({ whatsappSame: false, whatsapp: "" })).whatsapp).toBeNull();
  });

  it("finds the same problems the API would, and nothing on a good form", () => {
    expect(fieldErrors(filled())).toEqual({});
    const bad = filled({
      name: { he: " ", ar: "", en: "" },
      kindSlug: "",
      placeSlug: "",
      point: { lat: 48.8, lng: 2.3 },
      phone: "call me",
      website: "not a site",
      instagram: "https://evil.example/x",
      ownerName: "S",
      ownerPhone: "",
      ownerEmail: "nope",
    });
    expect(Object.keys(fieldErrors(bad)).sort()).toEqual(
      [
        "instagram",
        "kind",
        "name",
        "ownerEmail",
        "ownerName",
        "ownerPhone",
        "phone",
        "place",
        "point",
        "website",
      ].sort(),
    );
    for (const f of [filled({ ownerName: "S" }), filled({ website: "not a site" })])
      expect(JoinCreateSchema.safeParse(body(f)).success).toBe(false);
  });

  it("starts from what the lookup found", () => {
    const f = fromSuggestion({
      found: true,
      point: { lat: 32.86, lng: 35.3 },
      placeSlug: "sakhnin",
      kindSlug: "barbershops",
      name: { en: "Abu Samir" },
      phone: "04-674-1234",
      whatsapp: "050-000-0000",
      links: { instagram: "https://www.instagram.com/abusamir/" },
      hours: { weekly: { "0": [{ open: "09:00", close: "19:00" }] }, exceptions: [] },
      sources: [],
      osm: true,
    });
    expect(f).toMatchObject({
      name: { he: "", ar: "", en: "Abu Samir" },
      placeSlug: "sakhnin",
      whatsappSame: false,
      instagram: "https://www.instagram.com/abusamir/",
    });
    expect(f.week[0]).toEqual({ open: true, from: "09:00", to: "19:00" });
  });

  it("tells links from names", () => {
    expect(lookupBody("https://maps.app.goo.gl/x", "he")).toEqual({
      url: "https://maps.app.goo.gl/x",
      locale: "he",
    });
    expect(lookupBody("instagram.com/abusamir", "he")).toHaveProperty("url");
    expect(lookupBody("Abu Samir, Sakhnin", "ar")).toEqual({
      query: "Abu Samir, Sakhnin",
      locale: "ar",
    });
  });
});

describe("the page's words", () => {
  const all = JSON.stringify(join);

  it("never uses long dashes or the Hebrew maqaf, and never the word halal", () => {
    expect(all).not.toMatch(/[–—־]/);
    expect(all).not.toMatch(/halal|חלאל|حلال/i);
  });

  it("speaks everyday Arabic and never names languages", () => {
    expect(all).not.toMatch(/هلأ|هلقيت/);
    expect(join.ar.find.here).toBe("أنا موجود بالمصلحة");
    expect(all).not.toMatch(/Hebrew|Arabic|English|עברית|ערבית|אנגלית|العربية|العبرية/);
  });

  it("thanks people and says what happens next, in every language", () => {
    expect(`${join.en.done.title} ${join.en.done.body}`).toBe(
      "Thanks! We got it. We'll check and publish your card soon. We may call to confirm.",
    );
    for (const l of ["he", "ar"] as const) expect(join[l].done.body.trim()).not.toBe("");
  });
});
