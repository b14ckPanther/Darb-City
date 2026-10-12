import { describe, expect, it } from "vitest";
import { directionsHref, primaryAction, safeHttpUrl, telHref, whatsappHref } from "./links";

describe("safeHttpUrl", () => {
  it("keeps http and https", () => {
    expect(safeHttpUrl("https://caramel.darb.co.il")).toBe("https://caramel.darb.co.il/");
    expect(safeHttpUrl("http://example.com/a")).toBe("http://example.com/a");
  });
  it("drops every other scheme and garbage", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://x.y",
      "itms-apps://x",
      "not a url",
      "",
      null,
      undefined,
    ])
      expect(safeHttpUrl(bad)).toBeNull();
  });
});

describe("contact links", () => {
  it("dials and messages in international form", () => {
    expect(telHref("050-123-4567")).toBe("tel:+972501234567");
    expect(whatsappHref("+972 50 123 4567", "Hi there")).toBe(
      "https://wa.me/972501234567?text=Hi%20there",
    );
    expect(telHref("12")).toBeNull();
  });
  it("routes directions to the business point", () => {
    expect(directionsHref(32.86, 35.3)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=32.86,35.3",
    );
  });
});

describe("primaryAction", () => {
  const name = { he: "סאמר", en: "Samer" };
  it("prefers WhatsApp with a prefilled greeting", () => {
    const action = primaryAction(
      { whatsapp: "0501234567", phone: "0501234567", tier: "basic", name },
      "en",
    );
    expect(action).toEqual({
      kind: "whatsapp",
      href: "https://wa.me/972501234567?text=Hello%20Samer%2C%20I%20found%20you%20on%20Darb.",
    });
  });
  it("falls back to a call", () => {
    expect(
      primaryAction({ whatsapp: null, phone: "04-601-2345", tier: "basic", name }, "he"),
    ).toEqual({
      kind: "call",
      href: "tel:+97246012345",
    });
  });
  it("explains an example business with no contact, and offers nothing for a real one", () => {
    expect(primaryAction({ whatsapp: null, phone: null, tier: "example", name }, "ar")).toEqual({
      kind: "example",
    });
    expect(primaryAction({ whatsapp: null, phone: null, tier: "verified", name }, "ar")).toEqual({
      kind: "none",
    });
  });
});
