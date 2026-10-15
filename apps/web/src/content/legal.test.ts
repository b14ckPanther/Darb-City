import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import {
  LEGAL_CONTACT,
  LEGAL_KINDS,
  LEGAL_UPDATED,
  legal,
  legalChrome,
  type LegalDoc,
} from "./legal";

const texts = (doc: LegalDoc): string[] => [
  doc.title,
  doc.lead,
  ...doc.sections.flatMap((s) => [
    s.title,
    ...s.blocks.flatMap((b) => (typeof b === "string" ? [b] : b.list)),
  ]),
];

it("gives every locale every section, in the same order, with text in each", () => {
  for (const kind of LEGAL_KINDS) {
    const ids = legal[kind].he.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const locale of LOCALES) {
      const doc = legal[kind][locale];
      expect(doc.sections.map((s) => s.id)).toEqual(ids);
      for (const section of doc.sections) {
        expect(section.blocks.length).toBeGreaterThan(0);
        for (const block of section.blocks) {
          if (typeof block !== "string") expect(block.list.length).toBeGreaterThan(0);
        }
      }
      for (const text of texts(doc)) expect(text.trim()).not.toBe("");
    }
  }
  for (const locale of LOCALES) {
    for (const text of Object.values(legalChrome[locale])) expect(text.trim()).not.toBe("");
  }
});

it("names the contact, and says the Hebrew version prevails", () => {
  expect(LEGAL_CONTACT.email).toBe("founder@darb.co.il");
  expect(LEGAL_UPDATED).toBe("2026-10-15");
  for (const kind of LEGAL_KINDS) {
    for (const locale of LOCALES) {
      expect(texts(legal[kind][locale]).join(" ")).toContain(LEGAL_CONTACT.email);
    }
  }
  expect(legalChrome.he.notice).toContain("הנוסח העברי");
  expect(legalChrome.ar.notice).toContain("النص العبري");
  expect(legalChrome.en.notice).toContain("Hebrew version prevails");
});

it("states the facts the code enforces", () => {
  const en = (kind: (typeof LEGAL_KINDS)[number]) => texts(legal[kind].en).join(" ");
  // SEARCH_LOG_RETENTION_DAYS defaults to 90; the access level is AA under IS 5568.
  expect(en("privacy")).toContain("after 90 days");
  expect(en("accessibility")).toContain("IS 5568");
  expect(en("accessibility")).toContain("AA");
  expect(en("terms")).toContain("laws of the State of Israel");
});

it("keeps to the house style: no dashes that read as machine-written, no banned words", () => {
  for (const kind of LEGAL_KINDS) {
    for (const locale of LOCALES) {
      const all = [...texts(legal[kind][locale]), ...Object.values(legalChrome[locale])].join(" ");
      expect(all).not.toMatch(/[–—־]/);
      expect(all).not.toMatch(/halal|חלאל|حلال/i);
    }
  }
});
