// Every business in data/listings/, whatever importer wrote it, is a card the seed can load.
import { readdirSync, readFileSync } from "node:fs";
import { CARD_ACCENTS, isOpenAt, isSlug } from "@darb/core";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { SCREEN_SCHEMA } from "../../src/screen-schema.ts";
import { excluded } from "./kind-map.mjs";
import { km } from "./places.mjs";

const read = (f) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), "utf8"));
const files = readdirSync(new URL("../../data/listings/", import.meta.url)).filter((f) =>
  f.endsWith(".json"),
);
const listings = files.flatMap((f) =>
  read(`listings/${f}`).businesses.map((b) => ({ ...b, file: f })),
);
const places = new Map(read("places.json").map((p) => [p.slug, p]));
const kinds = new Map(read("kinds.json").map((k) => [k.slug, k]));
const brands = new Set([...read("brands.json"), ...read("clients.json").brands].map((b) => b.slug));
const validate = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);

describe("every listing", () => {
  it("has a source block in its file", () => {
    for (const f of files) {
      const { source } = read(`listings/${f}`);
      expect(source?.name, f).toBeTruthy();
    }
  });
  it("stands in a live place of the north, near it, with known kinds and brands", () => {
    const bad = [];
    for (const b of listings) {
      const p = places.get(b.place);
      const where = `${b.file} ${b.place}/${b.slug}`;
      if (p?.status !== "live") bad.push(`${where}: place`);
      else if (km(p, b) > 15) bad.push(`${where}: ${km(p, b).toFixed(1)} km from its place`);
      if (!b.kinds.includes(b.primaryKind)) bad.push(`${where}: primary kind`);
      for (const k of b.kinds) if (kinds.get(k)?.status !== "active") bad.push(`${where}: ${k}`);
      if (b.brand && !brands.has(b.brand)) bad.push(`${where}: brand ${b.brand}`);
    }
    expect(bad).toEqual([]);
  });
  it("has a slug unique in its place, across every file and Darb's clients", () => {
    const keys = [...listings, ...read("clients.json").businesses].map(
      (b) => `${b.place}/${b.slug}`,
    );
    const seen = new Set();
    const twice = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
    expect(twice).toEqual([]);
    for (const b of listings) expect(isSlug(b.slug), b.slug).toBe(true);
  });
  it("has a valid screen, three languages, a Darb accent, readable hours and no long dashes", () => {
    const bad = [];
    for (const b of listings) {
      const where = `${b.file} ${b.place}/${b.slug}`;
      if (!validate(b.experience)) bad.push(`${where}: screen`);
      for (const field of ["name", "tagline", "address"])
        for (const l of ["he", "ar", "en"])
          if (!String(b[field]?.[l] ?? "").trim()) bad.push(`${where}: ${field}.${l}`);
      if (b.cardStyle?.accent && !CARD_ACCENTS.includes(b.cardStyle.accent))
        bad.push(`${where}: accent`);
      if (/[־–—]/.test(JSON.stringify(b))) bad.push(`${where}: long dash`);
      try {
        isOpenAt(b.hours, new Date());
      } catch {
        bad.push(`${where}: hours`);
      }
      // paz-north.json was written by hand before the toolkit and keeps its own numbers.
      if (b.file !== "paz-north.json" && b.phone && !/^\+972 \d{1,2}-\d{3}-\d{4}$/.test(b.phone))
        bad.push(`${where}: phone`);
    }
    expect(bad).toEqual([]);
  });
  // Names only: an OSM feature's tags were checked by the importer (a kindergarten on Winery
  // Street, "גן היקב", is a kindergarten).
  it("never lists a bar, alcohol, pork, gambling, adult, tobacco or vape business", () => {
    const bad = listings
      .filter((b) => b.file.startsWith("osm-"))
      .filter((b) => excluded({ name: b.name.he, "name:ar": b.name.ar, "name:en": b.name.en }))
      .map((b) => `${b.file} ${b.place}/${b.slug} ${b.name.he}`);
    expect(bad).toEqual([]);
  });
});
