import type { Metadata } from "next";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { ExperienceView } from "@/components/ExperienceView";
import { Sheet } from "@/components/Sheet";
import { crumbsFor } from "@/lib/crumbs";
import type { BusinessLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { siteUrl } from "@/lib/site";

/** Canonical at the business's own place, wherever it was opened from. */
export function businessLevelMetadata(level: BusinessLevel): Metadata {
  const { locale, home, kind, business, canonical } = level;
  return pageMetadata({
    locale,
    segments: canonical,
    title: pickText(business.name, locale),
    description:
      pickText(business.tagline, locale) ||
      t(locale, "kindInPlace", {
        kind: pickText(kind.name, locale),
        place: pickText(home.name, locale),
      }),
  });
}

/** Level 4: the sheet over the listed place's kind list; closing returns to that list. */
export function BusinessLevelView({ level }: { level: BusinessLevel }) {
  const { locale, place, sector, kind, business, primaryKind, home, segments, canonical } = level;
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, { place, sector, kind, business })}
        segments={segments}
      />
      <Sheet
        closeHref={href(locale, paths.kind(place.slug, sector.slug, kind.slug))}
        labelledBy="sheet-title"
        returnFocusTo={`${business.placeSlug}/${business.slug}`}
        labels={{
          close: t(locale, "close"),
          resize: {
            peek: t(locale, "resizeSheetState", { snap: t(locale, "sheetPeek") }),
            half: t(locale, "resizeSheetState", { snap: t(locale, "sheetHalf") }),
            full: t(locale, "resizeSheetState", { snap: t(locale, "sheetFull") }),
          },
        }}
      >
        <ExperienceView
          locale={locale}
          business={business}
          kind={primaryKind}
          placeName={pickText(home.name, locale)}
          segments={segments}
          shareUrl={`${siteUrl()}${href(locale, canonical)}`}
        />
      </Sheet>
    </>
  );
}
