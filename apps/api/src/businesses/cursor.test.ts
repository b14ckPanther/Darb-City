import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor.js";

describe("cursors", () => {
  it("round-trip an offset", () => {
    expect(decodeCursor(encodeCursor(60))).toBe(60);
  });
  it("start at zero when absent", () => {
    expect(decodeCursor(undefined)).toBe(0);
  });
  it("reject anything that is not one of ours", () => {
    expect(decodeCursor("nonsense")).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":-1}').toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":1.5}').toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from("[]").toString("base64url"))).toBeNull();
  });
});
