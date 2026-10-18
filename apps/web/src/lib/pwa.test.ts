// @vitest-environment node
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import { GET } from "@/app/[locale]/manifest.webmanifest/route";
import { appMetadata, manifest, manifestHref, themeColors } from "./pwa";

const require = createRequire(import.meta.url);
const BRAND = dirname(require.resolve("@darb/tokens/assets/brand/darb-mark-480.webp"));
/** A /brand/... URL's committed source file. */
const onDisk = (src: string) => join(BRAND, src.replace(/^\/brand\//, ""));

const DASHES = /[‒-―־]/;

it("serves one manifest per locale with its own name, language and direction", async () => {
  const expected = {
    he: { short: "דרב", dir: "rtl", start: "/?source=pwa" },
    ar: { short: "درب", dir: "rtl", start: "/ar?source=pwa" },
    en: { short: "Darb", dir: "ltr", start: "/en?source=pwa" },
  } as const;
  for (const locale of LOCALES) {
    const res = await GET(new Request(`http://x${manifestHref(locale)}`), {
      params: Promise.resolve({ locale }),
    });
    expect(res.headers.get("content-type")).toContain("application/manifest+json");
    const m = await res.json();
    expect(m).toMatchObject({
      id: "/",
      scope: "/",
      lang: locale,
      dir: expected[locale].dir,
      short_name: expected[locale].short,
      start_url: expected[locale].start,
      display: "standalone",
      display_override: ["standalone", "minimal-ui"],
      orientation: "portrait",
      background_color: "#f7f1e4",
      theme_color: "#f7f1e4",
    });
    expect(m.name.startsWith(`${expected[locale].short} · `)).toBe(true);
    expect(m.name).not.toMatch(DASHES);
    expect(m.name).not.toContain("|");
  }
});

it("404s a manifest for an unknown locale", async () => {
  const res = await GET(new Request("http://x/fr/manifest.webmanifest"), {
    params: Promise.resolve({ locale: "fr" }),
  });
  expect(res.status).toBe(404);
});

it("lists any, maskable and monochrome icons, all committed", () => {
  for (const locale of LOCALES) {
    const { icons } = manifest(locale);
    expect(icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
      "512x512 monochrome",
    ]);
    for (const icon of icons) expect(existsSync(onDisk(icon.src)), icon.src).toBe(true);
  }
});

it("localizes the four shortcuts, each with a committed 96 px icon", () => {
  const names = Object.fromEntries(
    LOCALES.map((l) => [l, manifest(l).shortcuts.map((s) => s.name)]),
  );
  expect(names.he).toEqual(["קרוב אליי", "חיפוש", "המפה", "הוסיפו עסק"]);
  expect(names.ar).toEqual(["بالقرب مني", "بحث", "الخريطة", "ضيف مصلحتك"]);
  expect(names.en).toEqual(["Near me", "Search", "Map", "Add a business"]);
  expect(manifest("ar").shortcuts.map((s) => s.url)).toEqual([
    "/ar/near?source=pwa",
    "/ar/search?source=pwa",
    "/ar/israel?source=pwa",
    "/ar/join?source=pwa",
  ]);
  expect(manifest("he").shortcuts[0]!.url).toBe("/near?source=pwa");
  for (const locale of LOCALES)
    for (const s of manifest(locale).shortcuts) {
      expect(s.icons[0]!.sizes).toBe("96x96");
      expect(existsSync(onDisk(s.icons[0]!.src)), s.icons[0]!.src).toBe(true);
    }
});

it("names the home screen app with the brand alone, in the page's language", () => {
  const titles = Object.fromEntries(
    LOCALES.map((l) => {
      const meta = appMetadata(l);
      expect(meta.applicationName).toBe(
        typeof meta.appleWebApp === "object" ? meta.appleWebApp?.title : undefined,
      );
      expect(meta.appleWebApp).toMatchObject({ capable: true, statusBarStyle: "default" });
      expect(meta.formatDetection).toEqual({ telephone: false });
      expect(meta.manifest).toBe(`/${l}/manifest.webmanifest`);
      return [l, meta.applicationName];
    }),
  );
  expect(titles).toEqual({ he: "דרב", ar: "درب", en: "Darb" });
});

it("switches the tab icon with the device's scheme and keeps one committed iOS icon", () => {
  const icons = appMetadata("he").icons as {
    icon: { url: string; media: string }[];
    apple: { url: string };
  };
  expect(icons.icon.filter((i) => i.media === "(prefers-color-scheme: light)")).not.toHaveLength(0);
  for (const i of icons.icon) {
    expect(i.url).toContain(i.media.includes("dark") ? "-dark-" : "-light-");
    expect(existsSync(onDisk(i.url)), i.url).toBe(true);
  }
  expect(existsSync(onDisk(icons.apple.url))).toBe(true);
});

it("colours the browser chrome ivory by day and forest by night", () => {
  expect(themeColors).toEqual([
    { media: "(prefers-color-scheme: light)", color: "#f7f1e4" },
    { media: "(prefers-color-scheme: dark)", color: "#03110c" },
  ]);
});
