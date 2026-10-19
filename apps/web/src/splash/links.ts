import { SPLASH_DEVICES, SPLASH_THEMES, splashFile } from "./devices.mjs";

/** Where scripts/make-splash.mjs's launch images are served (packages/tokens/assets/brand/splash). */
export const SPLASH_PATH = "/brand/splash";

export type StartupImage = { url: string; media: string };

/**
 * The iOS launch images (apple-touch-startup-image), for Next's metadata.appleWebApp.startupImage:
 * one per screen and scheme. iOS shows one only when its media query names the exact screen
 * (device width and height in CSS pixels, pixel ratio, portrait); night ones carry the dark scheme.
 * Every app links the same set: the launch frame has no words.
 */
export function startupImages(): StartupImage[] {
  return SPLASH_THEMES.flatMap((theme) =>
    SPLASH_DEVICES.map((device) => ({
      url: `${SPLASH_PATH}/${splashFile(theme, device)}`,
      media: [
        `(device-width: ${device.width}px)`,
        `(device-height: ${device.height}px)`,
        `(-webkit-device-pixel-ratio: ${device.dpr})`,
        "(orientation: portrait)",
        `(prefers-color-scheme: ${theme})`,
      ].join(" and "),
    })),
  );
}
