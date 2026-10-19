import { AdminEdit } from "./AdminEdit";
import Link from "next/link";
import { pickText, type Locale } from "@darb/core";
import type { BusinessDetailDto, KindDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { card as cardCopy } from "@/content/card";
import { CHAIN_APPS } from "@/content/chain-apps";
import { cardFromBusiness } from "@/lib/card";
import { safeHttpUrl } from "@/lib/links";
import { href, paths } from "@/lib/routes";
import { AppPreview } from "./app-preview/AppPreview";
import { OwnerLine } from "./app-preview/OwnerLine";
import { BusinessCard } from "./card/BusinessCard";
import { ChainApp } from "./ChainApp";
import { LocaleSwitch } from "./CityBar";
import { parseScreen } from "./templates";
import { ScreenView } from "./templates/ScreenView";
import styles from "./Experience.module.css";

export interface ExperienceViewProps {
  locale: Locale;
  business: BusinessDetailDto;
  /** The business's primary kind: its template and its name. */
  kind: KindDto;
  placeName: string;
  /** The primary kind's sector colour: the card's accent when the owner chose none. */
  sectorAccent: string;
  /** Level 4 segments, for the in-sheet locale switch. */
  segments: readonly string[];
  shareUrl: string;
  /** The server's clock at render (tests fix it). */
  now?: Date;
}

/** Level 4's sheet: the business card, then the business's own designed screen below it. */
export function ExperienceView({
  locale,
  business,
  kind,
  placeName,
  sectorAccent,
  segments,
  shareUrl,
  now = new Date(),
}: ExperienceViewProps) {
  const screen = parseScreen(business.experience);
  const copy = cardCopy[locale];
  const card = cardFromBusiness({
    locale,
    copy,
    business,
    kindName: pickText(kind.name, locale),
    placeName,
    sectorAccent,
    ctaLabel: screen ? pickText(screen.cta, locale) : null,
    shareUrl,
  });
  // A Darb client's own app (darb tier only, like the card's main button).
  const app = business.tier === "darb" ? safeHttpUrl(business.apps.web) : null;
  // Owners of ordinary listings hear about their own app once: here, or in a chain's invitation.
  const owners =
    business.tier !== "darb" &&
    business.tier !== "example" &&
    !(business.brandSlug && CHAIN_APPS[business.brandSlug]);
  return (
    <article className={styles.view}>
      <LocaleSwitch locale={locale} segments={segments} />
      <BusinessCard locale={locale} copy={copy} card={card} renderedAt={now.getTime()} />
      <AdminEdit locale={locale} id={business.id} />
      {app ? <AppPreview locale={locale} name={card.name} url={app} screen={screen} /> : null}
      {screen ? <ScreenView screen={screen} template={kind.template} locale={locale} /> : null}
      {owners ? <OwnerLine locale={locale} /> : null}
      <ChainApp locale={locale} brand={business.brandSlug} ours={business.tier === "darb"} />
      {business.tier === "darb" ? (
        // Every Darb client's listing invites other business owners (Task 28).
        <p className={styles.builtBy} data-built-by-darb="">
          <Link href={href(locale, paths.forBusiness())}>{t(locale, "builtByDarb")}</Link>
        </p>
      ) : null}
    </article>
  );
}
