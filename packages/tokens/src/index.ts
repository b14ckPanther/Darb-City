/** Darb corporate identity. Values are copied from the approved Darb 2.0 brand; never edit by eye. */
export const colors = {
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
} as const;

export const motion = {
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

export const fonts = { latin: "Ubuntu", hebrew: "Heebo", arabic: "Cairo" } as const;

/** The doorway of the Darb mark: a wall rising into one sloped gable, in a 100 x 150 box. */
export const DOOR_PATH =
  "M0 150V52C0 45.5 3.4 40.6 8.6 37.3L59.2 7.2C66.6 2.8 73.4 2.8 80.8 7.2L93.4 14.8C98 17.6 100 21.6 100 27V150Z";

/** The same doorway in 0..1 units, for `clipPathUnits="objectBoundingBox"`. */
export const DOOR_CLIP_PATH =
  "M0 1V.3467C0 .3033 .034 .2707 .086 .2487L.592 .048C.666 .0187 .734 .0187 .808 .048L.934 .0987C.98 .1173 1 .144 1 .18V1Z";

/** Height / width of the raster mark masters in `assets/brand`. */
export const MARK_ASPECT = 769 / 660;
