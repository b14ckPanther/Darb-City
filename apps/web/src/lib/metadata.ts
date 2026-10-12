import type { Metadata } from "next";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { OG_LOCALE } from "./locale";
import { href, languageAlternates } from "./routes";

export interface PageMeta {
  locale: Locale;
  segments: readonly string[];
  title: string;
  description: string;
}

export function pageMetadata({ locale, segments, title, description }: PageMeta): Metadata {
  const brand = t(locale, "appName");
  const fullTitle = title === brand ? brand : `${title} · ${brand}`;
  const url = href(locale, segments);
  // There is no Arabic share image yet; the Hebrew one carries the bilingual wordmark.
  const image = locale === "en" ? "/brand/og-en.jpg" : "/brand/og-he.jpg";
  return {
    title: fullTitle,
    description,
    alternates: { canonical: url, languages: languageAlternates(segments) },
    openGraph: {
      type: "website",
      url,
      title: fullTitle,
      description,
      siteName: brand,
      locale: OG_LOCALE[locale],
      images: [{ url: image, width: 1200, height: 630, alt: brand }],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image] },
  };
}
