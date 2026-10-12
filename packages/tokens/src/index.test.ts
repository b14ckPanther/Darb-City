import { expect, it } from "vitest";
import { colors, DOOR_CLIP_PATH, DOOR_PATH, fonts, MARK_ASPECT, motion } from "./index.js";

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
