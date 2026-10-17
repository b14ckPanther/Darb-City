import { describe, expect, it } from "vitest";
import { classify, cuisineOf, exclusion } from "./food-kinds.mjs";
import { hebrewFromArabic, latinFromArabic } from "./arabic-names.mjs";

describe("never listed", () => {
  it("bars, pubs, nightclubs and brewpubs", () => {
    expect(exclusion({ amenity: "bar", name: "Haifa Bar" })).toBe("bar");
    expect(exclusion({ amenity: "pub", name: "פאב השכונה" })).toBe("bar");
    expect(exclusion({ amenity: "biergarten", name: "Garden" })).toBe("bar");
    expect(exclusion({ amenity: "restaurant", name: "Smoky Bar" })).toBe("bar");
    expect(exclusion({ amenity: "restaurant", name: "פטריקס בר" })).toBe("bar");
    expect(exclusion({ amenity: "restaurant", name: "ביסטרו", microbrewery: "yes" })).toBe("bar");
    expect(exclusion({ amenity: "restaurant", name: "X", cuisine: "burger;bar_and_grill" })).toBe(
      "bar",
    );
    expect(exclusion({ amenity: "nightclub", name: "Club 9" })).toBe("nightclub");
  });
  it("alcohol shops and places named for drink", () => {
    for (const shop of ["alcohol", "wine", "beverages"])
      expect(exclusion({ shop, name: "משקאות" }), shop).toBe("alcohol");
    expect(exclusion({ amenity: "restaurant", name: "שבתאי פיצה ובירה" })).toBe("alcohol");
    expect(exclusion({ amenity: "restaurant", name: "Wine & Steak" })).toBe("alcohol");
    expect(exclusion({ amenity: "restaurant", name: "X", "drink:beer": "yes" })).toBe("alcohol");
  });
  it("pork, in a name, a cuisine or a description, in any language", () => {
    expect(exclusion({ amenity: "restaurant", name: "Pork & Co" })).toBe("pork");
    expect(exclusion({ amenity: "restaurant", name: "X", cuisine: "pork;grill" })).toBe("pork");
    expect(exclusion({ amenity: "restaurant", name: "מסעדה", description: "בשר חזיר" })).toBe(
      "pork",
    );
    expect(exclusion({ amenity: "restaurant", name: "لحم خنزير" })).toBe("pork");
    expect(exclusion({ amenity: "fast_food", name: "Bacon Burger" })).toBe("pork");
  });
  it("gambling, lottery and wineries", () => {
    expect(exclusion({ shop: "lottery", name: "לוטו" })).toBe("gambling");
    expect(exclusion({ amenity: "casino", name: "Casino" })).toBe("gambling");
    expect(exclusion({ amenity: "gambling", name: "X" })).toBe("gambling");
    expect(exclusion({ craft: "winery", name: "יקב הגליל" })).toBe("winery");
    expect(exclusion({ amenity: "restaurant", name: "יקבי יושפה" })).toBe("winery");
  });
  it("keeps food counters called bars and look-alike words", () => {
    for (const name of [
      "Juice Bar",
      "Igloo Yogurt Bar",
      "ארומה אספרסו בר",
      "סושי בר",
      "בר בשר",
      "רי בר",
      "שווארמה ברמה",
      "Barbecue House",
      "Hamburger King",
      "Bet Lehem Falafel",
      "Hummus Bar-Ilan",
    ])
      expect(exclusion({ amenity: "restaurant", name }), name).toBeNull();
    // OSM's "has a bar" alone does not make a restaurant a bar.
    expect(exclusion({ amenity: "restaurant", name: "Benedict", bar: "yes" })).toBeNull();
  });
});

describe("food kinds", () => {
  const kinds = (tags) => classify(tags)?.kinds;
  it("read shops and crafts by their tag", () => {
    expect(kinds({ shop: "butcher", name: "אטליז" })).toEqual(["butchers"]);
    expect(kinds({ craft: "caterer", name: "X" })[0]).toBe("catering");
    expect(kinds({ office: "catering", name: "X" })[0]).toBe("catering");
    expect(kinds({ shop: "coffee", name: "X" })[0]).toBe("roastery");
    expect(kinds({ shop: "nuts", name: "X" })[0]).toBe("roastery");
    expect(kinds({ shop: "bakery", name: "X" })[0]).toBe("bakeries");
    expect(kinds({ shop: "confectionery", name: "X" })[0]).toBe("sweets");
    expect(kinds({ shop: "pastry", name: "X" })[0]).toBe("sweets");
    expect(kinds({ amenity: "ice_cream", name: "X" })[0]).toBe("ice-cream");
    expect(kinds({ shop: "juice", name: "X" })[0]).toBe("juice-shops");
    expect(kinds({ shop: "deli", name: "X" })[0]).toBe("meal-prep");
    expect(kinds({ amenity: "fast_food", street_vendor: "yes", name: "X" })[0]).toBe("food-trucks");
  });
  it("read names in Hebrew, Arabic and English", () => {
    expect(kinds({ amenity: "fast_food", name: "שווארמה אבו סאלח" })[0]).toBe("grill");
    expect(kinds({ amenity: "restaurant", name: "مشاوي الجليل" })[0]).toBe("grill");
    expect(kinds({ amenity: "fast_food", name: "Falafel Jabali" })[0]).toBe("hummus");
    expect(kinds({ amenity: "restaurant", name: "חומוס אליהו" })[0]).toBe("hummus");
    expect(kinds({ amenity: "restaurant", name: "حمص أبو شكري" })[0]).toBe("hummus");
    expect(kinds({ amenity: "cafe", name: "גלידריה של ז'וז'ו" })[0]).toBe("ice-cream");
    expect(kinds({ amenity: "restaurant", name: "حلويات الشرق" })[0]).toBe("sweets");
    expect(kinds({ amenity: "restaurant", name: "כנאפה נאבלסית" })[0]).toBe("sweets");
    expect(kinds({ amenity: "restaurant", name: "مخبز وفرن العائلة" })[0]).toBe("bakeries");
    expect(kinds({ amenity: "restaurant", name: "عصير الربيع" })[0]).toBe("juice-shops");
    expect(kinds({ amenity: "fast_food", name: "بوظة ركب" })[0]).toBe("ice-cream");
  });
  it("read the cuisine's first value, and keep a café and a restaurant as such", () => {
    expect(kinds({ amenity: "restaurant", name: "X", cuisine: "kebab" })).toEqual([
      "grill",
      "restaurants",
    ]);
    expect(kinds({ amenity: "restaurant", name: "X", cuisine: "pizza;dessert" })).toEqual([
      "restaurants",
    ]);
    expect(kinds({ amenity: "cafe", name: "X", cuisine: "ice_cream" })).toEqual([
      "cafes",
      "ice-cream",
    ]);
    expect(kinds({ amenity: "fast_food", name: "X", cuisine: "coffee_shop" })[0]).toBe("cafes");
    expect(kinds({ amenity: "fast_food", name: "X", cuisine: "burger" })).toEqual(["restaurants"]);
  });
  it("adds secondary kinds from the name, at most three", () => {
    expect(kinds({ amenity: "fast_food", name: "פלאפל ושווארמה הכרמל" })).toEqual([
      "hummus",
      "grill",
    ]);
    expect(kinds({ amenity: "cafe", name: "Café Knafeh", cuisine: "ice_cream" })).toHaveLength(3);
  });
  it("lists dishes from the cuisine and the name for deep search", () => {
    const c = classify({ amenity: "fast_food", name: "פלאפל הכרמל", cuisine: "shawarma;arab" });
    expect(c.dishes).toEqual(["falafel", "shawarma"]);
    expect(c.styles.map((s) => s.en)).toEqual(["Arab cuisine"]);
    expect(cuisineOf({ cuisine: "שווארמה;فلافل" }).dishes).toEqual(["shawarma", "falafel"]);
  });
  it("is null for what is not food", () => {
    expect(classify({ amenity: "courthouse", name: "X" })).toBeNull();
    expect(classify({ shop: "spices", name: "X" })).toBeNull();
  });
});

describe("Arabic names in other letters", () => {
  it("says food words and spells the rest", () => {
    expect(hebrewFromArabic("فلافل جبالي")).toBe("פלאפל ג'באלי");
    expect(latinFromArabic("فلافل جبالي")).toBe("Falafel Jabali");
    expect(latinFromArabic("الشيخ - حمص")).toBe("Al-Shikh - Hummus");
    expect(hebrewFromArabic("مطعم السلطان")).toBe("מסעדת אל-סלטאן");
  });
});
