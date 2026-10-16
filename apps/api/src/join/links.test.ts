import { describe, expect, it, vi } from "vitest";
import { readLink, resolveShortLink } from "./links.js";

const SAKHNIN = { lat: 32.8638, lng: 35.3023 };

describe("readLink", () => {
  it.each([
    [
      "Google place link: the pin (!3d!4d) wins over the view (@)",
      "https://www.google.com/maps/place/Samir+Sweets/@32.8600,35.3000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d32.8638!4d35.3023!16s",
      { source: "google", point: SAKHNIN, name: "Samir Sweets" },
    ],
    [
      "Google view only",
      "https://www.google.co.il/maps/@32.8638,35.3023,15z",
      { source: "google", point: SAKHNIN },
    ],
    [
      "Google ?q=lat,lng",
      "https://maps.google.com/?q=32.8638,35.3023",
      { source: "google", point: SAKHNIN },
    ],
    [
      "Google search API link",
      "https://www.google.com/maps/search/?api=1&query=32.8638%2C35.3023",
      { source: "google", point: SAKHNIN },
    ],
    [
      "Google ?q=<name>",
      "https://www.google.com/maps?q=%D7%97%D7%9C%D7%95%D7%99%D7%95%D7%AA+%D7%A1%D7%9E%D7%99%D7%A8",
      { source: "google", name: "חלויות סמיר" },
    ],
    [
      "Google directions",
      "https://www.google.com/maps/dir/?api=1&destination=32.8638,35.3023",
      { source: "google", point: SAKHNIN },
    ],
    ["Google short link", "https://maps.app.goo.gl/AbC123xyz", { source: "google", short: true }],
    ["Old short link", "https://goo.gl/maps/AbC123", { source: "google", short: true }],
    [
      "Waze ul?ll=",
      "https://waze.com/ul?ll=32.8638%2C35.3023&navigate=yes",
      { source: "waze", point: SAKHNIN },
    ],
    [
      "Waze www ul?ll= with zoom",
      "https://www.waze.com/ul?ll=32.8638,35.3023&navigate=yes&zoom=17",
      { source: "waze", point: SAKHNIN },
    ],
    [
      "Waze live map",
      "https://www.waze.com/en/live-map/directions?navigate=yes&to=ll.32.8638%2C35.3023",
      { source: "waze", point: SAKHNIN },
    ],
    [
      "Instagram",
      "https://www.instagram.com/samir.sweets/?hl=en",
      { source: "social", links: { instagram: "https://www.instagram.com/samir.sweets/" } },
    ],
    [
      "Facebook",
      "facebook.com/samirsweets",
      { source: "social", links: { facebook: "https://www.facebook.com/samirsweets" } },
    ],
    [
      "TikTok",
      "https://www.tiktok.com/@samirsweets",
      { source: "social", links: { tiktok: "https://www.tiktok.com/@samirsweets" } },
    ],
    ["A website", "samir.co.il/menu", { source: "website", website: "https://samir.co.il/menu" }],
  ])("%s", (_name, url, facts) => {
    expect(readLink(url)).toEqual(facts);
  });

  it("drops points outside Israel and reads no non-links", () => {
    expect(readLink("https://www.google.com/maps/@48.85,2.35,15z")).toEqual({ source: "google" });
    expect(readLink("https://waze.com/ul?ll=40.7,-74.0")).toEqual({ source: "waze" });
    expect(readLink("Samir Sweets Sakhnin")).toBeNull();
    expect(readLink("https://www.google.com/maps/place/%E0%A4%A")).toMatchObject({
      source: "google",
    });
  });
});

describe("resolveShortLink", () => {
  const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
  const LONG = "https://www.google.com/maps/place/Samir/@32.86,35.3,17z";

  it("follows Location headers to the long link", async () => {
    const fetchImpl = vi.fn(async () => redirect(LONG));
    expect(await resolveShortLink("https://maps.app.goo.gl/abc", fetchImpl)).toBe(LONG);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://maps.app.goo.gl/abc",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("goes through goo.gl hops, at most three", async () => {
    const hops = vi
      .fn()
      .mockResolvedValueOnce(redirect("https://goo.gl/maps/def"))
      .mockResolvedValueOnce(redirect(LONG));
    expect(await resolveShortLink("https://maps.app.goo.gl/abc", hops)).toBe(LONG);
    const loop = vi.fn(async () => redirect("https://maps.app.goo.gl/again"));
    expect(await resolveShortLink("https://maps.app.goo.gl/abc", loop)).toBeNull();
    expect(loop).toHaveBeenCalledTimes(3);
  });

  it("stops on other hosts, plain http, errors and pages without a redirect", async () => {
    expect(
      await resolveShortLink("https://maps.app.goo.gl/a", async () =>
        redirect("https://evil.example/x"),
      ),
    ).toBeNull();
    expect(
      await resolveShortLink("https://maps.app.goo.gl/a", async () =>
        redirect("http://www.google.com/maps"),
      ),
    ).toBeNull();
    expect(
      await resolveShortLink("https://maps.app.goo.gl/a", async () => {
        throw new Error("down");
      }),
    ).toBeNull();
    expect(
      await resolveShortLink("https://maps.app.goo.gl/a", async () => new Response("<html>")),
    ).toBeNull();
    const never = vi.fn();
    expect(await resolveShortLink("https://evil.example/maps", never)).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });
});
