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
    expect(decodeCursor(Buffer.from('{"o":3000000000}').toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":1e21}').toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":100001}').toString("base64url"))).toBeNull();
    expect(decodeCursor(encodeCursor(100_000))).toBe(100_000);
  });
});
