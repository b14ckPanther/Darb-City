// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { colors } from "@darb/tokens";
import { describe, expect, it } from "vitest";
import { buildMapAssets } from "../../scripts/copy-map.mjs";
import { FONT, GLYPHS_DIR, RANGES } from "../../scripts/map/fetch-glyphs.mjs";
import {
  ATTRIBUTION,
  darbStyle,
  DROPPED_LAYERS,
  GLYPHS_URL,
  MAP_FONT,
  PROTOMAPS_SOURCE,
} from "../../scripts/map/style.mjs";

type Layer = {
  id: string;
  type: string;
  "source-layer"?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};

describe("glyphs", () => {
  it("ships every range the map asks for, with the font licence", () => {
    for (const range of RANGES)
      expect(statSync(join(GLYPHS_DIR, FONT, `${range}.pbf`)).size, range).toBeGreaterThan(1000);
    expect(readFileSync(join(GLYPHS_DIR, "OFL.txt"), "utf8")).toContain("SIL OPEN FONT LICENSE");
  });
  it("keeps spaces out of the served folder and fontstack names (ruling 4)", () => {
    expect(FONT).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("the Darb style", () => {
  const style = darbStyle("ar");
  const json = JSON.stringify(style);
  const layers = style.layers as Layer[];

  it("uses only self-hosted glyphs and one font, and no sprite", () => {
    expect(style.glyphs).toBe(GLYPHS_URL);
    expect(style).not.toHaveProperty("sprite");
    expect(MAP_FONT).toBe(FONT);
    // Every Protomaps font stack (Medium, Italic, Devanagari…) becomes the one we host.
    expect(json).not.toMatch(/"Noto[^"]*"/);
    const stacks = layers.flatMap((l) => (l.layout?.["text-font"] ? [l.layout["text-font"]] : []));
    expect(stacks.length).toBeGreaterThan(0);
    // Stacks may be plain arrays or expressions (["case", …, ["literal", [font]]]).
    expect(new Set(JSON.stringify(stacks).match(/"[^"]*(noto|sans)[^"]*"/gi))).toEqual(
      new Set([JSON.stringify(MAP_FONT)]),
    );
    expect(json).not.toMatch(/"icon-/);
  });
  it("links nowhere but the attribution", () => {
    const urls = (json.match(/https?:\/\/[^"\\ ]+/g) ?? []).sort();
    expect(urls).toEqual(["https://protomaps.com", "https://www.openstreetmap.org/copyright"]);
    expect(style.sources[PROTOMAPS_SOURCE].attribution).toBe(ATTRIBUTION);
  });
  it("drops points of interest, shields, arrows and borders", () => {
    const ids = layers.map((l) => l.id);
    for (const id of DROPPED_LAYERS) expect(ids).not.toContain(id);
    expect(ids).toContain("earth");
    expect(ids).toContain("roads_highway");
    expect(ids).toContain("places_locality");
  });
  it("keeps bars and other forbidden places off the map: no POI or sprite layers (ruling 3)", () => {
    for (const locale of ["he", "ar", "en"] as const) {
      const s = darbStyle(locale);
      expect(s).not.toHaveProperty("sprite");
      for (const layer of s.layers as Layer[]) {
        expect(layer["source-layer"], layer.id).not.toBe("pois");
        expect(layer.id).not.toMatch(/poi/i);
        expect(layer.type === "symbol" && layer.layout?.["icon-image"], layer.id).toBeFalsy();
      }
    }
  });
  it("paints night and forest land, gold roads and ivory labels", () => {
    const paint = (id: string) => layers.find((l) => l.id === id)?.paint as Record<string, unknown>;
    expect(paint("background")["background-color"]).toBe(colors.night);
    expect(paint("earth")["fill-color"]).toBe(colors.forest950);
    expect(paint("roads_highway")["line-color"]).toBe(colors.gold600);
    expect(paint("places_locality")["text-color"]).toBe(colors.ivory);
  });
  it("labels places in the page language", () => {
    expect(JSON.stringify(darbStyle("he"))).toContain('"name:he"');
    expect(json).toContain('"name:ar"');
    expect(JSON.stringify(darbStyle("en"))).toContain('"name:en"');
  });
});

describe("neutral labels in the page language only", () => {
  for (const locale of ["he", "ar", "en"] as const) {
    const layers = darbStyle(locale).layers as (Layer & { filter?: unknown })[];
    const labels = layers.filter((l) => l.layout?.["text-field"] !== undefined);
    it(`${locale}: renders no country or region labels`, () => {
      for (const l of labels) {
        expect(l.id, l.id).not.toMatch(/country|region/);
        expect(JSON.stringify(l.filter ?? null), l.id).not.toMatch(
          /"(country|region|macroregion)"/,
        );
      }
    });
    it(`${locale}: text fields never add a second name or a second line`, () => {
      expect(labels.length).toBeGreaterThan(0);
      for (const l of labels) {
        const field = JSON.stringify(l.layout?.["text-field"]);
        expect(field, l.id).not.toMatch(/name2|name3|script2|\\n/);
        const gets = [...field.matchAll(/\["get","([^"]+)"\]/g)].map((m) => m[1]);
        for (const key of gets) expect(["name:" + locale, "name:en", "name"], l.id).toContain(key);
        expect(gets[0], l.id).toBe("name:" + locale);
      }
    });
  }
});

describe("buildMapAssets", () => {
  it("writes the vendor modules, the glyphs, one style per locale and the served area", () => {
    const target = mkdtempSync(join(tmpdir(), "darb-map-"));
    const { styles, served } = buildMapAssets(target);
    expect(served.file).toBe(join(target, "served-area.json"));
    const area = JSON.parse(readFileSync(served.file, "utf8"));
    expect(area.geometry.type).toBe("MultiPolygon");
    expect(area.bbox).toHaveLength(4);
    expect(styles.sort()).toEqual(
      ["ar", "en", "he"].map((l) => join(target, "style", `${l}.json`)),
    );
    expect(existsSync(join(target, "glyphs", FONT, "1536-1791.pbf"))).toBe(true);
    expect(existsSync(join(target, "glyphs", "OFL.txt"))).toBe(true);
    const he = JSON.parse(readFileSync(join(target, "style", "he.json"), "utf8"));
    expect(he.version).toBe(8);
    expect(he).not.toHaveProperty("sprite");
  });
});
