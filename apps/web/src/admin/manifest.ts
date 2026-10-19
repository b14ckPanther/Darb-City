import type { Locale } from "@darb/core";
import { dir } from "@darb/i18n";
import { themeColor } from "@darb/tokens";
import { ICONS } from "@/lib/pwa";
import { at, type AdminKey } from "./copy";
import { adminHref } from "./routes";

/** The admin app's icons sit beside the site's and the helper app's (scripts/make-icons.mjs). */
export const ADMIN_ICONS = ICONS;

const png = (file: string, size: number, purpose: string) => ({
  src: `${ADMIN_ICONS}/${file}`,
  sizes: `${size}x${size}`,
  type: "image/png",
  purpose,
});

/** Long press on the home screen icon: the three places an admin goes to most from a phone. */
export const ADMIN_SHORTCUTS = [
  { icon: "street", label: "navStreet", path: "/field" },
  { icon: "join", label: "navJoin", path: "/join-requests" },
  { icon: "helpers", label: "navHelpers", path: "/helpers" },
] as const satisfies readonly { icon: string; label: AdminKey; path: string }[];

/**
 * The admin as its own installable app: its own id, name and icon (the Darb mark with a shield
 * badge), and start_url and scope on /admin, so it opens straight into the admin and never into
 * the public map or the helper app. Nothing is cached offline: every admin page stays no-store.
 */
export function adminManifest(locale: Locale) {
  const home = adminHref(locale);
  return {
    id: home,
    name: at(locale, "title"),
    short_name: at(locale, "title"),
    description: at(locale, "appDescription"),
    lang: locale,
    dir: dir(locale),
    start_url: home,
    scope: home,
    display: "standalone",
    background_color: themeColor.day,
    theme_color: themeColor.day,
    categories: ["business", "productivity"],
    icons: [
      png("admin-icon-light-192.png", 192, "any"),
      png("admin-icon-light-512.png", 512, "any"),
      png("admin-maskable-light-512.png", 512, "maskable"),
    ],
    shortcuts: ADMIN_SHORTCUTS.map((s) => ({
      name: at(locale, s.label),
      short_name: at(locale, s.label),
      url: adminHref(locale, s.path),
      icons: [png(`admin-shortcut-${s.icon}-light.png`, 96, "any")],
    })),
  };
}
