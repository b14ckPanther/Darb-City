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

/**
 * The page roles, by day and by night. Every surface, text and line on the site reads these (as
 * `--bg`, `--text-soft`, …); components never pick a brand colour for a role themselves.
 * `day` is the default: warm ivory paper, forest ink, gold for highlights. `night` is the
 * original forest-at-night look, used when the visitor prefers a dark scheme (or picks it) and for
 * the few places that stay night on purpose (the landing hero, the footer, device frames).
 */
export const themes = {
  day: {
    /** The page: warm ivory paper, never white. */
    bg: "#f7f1e4",
    bgRaised: "#fbf8f0",
    /** Cards and panels: warm white and white, lifted by soft shadows. */
    surface1: "#fffdf8",
    surface2: "#ffffff",
    /** A sunken or pressed surface: a deeper sand. */
    surface3: "#f1e8d5",
    text: "#14281f",
    textSoft: "#3d5247",
    textMuted: "#5a6a60",
    /** Gold as a fill (the road, chips, active states). */
    accent: "#d9a54c",
    accentBright: "#f0c77a",
    /** Gold as text on paper: deepened until it reads (WCAG AA). */
    accentText: "#80571a",
    /** Text on a gold fill. */
    onAccent: "#14281f",
    /** Primary actions: deep forest with ivory text. */
    primary: "#173a2c",
    primaryHover: "#1f4a39",
    onPrimary: "#fbf7ec",
    link: "#173a2c",
    line: "#e9dfca",
    lineSoft: "#efe7d6",
    lineStrong: "#d8c7a3",
    /** Gold washes behind chips and active items. */
    tint: "#f6ead1",
    tintStrong: "#f0dcb2",
    /** Forest-on-paper washes for hover and quiet fills. */
    wash: "#f4eee1",
    washStrong: "#ebe3d1",
    open: "#1a7040",
    closed: "#5a6a60",
    danger: "#a8321f",
    dangerBg: "#fbe9e4",
    focus: "#80571a",
    headerBg: "rgb(251 248 240 / 0.84)",
    scrim: "rgb(20 40 31 / 0.32)",
    /** r g b of the soft shadows (warm, never black on paper). */
    shadow: "60 52 30",
  },
  night: {
    bg: "#03110c",
    bgRaised: "#051811",
    surface1: "#051811",
    surface2: "#08241a",
    surface3: "#0e3527",
    text: "#fbf7ec",
    textSoft: "#efe8d6",
    textMuted: "#a9b8ad",
    accent: "#d9a54c",
    accentBright: "#f0c77a",
    accentText: "#f0c77a",
    onAccent: "#03110c",
    primary: "#d9a54c",
    primaryHover: "#f0c77a",
    onPrimary: "#03110c",
    link: "#f0c77a",
    line: "rgb(217 165 76 / 0.24)",
    lineSoft: "rgb(251 247 236 / 0.08)",
    lineStrong: "rgb(217 165 76 / 0.45)",
    tint: "rgb(217 165 76 / 0.12)",
    tintStrong: "rgb(217 165 76 / 0.22)",
    wash: "rgb(251 247 236 / 0.035)",
    washStrong: "rgb(251 247 236 / 0.08)",
    open: "#8fd6a4",
    closed: "#a9b8ad",
    danger: "#f0a08a",
    dangerBg: "rgb(58 20 16 / 0.6)",
    focus: "#f0c77a",
    headerBg: "rgb(3 17 12 / 0.82)",
    scrim: "rgb(0 0 0 / 0.6)",
    shadow: "0 0 0",
  },
} as const;

export type ThemeName = keyof typeof themes;

/** The browser chrome colour per scheme (`<meta name="theme-color">`). */
export const themeColor = { day: themes.day.bg, night: colors.night } as const;

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
