import { describe, expect, it } from "vitest";
import { GLYPH_RULES, GLYPHS, glyphFor } from "./glyphs";

describe("glyphFor: a label's glyph, by its English", () => {
  it.each([
    // The real imports' most common labels, per template.
    ["Coffee", "cup"],
    ["Home food", "pot"],
    ["Sweets", "cake"],
    ["Desserts and cakes", "cake"],
    ["Bread and pastries", "bread"],
    ["Ice cream", "icecream"],
    ["Pizza", "pizza"],
    ["Burgers", "burger"],
    ["Shawarma", "skewer"],
    ["Sushi", "noodles"],
    ["Hummus", "bowl"],
    ["Meals", "plate"],
    ["Supermarket", "cart"],
    ["Clothing and fashion", "hanger"],
    ["Kids' clothes", "hanger"],
    ["Pharmacy", "pill"],
    ["Car parts", "gear"],
    ["Chain", "store"],
    ["Health fund clinic", "stethoscope"],
    ["Dental clinic", "tooth"],
    ["Hair salon", "scissors"],
    ["Kids' cut", "scissors"],
    ["Nail salon", "bottle"],
    ["Padel and tennis", "racket"],
    ["Camping", "tent"],
    ["Law office", "scales"],
    ["Escape room", "ticket"],
    ["Kindergarten", "blocks"],
    ["Daycare", "blocks"],
    ["Special education", "cap"],
    ["High school", "cap"],
    ["Ministry symbol", "id"],
    ["Supervision", "shield"],
    ["Branch number", "id"],
    ["Closed on", "calendar"],
    ["Hotel and guesthouse", "bed"],
    ["Post office", "mail"],
    ["Council offices", "bank"],
    ["Synagogue", "candle"],
    ["Mosque", "candle"],
    ["Swimming pool", "waves"],
    ["Bus and train station", "bus"],
    ["Youth club", "people"],
    ["Diesel engines", "engine"],
    ["Paintwork", "brush"],
    ["Tyres", "tyre"],
    ["Electrics, plumbing and AC", "bolt"],
    ["Car air conditioning", "snow"],
    ["Currency exchange", "exchange"],
    ["Gold and jewellery", "gem"],
    ["Renovation and building supplies", "hammer"],
    ["Car park", "parking"],
    ["Car wash", "carwash"],
    ["Tours and attractions", "ticket"],
    ["Gym", "dumbbell"],
    ["Plant nursery", "sprout"],
    ["Florist", "flower"],
    ["Optician", "glasses"],
    ["Fresh meat", "meat"],
    ["Car rental", "key"],
    ["Nonprofit", "heart"],
    ["Photography", "camera"],
    ["Art and handmade", "palette"],
    // Amenities (tags) and facts.
    ["Takeaway", "bag"],
    ["Outdoor seating", "sun"],
    ["Delivery", "scooter"],
    ["Wheelchair accessible", "access"],
    ["Vegan options", "leaf"],
    ["Gluten-free", "wheat"],
    ["Open 24/7", "clock"],
    ["16:30", "clock"],
    ["₪250", "coin"],
  ])("%s → %s", (label, glyph) => {
    expect(glyphFor(label)).toBe(glyph);
  });

  it("keeps words inside other words apart", () => {
    // "start" is not a star, "Monthly" not a Monday, a lone "Plan" a ticket's plan not a blueprint.
    expect(glyphFor("Mornings start here")).not.toBe("star");
    expect(glyphFor("Monthly giving")).toBe("heart");
    expect(glyphFor("Plan")).toBe("ticket");
  });

  it("leaves the unknown to the plain dot", () => {
    expect(glyphFor("Boys")).toBeNull();
    expect(glyphFor("")).toBeNull();
    expect(glyphFor(undefined)).toBeNull();
  });

  it("only ever names a glyph that is drawn", () => {
    for (const [name] of GLYPH_RULES) expect(GLYPHS).toHaveProperty(name);
  });
});
