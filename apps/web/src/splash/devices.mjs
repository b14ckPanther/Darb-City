// The iOS launch images: which screens get one, for which apps, and their file names. Shared by
// scripts/make-splash.mjs (which paints them) and src/splash/links.ts (which links them). The
// apps share one set: the launch frame has no words (each app's name rises in its reveal).

/** The three installed apps, each with its own reveal (its name, its last beat). */
export const SPLASH_APPS = ["darb", "helpers", "admin"];
export const SPLASH_THEMES = ["light", "dark"];

/**
 * Current iPhone and iPad screens, portrait, in CSS pixels and device pixel ratio. iOS shows a launch
 * image only when its link's media query names the exact screen, so each size is its own file.
 */
export const SPLASH_DEVICES = [
  { name: "iPhone 16 Pro Max, 17 Pro Max", width: 440, height: 956, dpr: 3 },
  { name: "iPhone 15 Pro Max, 16 Plus, 17 Plus", width: 430, height: 932, dpr: 3 },
  { name: "iPhone 12 to 14 Pro Max, 14 Plus", width: 428, height: 926, dpr: 3 },
  { name: "iPhone Air", width: 420, height: 912, dpr: 3 },
  { name: "iPhone 16 Pro, 17, 17 Pro", width: 402, height: 874, dpr: 3 },
  { name: "iPhone 14 Pro, 15, 15 Pro, 16", width: 393, height: 852, dpr: 3 },
  { name: "iPhone 12 to 14, 16e", width: 390, height: 844, dpr: 3 },
  { name: "iPhone 11 Pro Max", width: 414, height: 896, dpr: 3 },
  { name: "iPhone 11, XR", width: 414, height: 896, dpr: 2 },
  { name: "iPhone 11 Pro, 12 and 13 mini", width: 375, height: 812, dpr: 3 },
  { name: "iPhone SE", width: 375, height: 667, dpr: 2 },
  { name: "iPad Pro 13 (M4 and later)", width: 1032, height: 1376, dpr: 2 },
  { name: "iPad Pro 12.9, iPad Air 13", width: 1024, height: 1366, dpr: 2 },
  { name: "iPad Pro 11 (M4 and later)", width: 834, height: 1210, dpr: 2 },
  { name: "iPad Pro 11, iPad Air 11", width: 834, height: 1194, dpr: 2 },
  { name: "iPad Air, iPad (10th and later)", width: 820, height: 1180, dpr: 2 },
  { name: "iPad mini", width: 744, height: 1133, dpr: 2 },
];

/** A launch image's file, served at /brand/splash/<file>. */
export const splashFile = (theme, device) =>
  `launch-${theme}-${device.width * device.dpr}x${device.height * device.dpr}.png`;
