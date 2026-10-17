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

/**
 * The daylight map: a warm, sunlit atlas around Darb's forest and gold. Map paint only (style.mjs,
 * the served-area veil and Darb's map layers); never page surfaces, which keep `colors`.
 */
export const mapColors = {
  /** Land: warm ivory sand. */
  land: "#f4eddc",
  /** Towns and villages: a touch warmer than the open land. */
  urban: "#efe4cd",
  /** Buildings at street level: soft clay. */
  building: "#e5d6bb",
  buildingEdge: "#d6c3a0",
  /** Nature, light to deep: meadow, park, wood. */
  meadow: "#dde7c6",
  park: "#cfe0b8",
  wood: "#b9d39b",
  farmland: "#ebe7cf",
  sand: "#f3e3bf",
  /** Water: Mediterranean teal, deeper over the whole country, light at street level. */
  water: "#8fcfd8",
  waterDeep: "#5fb3c4",
  waterLabel: "#0f4d59",
  /** Roads: white streets on sand; highways in Darb gold, main roads a paler gold, both cased darker. */
  road: "#ffffff",
  roadCasing: "#e2d4b6",
  main: "#e2b45f",
  mainCasing: "#c08f3c",
  major: "#f1d597",
  majorCasing: "#d9b56f",
  tunnel: "#f1e9d8",
  rail: "#c5b79c",
  /** Labels: deep forest on an ivory halo; road names grey-forest. */
  label: "#173326",
  labelSoft: "#3d5247",
  halo: "#fbf7ec",
  /** Outside the land Darb serves: a soft warm mist. */
  mist: "#efe6d2",
  /** Darb's own marks on light land. */
  bubble: "#14352a",
} as const;
