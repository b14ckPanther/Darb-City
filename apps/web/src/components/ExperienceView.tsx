import { pickText, type Locale } from "@darb/core";
import type { BusinessDetailDto, KindDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { formatPhone } from "@/lib/format";
import { directionsHref, primaryAction, safeHttpUrl, telHref, whatsappHref } from "@/lib/links";
import { ExampleBadge } from "./Badges";
import { LiveOpenState } from "./LiveOpenState";
import { LocaleSwitch } from "./CityBar";
import { HoursTable } from "./HoursTable";
import { SheetActions } from "./SheetActions";
import { parseScreen } from "./templates";
import { ScreenView } from "./templates/ScreenView";
import styles from "./Experience.module.css";

export interface ExperienceViewProps {
  locale: Locale;
  business: BusinessDetailDto;
  /** The business's primary kind: its template and its name. */
  kind: KindDto;
  placeName: string;
  /** Level 4 segments, for the in-sheet locale switch. */
  segments: readonly string[];
  shareUrl: string;
}

export function ExperienceView({
  locale,
  business,
  kind,
  placeName,
  segments,
  shareUrl,
}: ExperienceViewProps) {
  const name = pickText(business.name, locale);
  const screen = parseScreen(business.experience);
  const apps =
    business.tier === "darb"
      ? [business.apps.web, business.apps.ios, business.apps.android]
          .map((url) => safeHttpUrl(url))
          .filter((url): url is string => url !== null)
          .map((url) => ({ label: t(locale, "openTheApp"), href: url }))
      : [];
  const greeting = t(locale, "whatsappGreeting", { name });
  return (
    <article className={styles.view}>
      <header className={styles.head}>
        <LocaleSwitch locale={locale} segments={segments} />
        <h2 id="sheet-title" className={styles.title} data-sheet-title="">
          {name}
        </h2>
        <p className={styles.kind}>
          {pickText(kind.name, locale)} · {placeName}
        </p>
        <p className={styles.badges}>
          {business.tier === "example" ? <ExampleBadge label={t(locale, "example")} /> : null}
          <LiveOpenState
            openNow={business.openNow}
            hours={business.openNow === null ? null : business.hours}
            labels={{ open: t(locale, "openNow"), closed: t(locale, "closed") }}
          />
        </p>
        {business.phone ? (
          <p className={styles.muted}>
            <span dir="ltr">{formatPhone(business.phone)}</span>
          </p>
        ) : null}
      </header>
      {screen ? <ScreenView screen={screen} template={kind.template} locale={locale} /> : null}
      <SheetActions
        primary={primaryAction(business, locale)}
        ctaLabel={screen ? pickText(screen.cta, locale) : t(locale, "call")}
        secondary={{
          call: business.phone ? telHref(business.phone) : null,
          whatsapp: business.whatsapp ? whatsappHref(business.whatsapp, greeting) : null,
          directions: directionsHref(business.lat, business.lng),
          website: safeHttpUrl(business.website),
          apps,
        }}
        share={{ url: shareUrl, title: name }}
        labels={{
          call: t(locale, "call"),
          whatsapp: t(locale, "whatsapp"),
          directions: t(locale, "directions"),
          share: t(locale, "share"),
          website: t(locale, "website"),
          exampleNotice: t(locale, "exampleNotice"),
          linkCopied: t(locale, "linkCopied"),
          linkCopyFailed: t(locale, "linkCopyFailed"),
        }}
      />
      <HoursTable locale={locale} hours={business.hours} />
    </article>
  );
}
