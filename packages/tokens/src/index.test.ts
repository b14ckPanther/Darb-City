import { expect, it } from "vitest";
import {
  colors,
  DOOR_CLIP_PATH,
  DOOR_PATH,
  fonts,
  mapColors,
  MARK_ASPECT,
  motion,
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
