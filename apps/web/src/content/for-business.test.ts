import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import { safeHttpUrl } from "@/lib/links";
import { CONTACT, forBusiness, LIVE_CLIENTS } from "./for-business";

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
