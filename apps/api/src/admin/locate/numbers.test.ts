import { describe, expect, it } from "vitest";
import { exactNumber, interpolate, metres, nearestNumber, type KnownNumber } from "./numbers.js";

const k = (n: number, lat: number, lng: number, suffix = ""): KnownNumber => ({
  n,
  suffix,
  point: { lat, lng },
});

/** Even numbers along a street running east, 10 m per number; odd ones across it. */
const street = [
  k(60, 32.82, 35.0),
  k(80, 32.82, 35.00191), // about 180 m east of 60
  k(61, 32.8202, 35.0),
  k(91, 32.8202, 35.00287),
];

describe("interpolate", () => {
  it("places a number in proportion between the nearest known numbers on its side", () => {
    const at = interpolate(street, 68)!;
    expect(at.lo.n).toBe(60);
    expect(at.hi.n).toBe(80);
    expect(at.point.lat).toBeCloseTo(32.82, 6);
    expect(at.point.lng).toBeCloseTo(35.0 + 0.00191 * 0.4, 6);
    expect(metres(at.point, street[0]!.point)).toBeCloseTo(
      0.4 * metres(street[0]!.point, street[1]!.point),
      0,
    );
  });

  it("never mixes the two sides of the street", () => {
    const at = interpolate(street, 71)!;
    expect([at.lo.n, at.hi.n]).toEqual([61, 91]);
    expect(at.point.lat).toBeCloseTo(32.8202, 6);
  });

  it("needs a known number on both sides of it", () => {
    expect(interpolate(street, 58)).toBeNull();
    expect(interpolate(street, 82)).toBeNull();
    expect(interpolate([k(1, 32.8, 35), k(3, 32.8, 35.001)], 4)).toBeNull();
  });

  it("refuses known numbers too far apart, in metres or in numbers", () => {
    const far = [k(10, 32.82, 35.0), k(20, 32.82, 35.006)]; // about 560 m
    expect(interpolate(far, 14)).toBeNull();
    const many = [k(10, 32.82, 35.0), k(90, 32.82, 35.001)];
    expect(interpolate(many, 50)).toBeNull();
    expect(interpolate(many, 50, { maxMetres: 400, maxSpan: 100 })).not.toBeNull();
  });

  it("takes the closest pair when a number is mapped twice", () => {
    const twice = [k(10, 32.82, 35.0), k(10, 32.83, 35.0), k(14, 32.8201, 35.0)];
    expect(interpolate(twice, 12)!.lo.point.lat).toBe(32.82);
  });
});

describe("exact and nearest numbers", () => {
  it("matches the number, and its letter when one is typed", () => {
    const list = [k(12, 32.8, 35), k(12, 32.81, 35, "א")];
    expect(exactNumber(list, 12)!.point.lat).toBe(32.8);
    expect(exactNumber(list, 12, "א")!.point.lat).toBe(32.81);
    expect(exactNumber(list, 12, "ב")).toBeNull();
    expect(exactNumber(list, 13)).toBeNull();
  });

  it("finds the known number nearest a point, only close by", () => {
    expect(nearestNumber(street, { lat: 32.82, lng: 35.0019 })!.n).toBe(80);
    expect(nearestNumber(street, { lat: 32.9, lng: 35.1 })).toBeNull();
  });
});
