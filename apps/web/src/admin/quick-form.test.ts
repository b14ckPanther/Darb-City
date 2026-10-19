import type { AdminBusinessDto } from "@darb/contracts";
import { expect, it } from "vitest";
import { quickPatch, type QuickInput } from "./quick-form";

const b = {
  name: { he: "סמיר", en: "Samer" },
  tagline: { en: "Grill" },
  address: { en: "Main st" },
  primaryKindId: "k1",
  phone: "04-6740000",
  whatsapp: null,
  website: null,
  links: { instagram: "https://www.instagram.com/samer/", booking: "https://book.test/" },
  hours: {
    weekly: { "0": [{ open: "09:00", close: "17:00" }] },
    exceptions: [{ date: "2026-12-25", closed: true }],
  },
  lat: 32.8,
  lng: 35.1,
} as unknown as AdminBusinessDto;

const same = (): QuickInput => ({
  name: { he: "סמיר", ar: "", en: "Samer" },
  tagline: { he: "", ar: "", en: "Grill" },
  address: { he: "", ar: "", en: "Main st" },
  primaryKindId: "k1",
  phone: "04-6740000",
  whatsapp: "",
  website: "",
  links: { instagram: "https://www.instagram.com/samer/", facebook: "", tiktok: "", google: "" },
  weekly: { "0": [{ open: "09:00", close: "17:00" }], "1": [] },
  lat: 32.8,
  lng: 35.1,
});

it("sends nothing when nothing changed", () => {
  expect(quickPatch(same(), b)).toEqual({});
});

it("sends only what changed, keeping the other links and the special days", () => {
  const input = same();
  input.phone = "050-1234567";
  input.links.facebook = "darbcity";
  input.links.instagram = "";
  input.weekly = { "5": [{ open: "08:00", close: "12:00" }] };
  input.lat = 32.81;
  expect(quickPatch(input, b)).toEqual({
    phone: "050-1234567",
    links: { booking: "https://book.test/", facebook: "darbcity" },
    hours: { weekly: { "5": [{ open: "08:00", close: "12:00" }] }, exceptions: b.hours.exceptions },
    lat: 32.81,
    lng: 35.1,
  });
});

it("clears an emptied field to null and trims names", () => {
  const input = same();
  input.phone = "  ";
  input.name = { he: " סמיר ", ar: "سمير", en: "Samer" };
  expect(quickPatch(input, b)).toEqual({
    phone: null,
    name: { he: "סמיר", ar: "سمير", en: "Samer" },
  });
});
