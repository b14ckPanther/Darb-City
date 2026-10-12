import { describe, expect, it } from "vitest";
import { hasText, pickText } from "./locale.js";

describe("pickText", () => {
  it("returns the requested locale when present", () => {
    expect(pickText({ he: "חיפה", ar: "حيفا", en: "Haifa" }, "ar")).toBe("حيفا");
  });
  it("falls back from Arabic to Hebrew before English", () => {
    expect(pickText({ he: "מספרה", en: "Barber" }, "ar")).toBe("מספרה");
  });
  it("falls back from Hebrew to Arabic before English", () => {
    expect(pickText({ ar: "حلاق", en: "Barber" }, "he")).toBe("حلاق");
  });
  it("falls back from English to Hebrew, then Arabic", () => {
    expect(pickText({ he: "ספר", ar: "حلاق" }, "en")).toBe("ספר");
    expect(pickText({ ar: "حلاق" }, "en")).toBe("حلاق");
  });
  it("treats blank strings as missing", () => {
    expect(pickText({ ar: "  ", he: "ספר" }, "ar")).toBe("ספר");
  });
  it("returns an empty string only when nothing exists", () => {
    expect(pickText({}, "he")).toBe("");
  });
});

describe("hasText", () => {
  it("is true when any locale has non-blank text", () => {
    expect(hasText({ en: "x" })).toBe(true);
    expect(hasText({ he: " " })).toBe(false);
  });
});
