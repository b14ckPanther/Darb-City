import type { Metadata } from "next";
import type { Locale } from "@darb/core";
import { dir, t } from "@darb/i18n";
import { themeColor } from "@darb/tokens";
import { href, paths } from "./routes";

/** Where the generated app icons are served (packages/tokens/assets/brand/icons, see make-icons). */
export const ICONS = "/brand/icons";

/** iOS cannot switch home screen icons by scheme; the ivory one reads on both wallpapers. */
export const APPLE_TOUCH_ICON = `${ICONS}/apple-touch-icon-light.png`;

/** The installed app's names and words, per locale. No dashes; the short name is the brand alone. */
export const pwaCopy: Record<
  Locale,
  {
    name: string;
    shortcuts: { near: string; search: string; map: string; join: string };
    screens: { landing: string; business: string };
    install: { chip: string; iosTitle: string; iosBody: string; dismiss: string };
  }
> = {
  he: {
    name: "דרב · כל עסק, בכל מקום",
    shortcuts: { near: "קרוב אליי", search: "חיפוש", map: "המפה", join: "הוסיפו עסק" },
    screens: { landing: "כל עסק, בכל עיר, עיירה וכפר", business: "כרטיס של עסק בדרב" },
    install: {
      chip: "הוסיפו את דרב למסך הבית",
      iosTitle: "דרב על מסך הבית",
      iosBody: "בספארי, הקישו על כפתור השיתוף ואז על „הוספה למסך הבית”.",
      dismiss: "הבנתי",
    },
  },
  ar: {
    name: "درب · كل مصلحة، بكل مكان",
    shortcuts: { near: "بالقرب مني", search: "بحث", map: "الخريطة", join: "ضيف مصلحتك" },
    screens: { landing: "كل مصلحة، بكل مدينة وبلدة وقرية", business: "كرت مصلحة على درب" },
    install: {
      chip: "حط درب على الشاشة الرئيسية",
      iosTitle: "درب على شاشتك الرئيسية",
      iosBody: "بسفاري، اكبس على زر المشاركة وبعدين على «إضافة إلى الشاشة الرئيسية».",
      dismiss: "تمام",
    },
  },
  en: {
    name: "Darb · Every business, everywhere",
    shortcuts: { near: "Near me", search: "Search", map: "Map", join: "Add a business" },
    screens: {
      landing: "Every business, in every city, town and village",
      business: "A business card on Darb",
    },
    install: {
      chip: "Add Darb to your home screen",
      iosTitle: "Darb on your home screen",
      iosBody: "In Safari, tap the Share button, then “Add to Home Screen”.",
      dismiss: "Got it",
    },
  },
};

/** The browser and status bar colour: ivory by day, the night forest by night. */
export const themeColors = [
  { media: "(prefers-color-scheme: light)", color: themeColor.day },
  { media: "(prefers-color-scheme: dark)", color: themeColor.night },
];

/** The manifest's own URL for a locale (one manifest per locale: its name, lang and dir). */
export function manifestHref(locale: Locale): string {
  return `/${locale}/manifest.webmanifest`;
}

type Icon = { src: string; sizes: string; type: string; purpose?: string };
const png = (file: string, size: number, purpose?: string): Icon => ({
  src: `${ICONS}/${file}`,
  sizes: `${size}x${size}`,
  type: "image/png",
  ...(purpose ? { purpose } : {}),
});

/**
 * The screenshots Android shows on its install sheet, per locale, made by scripts/shoot-pwa.mjs
 * into packages/tokens/assets/brand/screens.
 */
export const SCREENSHOTS = [
  { name: "landing", form: "narrow", width: 1080, height: 1920 },
  { name: "business", form: "narrow", width: 1080, height: 1920 },
  { name: "landing", form: "wide", width: 1920, height: 1080 },
] as const;

export const screenshotFile = (s: (typeof SCREENSHOTS)[number], locale: Locale) =>
  `${s.name}-${locale}-${s.form}.webp`;

export function manifest(locale: Locale) {
  const copy = pwaCopy[locale];
  const shortcut = (name: keyof typeof copy.shortcuts, segments: string[]) => ({
    name: copy.shortcuts[name],
    short_name: copy.shortcuts[name],
    url: `${href(locale, segments)}?source=pwa`,
    icons: [png(`shortcut-${name}-light.png`, 96)],
  });
  return {
    id: "/",
    name: copy.name,
    short_name: t(locale, "appName"),
    description: t(locale, "tagline"),
    lang: locale,
    dir: dir(locale),
    start_url: `${href(locale)}?source=pwa`,
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    // The site is day first: the splash and the title bar open on its ivory paper.
    background_color: themeColor.day,
    theme_color: themeColor.day,
    categories: ["lifestyle", "travel", "navigation", "shopping"],
    icons: [
      png("icon-light-192.png", 192, "any"),
      png("icon-light-512.png", 512, "any"),
      png("maskable-light-512.png", 512, "maskable"),
      png("monochrome-512.png", 512, "monochrome"),
    ],
    shortcuts: [
      shortcut("near", paths.near()),
      shortcut("search", paths.search()),
      shortcut("map", paths.explore()),
      shortcut("join", paths.join()),
    ],
    screenshots: SCREENSHOTS.map((s) => ({
      src: `/brand/screens/${screenshotFile(s, locale)}`,
      sizes: `${s.width}x${s.height}`,
      type: "image/webp",
      form_factor: s.form,
      label: copy.screens[s.name],
    })),
  };
}

/**
 * The installable app's head tags for a locale: its name (iOS names the home screen icon from
 * apple-mobile-web-app-title, so it is the brand alone, in the page's language), its manifest and
 * its icons. The tab icon follows the device: ivory by day, forest by night.
 */
export function appMetadata(locale: Locale): Metadata {
  const appName = t(locale, "appName");
  const tab = (theme: "light" | "dark", size: number) => ({
    url: `${ICONS}/favicon-${theme}-${size}.png`,
    sizes: `${size}x${size}`,
    type: "image/png",
    media: `(prefers-color-scheme: ${theme})`,
  });
  return {
    applicationName: appName,
    manifest: manifestHref(locale),
    appleWebApp: { capable: true, title: appName, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    icons: {
      icon: [tab("light", 32), tab("light", 16), tab("dark", 32), tab("dark", 16)],
      apple: { url: APPLE_TOUCH_ICON, sizes: "180x180", type: "image/png" },
    },
  };
}
