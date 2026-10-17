import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phones.mjs";

describe("phones", () => {
  it("write landlines and mobiles as the listings do", () => {
    expect(normalizePhone("04-6930906")).toBe("+972 4-693-0906");
    expect(normalizePhone("046930906")).toBe("+972 4-693-0906");
    expect(normalizePhone("+972-4-6930906")).toBe("+972 4-693-0906");
    expect(normalizePhone("054-5330829")).toBe("+972 54-533-0829");
    expect(normalizePhone("972 54 533 0829")).toBe("+972 54-533-0829");
    expect(normalizePhone("077-1234567")).toBe("+972 77-123-4567");
  });
  it("take the first valid number of several", () => {
    expect(normalizePhone("123, 04-8123456")).toBe("+972 4-812-3456");
  });
  it("drop what is not a number", () => {
    for (const bad of [null, undefined, "", "0", "1-800-123-456", "*2345", "04-000000", "04-12345"])
      expect(normalizePhone(bad), String(bad)).toBeNull();
  });
});
