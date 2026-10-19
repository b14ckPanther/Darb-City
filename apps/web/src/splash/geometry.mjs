// The launch frame's geometry, shared by scripts/make-splash.mjs (which paints it into the iOS
// launch images) and src/splash/css.ts (which lays it out in CSS for the in-app reveal), so the
// image iOS shows while the app starts and the first frame the page paints are the same picture.
//
// Lengths are CSS pixels of a portrait screen W x H.

/** The brand mark as served (/brand/darb-mark-480.webp): drawn whole, transparent margin and all. */
export const MARK = { src: "/brand/darb-mark-480.webp", width: 480, height: 559 };

/** The mark's width: a third of a phone's width, held back on short screens and on tablets. */
export const MARK_VW = 0.34;
export const MARK_VH = 0.2;
export const MARK_MAX = 210;
export const markWidth = (w, h) => Math.min(MARK_VW * w, MARK_VH * h, MARK_MAX);
export const markHeight = (w, h) => (markWidth(w, h) * MARK.height) / MARK.width;

/** The mark's centre, as a share of the screen's height: a touch above the middle (optical). */
export const MARK_Y = 0.46;

/** The app's name under the mark: its size, the gap above it (x mark width) and its line box. */
export const NAME_MIN = 15;
export const NAME_VW = 0.038;
export const NAME_MAX = 19;
export const nameSize = (w) => Math.min(Math.max(NAME_VW * w, NAME_MIN), NAME_MAX);
export const NAME_GAP = 0.14;
export const NAME_LINE = 1.4;
export const NAME_WEIGHT = 500;
export const NAME_TRACKING = 0.02;

/**
 * Inside the mark (shares of its 480 x 559 box): the gold doorway's lit centre, where the light
 * starts and the reveal goes through; the doorway's open floor, where the road leaves along the
 * mark's own isometric axis (30 degrees, the block's edges); and where the app's badge lands, as
 * on its icon.
 */
export const DOOR = { x: 0.8, y: 0.45 };
export const FLOOR = { x: 0.88, y: 0.96 };
export const ROAD_ANGLE = 30;
export const BADGE = { x: 0.9, y: 0.86 };

/**
 * The grounds: the manifests' background colours (Android paints its system splash with them), so
 * every step from the home screen to the app is the same paper (or the same night).
 */
export const GROUND = { light: "#f7f1e4", dark: "#03110c" };
/** The name's ink: the forest (or ivory) softened toward the ground, as a solid colour. */
export const NAME_INK = { light: "#6f786e", dark: "#8b8f87" };
/** A soft light behind the mark in the first frame: paper light by day, the doorway's gold by night. */
export const HALO = {
  light: { color: "#ffffff", opacity: 0.55 },
  dark: { color: "#d9a54c", opacity: 0.12 },
};
/** The halo's radius, x mark width. */
export const HALO_R = 1.05;

/** Every frame's place on a W x H screen, in CSS pixels. */
export function layout(w, h) {
  const mw = markWidth(w, h);
  const mh = markHeight(w, h);
  const cy = MARK_Y * h;
  const top = cy - mh / 2;
  const size = nameSize(w);
  const line = size * NAME_LINE;
  return {
    mark: { left: (w - mw) / 2, top, width: mw, height: mh },
    halo: { cx: w / 2, cy, r: HALO_R * mw },
    name: {
      size,
      line,
      top: top + mh + NAME_GAP * mw,
      centerY: top + mh + NAME_GAP * mw + line / 2,
    },
  };
}
