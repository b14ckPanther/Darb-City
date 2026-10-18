import { describe, expect, it } from "vitest";
import { factKind, factsOf } from "./facts";

describe("factsOf: a meta cut into its facts", () => {
  it("types each fact by its shape, keeping its words", () => {
    expect(factsOf("₪60 · 30 min")).toEqual([
      { text: "₪60", kind: "price" },
      { text: "30 min", kind: "duration" },
    ]);
    expect(factsOf("04:52 · iqama 05:10").map((f) => f.kind)).toEqual(["time", "time"]);
    expect(factsOf("₪120 · 9 km · moderate").map((f) => f.kind)).toEqual([
      "price",
      "distance",
      "words",
    ]);
  });

  it("reads a percent's value for a bar, clamped to 0..100", () => {
    expect(factsOf("done · 08:15 · 100%")[2]).toEqual({
      text: "100%",
      kind: "percent",
      value: 100,
    });
    expect(factsOf("₪312,000 · of ₪480,000 · 65%")[2]?.value).toBe(65);
    expect(factsOf("140%")[0]?.value).toBe(100);
  });

  it("knows a bare number, and the words of Hebrew and Arabic", () => {
    expect(factKind("82941")).toBe("number");
    expect(factKind("30 דק'")).toBe("duration");
    expect(factKind("20 دقيقة")).toBe("duration");
    expect(factKind('9 ק"מ')).toBe("distance");
    expect(factKind("ממלכתי")).toBe("words");
    expect(factKind("Mazda 3")).toBe("words");
  });

  it("returns nothing for an empty meta", () => {
    expect(factsOf("")).toEqual([]);
    expect(factsOf(" · ")).toEqual([]);
  });
});
