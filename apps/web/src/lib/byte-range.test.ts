// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseRange } from "./byte-range";

describe("parseRange", () => {
  it("reads one closed range", () => {
    expect(parseRange("bytes=0-16383", 100_000)).toEqual({ start: 0, end: 16383 });
  });
  it("clamps the end to the file", () => {
    expect(parseRange("bytes=90-200", 100)).toEqual({ start: 90, end: 99 });
  });
  it("reads open and suffix ranges", () => {
    expect(parseRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
    expect(parseRange("bytes=-4", 100)).toEqual({ start: 96, end: 99 });
    expect(parseRange("bytes=-400", 100)).toEqual({ start: 0, end: 99 });
  });
  it("serves everything for no header, other units or several ranges", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("items=0-1", 100)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
    expect(parseRange("bytes=-", 100)).toBeNull();
  });
  it("refuses ranges that start past the end or run backwards", () => {
    expect(parseRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=9-3", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 100)).toBe("unsatisfiable");
  });
  it("ignores malformed headers instead of guessing at them", () => {
    for (const header of [
      "bytes=abc-def",
      "bytes=1.5-2",
      "bytes=-1-2",
      "bytes=0x10-",
      "bytes = 0-1",
    ])
      expect(parseRange(header, 100), header).toBeNull();
  });
  it("handles numbers far beyond the file", () => {
    expect(parseRange("bytes=99999999999999999999-", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-99999999999999999999", 100)).toEqual({ start: 0, end: 99 });
  });
});
