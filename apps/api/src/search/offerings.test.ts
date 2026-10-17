import { describe, expect, it } from "vitest";
import { businessDocument } from "./documents.js";
import { extractOfferings, MAX_OFFERINGS, offeringsText } from "./offerings.js";

/** Caramel's card as clients.json has it (trimmed). */
const caramel = {
  tagline: { he: "גן עדן לצליאקים, הכל ללא גלוטן", en: "A celiac's paradise, 100% gluten-free" },
  experience: {
    tags: [
      { he: "ללא גלוטן", ar: "خالٍ من الغلوتين", en: "Gluten-free" },
      { he: "משלוחים", ar: "توصيل", en: "Delivery" },
    ],
    items: [
      {
        label: { he: "ארוחות", ar: "وجبات", en: "Meals" },
        meta: {
          he: "כריכי חלה ולאפה: שניצל, קבב, שווארמה",
          ar: "سندويشات حلّة ولفّة: شنيتسل، كباب، شاورما",
          en: "Challah and laffa sandwiches: schnitzel, kebab, shawarma",
        },
      },
      { label: { he: "המבורגרים וקריספי בורגר", en: "Burgers and crispy burger" } },
      {
        label: { he: "קינוחים ועוגות", ar: "حلويات وكعكات", en: "Desserts and cakes" },
        meta: {
          he: "כולל כנאפה ללא גלוטן",
          ar: "بما فيها كنافة خالية من الغلوتين",
          en: "Including gluten-free knafeh",
        },
      },
    ],
  },
  kinds: [
    {
      slug: "restaurants",
      name: { he: "מסעדות", ar: "مطاعم", en: "Restaurants" },
      synonyms: { he: ["מסעדה"], ar: ["مطعم"], en: ["restaurant", "food"] },
    },
  ],
};

describe("offerings", () => {
  const offerings = extractOfferings(caramel);
  const byRef = new Map(offerings.map((o) => [o.ref, o]));

  it("splits a meta list into one offering per thing, aligned across languages", () => {
    expect(byRef.get("items.0.meta.2")).toMatchObject({
      source: "part",
      label: { he: "שווארמה", ar: "شاورما", en: "shawarma" },
      // The list's own heading is the context, not the bare item label.
      context: {
        he: "כריכי חלה ולאפה",
        ar: "سندويشات حلّة ولفّة",
        en: "Challah and laffa sandwiches",
      },
    });
    expect(byRef.get("items.0.meta.0")?.label.en).toBe("schnitzel");
    expect(byRef.get("items.0.meta.1")?.label.he).toBe("קבב");
    // The item label stays searchable on its parts.
    expect(byRef.get("items.0.meta.2")?.text).toContain("ארוחות");
  });

  it("keeps the item itself, with its meta line as context", () => {
    expect(byRef.get("items.0")).toMatchObject({
      source: "item",
      label: { he: "ארוחות", ar: "وجبات", en: "Meals" },
    });
    expect(byRef.get("items.0")?.context?.en).toContain("shawarma");
    expect(byRef.get("items.1")).toMatchObject({ source: "item", context: null });
  });

  it("drops a lead-in word and keeps the item as context when the meta has no heading", () => {
    expect(byRef.get("items.2.meta.0")).toMatchObject({
      label: {
        he: "כנאפה ללא גלוטן",
        ar: "كنافة خالية من الغلوتين",
        en: "gluten-free knafeh",
      },
      context: { he: "קינוחים ועוגות", ar: "حلويات وكعكات", en: "Desserts and cakes" },
    });
  });

  it("adds tags, the tagline and each kind (with its synonyms in the text)", () => {
    expect(byRef.get("tags.0")?.labelText).toContain("ללא גלוטנ");
    expect(byRef.get("tagline")?.source).toBe("tagline");
    const kind = byRef.get("kind:restaurants")!;
    expect(kind.source).toBe("kind");
    expect(kind.text).toContain("restaurant");
    expect(kind.text).toContain("מסעדה");
    // A synonym names the kind as exactly as its name does.
    expect(kind.labelForms).toEqual(expect.arrayContaining(["מסעדות", "restaurant", "food"]));
  });

  it("normalizes text in every language (finals folded, marks dropped)", () => {
    const shawarma = byRef.get("items.0.meta.2")!;
    expect(shawarma.labelText).toBe("שווארמה شاورما shawarma");
    expect(byRef.get("items.0.meta.0")!.labelText).toContain("שניצל");
  });

  it("never makes an offering of a price, a time or a percentage", () => {
    const showroom = extractOfferings({
      tagline: {},
      kinds: [],
      experience: {
        items: [
          { label: { en: "Musakhan" }, meta: { en: "₪68 · chicken, sumac, onion" } },
          { label: { en: "Order received" }, meta: { en: "20:05 · 100%" } },
        ],
      },
    });
    expect(showroom.map((o) => o.label.en)).toEqual([
      "Musakhan",
      "chicken",
      "sumac",
      "onion",
      "Order received",
    ]);
  });

  it("keeps each language's parts on their own when the lists do not line up", () => {
    const uneven = extractOfferings({
      tagline: {},
      kinds: [],
      experience: {
        items: [{ label: { en: "Grill" }, meta: { he: "שניצל, קבב", en: "schnitzel and kebab" } }],
      },
    });
    expect(uneven.filter((o) => o.source === "part").map((o) => o.label)).toEqual([
      { he: "שניצל" },
      { he: "קבב" },
      { en: "schnitzel and kebab" },
    ]);
  });

  it("makes one offering of the same thing said twice, and stays bounded", () => {
    const twice = extractOfferings({
      tagline: {},
      kinds: [],
      experience: {
        items: [{ label: { en: "Car wash" } }],
        tags: [{ en: "Car Wash" }, null, "not localized"],
      },
    });
    expect(twice.map((o) => o.ref)).toEqual(["items.0"]);
    const many = extractOfferings({
      tagline: {},
      kinds: [],
      experience: { items: Array.from({ length: 99 }, (_, i) => ({ label: { en: `Dish ${i}` } })) },
    });
    expect(many).toHaveLength(MAX_OFFERINGS);
  });

  it("reads a broken experience as nothing, never a crash", () => {
    expect(extractOfferings({ tagline: {}, kinds: [], experience: { items: "x" } })).toEqual([]);
    expect(
      extractOfferings({ tagline: {}, kinds: [], experience: { items: [null, { meta: {} }] } }),
    ).toEqual([]);
  });

  it("puts what is inside the card into the business's own search text", () => {
    expect(offeringsText(offerings)).toContain("shawarma");
    const doc = businessDocument({
      id: "b1",
      slug: "caramel",
      tier: "darb",
      lat: 32.92,
      lng: 35.07,
      name: { en: "Caramel" },
      tagline: caramel.tagline,
      address: { en: "Akko" },
      phone: null,
      whatsapp: null,
      website: null,
      photos: [],
      hours: { weekly: {}, exceptions: [] },
      attributes: {},
      experience: caramel.experience,
      placePath: "/israel/northern-district/akko/",
      placeName: { en: "Akko" },
      placePoint: { lat: 32.92, lng: 35.07 },
      kinds: caramel.kinds.map((k) => ({ ...k, id: "k1" })),
    });
    expect(doc.text).toContain("שווארמה");
    expect(doc.text).toContain("knafeh");
    expect(doc.embedText).toContain("shawarma");
  });
});
