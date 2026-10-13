import { describe, expect, it } from "vitest";
import { detectCues } from "./cues.js";
import { normalize } from "./normalize.js";

const cues = (q: string) => detectCues(normalize(q));

describe("filter cues", () => {
  it("finds open now, delivery and near me in English", () => {
    expect(cues("knafeh near me open now")).toEqual({
      cues: { openNow: true, delivers: false, nearMe: true },
      rest: "knafeh",
    });
    expect(cues("pizza delivery haifa").cues.delivers).toBe(true);
  });
  it("in Hebrew", () => {
    expect(cues("חומוס פתוח עכשיו לידי").cues).toEqual({
      openNow: true,
      delivers: false,
      nearMe: true,
    });
    expect(cues("שווארמה עם משלוחים").rest).toBe(normalize("שווארמה עם"));
  });
  it("in Arabic", () => {
    expect(cues("حلويات مفتوح هلأ قريب مني").cues).toEqual({
      openNow: true,
      delivers: false,
      nearMe: true,
    });
    expect(cues("مطعم توصيل").cues.delivers).toBe(true);
  });
  it("matches whole words only", () => {
    expect(cues("opener").cues.openNow).toBe(false);
    expect(cues("deliveroo").cues.delivers).toBe(false);
  });
});
