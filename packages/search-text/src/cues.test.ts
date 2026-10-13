import { describe, expect, it } from "vitest";
import { detectCues } from "./cues.js";
import { normalize } from "./normalize.js";

const cues = (q: string) => detectCues(normalize(q));

describe("filter cues", () => {
  it("finds open now, delivery and near me in English", () => {
    expect(cues("knafeh near me open now")).toEqual({
      cues: { openNow: true, delivers: false, nearMe: true, glutenFree: false },
      rest: "knafeh",
    });
    expect(cues("pizza delivery haifa").cues.delivers).toBe(true);
  });
  it("in Hebrew", () => {
    expect(cues("חומוס פתוח עכשיו לידי").cues).toEqual({
      openNow: true,
      delivers: false,
      nearMe: true,
      glutenFree: false,
    });
    expect(cues("שווארמה עם משלוחים").rest).toBe(normalize("שווארמה עם"));
  });
  it("in Arabic", () => {
    expect(cues("حلويات مفتوح هلأ قريب مني").cues).toEqual({
      openNow: true,
      delivers: false,
      nearMe: true,
      glutenFree: false,
    });
    expect(cues("مطعم توصيل").cues.delivers).toBe(true);
  });
  it("matches whole words only", () => {
    expect(cues("opener").cues.openNow).toBe(false);
    expect(cues("deliveroo").cues.delivers).toBe(false);
  });
});

describe("gluten-free cue (Task 27b)", () => {
  it.each([
    "ללא גלוטן",
    "גלוטן פרי",
    "צליאק",
    "לצליאקים",
    "נטול גלוטן",
    "خالي من الغلوتين",
    "خالٍ من الغلوتين",
    "خالية من الغلوتين",
    "بدون غلوتين",
    "سيلياك",
    "gluten free",
    "gluten-free",
    "Gluten Free",
    "celiac",
    "coeliac",
  ])("%s asks for a gluten-free kitchen and leaves no words behind", (q) => {
    expect(cues(q)).toMatchObject({ cues: { glutenFree: true }, rest: "" });
  });
  it("keeps the rest of the query", () => {
    expect(cues("מסעדה ללא גלוטן בעכו")).toEqual({
      cues: { openNow: false, delivers: false, nearMe: false, glutenFree: true },
      rest: normalize("מסעדה בעכו"),
    });
    expect(cues("gluten free cakes open now").cues).toMatchObject({
      glutenFree: true,
      openNow: true,
    });
  });
  it("never fires on gluten alone or look-alikes", () => {
    expect(cues("gluten").cues.glutenFree).toBe(false);
    expect(cues("free parking").cues.glutenFree).toBe(false);
  });
});
