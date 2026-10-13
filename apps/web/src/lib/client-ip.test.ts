// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clientIpFrom, roundPoint } from "./client-ip";

describe("client IP", () => {
  it("prefers Vercel's own header, which a visitor cannot set", () => {
    const h = new Headers({ "x-vercel-forwarded-for": "1.2.3.4", "x-forwarded-for": "6.6.6.6" });
    expect(clientIpFrom(h)).toBe("1.2.3.4");
  });
  it("then the first X-Forwarded-For hop, then X-Real-IP", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIpFrom(new Headers({ "x-real-ip": " 9.9.9.9 " }))).toBe("9.9.9.9");
    expect(clientIpFrom(new Headers())).toBe("local");
  });
  it("rounds a point to about 110 m", () => {
    expect(roundPoint({ lat: 32.86449, lng: 35.30351 })).toEqual({ lat: 32.864, lng: 35.304 });
  });
});
