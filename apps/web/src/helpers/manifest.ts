import type { Locale } from "@darb/core";
import { dir } from "@darb/i18n";
import { themeColor } from "@darb/tokens";
import { ICONS } from "@/lib/pwa";
import { ht } from "./copy";
import { helperHref } from "./routes";

/** The helper app's icons sit beside the site's (scripts/make-icons.mjs draws both sets). */
export const HELPER_ICONS = ICONS;

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
  };
}
