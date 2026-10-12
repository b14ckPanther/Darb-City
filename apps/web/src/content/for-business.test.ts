import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import { safeHttpUrl } from "@/lib/links";
import { CONTACT, forBusiness, LIVE_CLIENTS, plainText } from "./for-business";

it("tells every locale the same three things", () => {
  for (const locale of LOCALES) {
    const copy = forBusiness[locale];
    expect(copy.points).toHaveLength(3);
    for (const text of [
      copy.title,
      copy.lead,
      copy.clientsTitle,
      copy.contactTitle,
      copy.contactBody,
    ]) {
      expect(text.trim()).not.toBe("");
    }
  }
});

it("links only to safe https client work and contact", () => {
  expect(LIVE_CLIENTS).toHaveLength(3);
  for (const client of LIVE_CLIENTS) {
    expect(safeHttpUrl(client.url)).toBe(new URL(client.url).href);
    expect(client.url.startsWith("https://")).toBe(true);
    for (const locale of LOCALES) {
      expect(client.name[locale]?.trim()).toBeTruthy();
      expect(client.kind[locale]?.trim()).toBeTruthy();
    }
  }
  expect(safeHttpUrl(CONTACT.instagram)).toBe(new URL(CONTACT.instagram).href);
  expect(CONTACT.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
});

it("describes app-store publishing as a service, with the store names isolated in RTL copy", () => {
  expect(plainText(forBusiness.en.points[2]!.body)).toBe(
    "We build your native app and publish it for you on the App Store and Google Play, with your name, your colours and your language.",
  );
  for (const locale of ["he", "ar"] as const) {
    const body = forBusiness[locale].points[2]!.body;
    expect(typeof body).not.toBe("string");
    const parts = body as readonly (string | { latin: string })[];
    expect(parts.filter((part) => typeof part !== "string")).toEqual([
      { latin: "App Store" },
      { latin: "Google Play" },
    ]);
    // Every Latin letter sits inside an isolated run, never loose in the RTL text.
    for (const part of parts) if (typeof part === "string") expect(part).not.toMatch(/[A-Za-z]/);
  }
});
