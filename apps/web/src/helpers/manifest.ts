import type { Locale } from "@darb/core";
import { dir } from "@darb/i18n";
import { themeColor } from "@darb/tokens";
import { ICONS } from "@/lib/pwa";
import { ht } from "./copy";
import { helperHref } from "./routes";

/** The helper app's icons sit beside the site's (scripts/make-icons.mjs draws both sets). */
export const HELPER_ICONS = ICONS;

/** Where a share into the app lands (the service worker takes a photo first; see helper-sw.js). */
export const SHARE_PATH = "/share";

/**
 * The install sheet's screenshots, per locale, made by scripts/shoot-helper-pwa.mjs into
 * packages/tokens/assets/brand/screens (served at /brand/screens).
 */
export const HELPER_SCREENSHOTS = [
  { name: "capture", label: "screenCapture" },
  { name: "mine", label: "screenMine" },
] as const;
export const HELPER_SCREEN_SIZE = { width: 1080, height: 2340 };
export const helperScreenshotFile = (name: string, locale: Locale) =>
  `helper-${name}-${locale}-narrow.webp`;

const png = (file: string, size: number, purpose: string) => ({
  src: `${HELPER_ICONS}/${file}`,
  sizes: `${size}x${size}`,
  type: "image/png",
  purpose,
});

/**
 * The helper app as its own installable app: its own id, name and icon (the Darb mark with a small
 * badge), and start_url and scope on /helpers, so it opens straight into adding businesses and
 * never into the admin or the public map.
 */
export function helperManifest(locale: Locale) {
  const home = helperHref(locale);
  return {
    id: home,
    name: ht(locale, "title"),
    short_name: ht(locale, "appName"),
    description: ht(locale, "tagline"),
    lang: locale,
    dir: dir(locale),
    start_url: home,
    scope: home,
    display: "standalone",
    orientation: "portrait",
    background_color: themeColor.day,
    theme_color: themeColor.day,
    categories: ["utilities", "productivity"],
    icons: [
      png("helper-icon-light-192.png", 192, "any"),
      png("helper-icon-light-512.png", 512, "any"),
      png("helper-maskable-light-512.png", 512, "maskable"),
    ],
    // Long press on the home screen icon: straight to the camera, or to the list.
    shortcuts: [
      {
        name: ht(locale, "shortcutAdd"),
        short_name: ht(locale, "shortcutAdd"),
        url: `${home}?camera=1`,
        icons: [png("helper-shortcut-add-light.png", 96, "any")],
      },
      {
        name: ht(locale, "shortcutMine"),
        short_name: ht(locale, "shortcutMine"),
        url: helperHref(locale, "/mine"),
        icons: [png("helper-shortcut-mine-light.png", 96, "any")],
      },
    ],
    // Share a map link or a photo of a sign from another app into this one.
    share_target: {
      action: helperHref(locale, SHARE_PATH),
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "photo", accept: ["image/*"] }],
      },
    },
    screenshots: HELPER_SCREENSHOTS.map((s) => ({
      src: `/brand/screens/${helperScreenshotFile(s.name, locale)}`,
      sizes: `${HELPER_SCREEN_SIZE.width}x${HELPER_SCREEN_SIZE.height}`,
      type: "image/webp",
      form_factor: "narrow",
      label: ht(locale, s.label),
    })),
  };
}
