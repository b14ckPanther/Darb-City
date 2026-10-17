import { describe, expect, it } from "vitest";
import {
  colors,
  DOOR_CLIP_PATH,
  DOOR_PATH,
  fonts,
  mapColors,
  MARK_ASPECT,
  motion,
  themeColor,
  themes,
} from "./index.js";

it("keeps the Darb palette exactly", () => {
  expect(colors).toEqual({
    night: "#03110c",
    forest950: "#051811",
    forest900: "#08241a",
    forest800: "#0e3527",
    forest600: "#1d5a43",
    forest400: "#3f8a6c",
    gold900: "#6d4c17",
    gold600: "#b9852f",
    gold: "#d9a54c",
    gold300: "#f0c77a",
    gold100: "#fbe7bd",
    ivory: "#fbf7ec",
    ivory200: "#efe8d6",
    ink: "#0b2219",
    inkMuted: "#4c5f56",
  });
});

it("keeps the motion curves, fonts and the doorway geometry", () => {
  expect(motion).toEqual({
    easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
    easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  });
  expect(fonts).toEqual({ latin: "Ubuntu", hebrew: "Heebo", arabic: "Cairo" });
  expect(DOOR_PATH.startsWith("M0 150V52")).toBe(true);
  expect(DOOR_CLIP_PATH.startsWith("M0 1V.3467")).toBe(true);
  expect(MARK_ASPECT).toBeCloseTo(1.165, 3);
});

it("keeps the daylight map palette light, with dark labels", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };
  for (const land of [mapColors.land, mapColors.urban, mapColors.park, mapColors.mist])
    expect(luminance(land), land).toBeGreaterThan(0.6);
  // WCAG AA (4.5:1) for map text on the land it sits on.
  for (const land of [mapColors.land, mapColors.urban, mapColors.wood, mapColors.building]) {
    expect(contrast(mapColors.label, land), land).toBeGreaterThan(4.5);
    expect(contrast(mapColors.labelSoft, land), land).toBeGreaterThan(4.5);
  }
  expect(contrast(mapColors.waterLabel, mapColors.water)).toBeGreaterThan(4.5);
  expect(contrast(colors.ivory, mapColors.bubble)).toBeGreaterThan(4.5);
});

describe("the day and night themes", () => {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (hex: string) => {
    const [r, g, b] = rgb(hex).map(channel);
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };

  it("define the same roles", () => {
    expect(Object.keys(themes.night).sort()).toEqual(Object.keys(themes.day).sort());
  });

  it("keep the day page warm paper, never white", () => {
    expect(themes.day.bg).not.toBe("#ffffff");
    expect(luminance(themes.day.bg)).toBeGreaterThan(0.8);
    expect(themeColor).toEqual({ day: themes.day.bg, night: colors.night });
  });

  for (const name of ["day", "night"] as const) {
    const t = themes[name];
    const grounds = [t.bg, t.bgRaised, t.surface1, t.surface2, t.surface3].filter((c) =>
      c.startsWith("#"),
    );

    it(`${name}: body text, soft and muted text and gold text read on every surface (AA)`, () => {
      for (const ground of grounds) {
        for (const text of [t.text, t.textSoft, t.textMuted, t.accentText, t.link, t.open])
          expect(contrast(text, ground), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: buttons, gold fills and the focus ring read`, () => {
      expect(contrast(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
      // Non-text contrast (WCAG 1.4.11): the focus ring against the page.
      expect(contrast(t.focus, t.bg)).toBeGreaterThanOrEqual(3);
    });

    if (name === "day") {
      it("day: the closed state and danger text read on paper and on their own wash", () => {
        for (const ground of [...grounds, t.tint, t.wash])
          expect(contrast(t.closed, ground), ground).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.danger, t.dangerBg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accentText, t.tint)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accentText, t.tintStrong)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
