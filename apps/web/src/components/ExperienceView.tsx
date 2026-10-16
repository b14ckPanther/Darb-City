import Link from "next/link";
import { isByAppointment, pickText, type Locale } from "@darb/core";
import type { BusinessDetailDto, KindDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { formatPhone } from "@/lib/format";
import {
  addressHidden,
  directionsHref,
  primaryAction,
  safeHttpUrl,
  telHref,
  whatsappHref,
} from "@/lib/links";
import { href, paths } from "@/lib/routes";
import { AppointmentBadge, ExampleBadge, GlutenFreeBadge } from "./Badges";
import { LiveOpenState } from "./LiveOpenState";
import { LocaleSwitch } from "./CityBar";
import { HoursTable } from "./HoursTable";
import { JoinIcon } from "./join/JoinIcons";
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
  const primary = primaryAction(business, locale);
  const mainHref = "href" in primary ? primary.href : null;
  // Each link once: the app the main button opens is not repeated below it.
  const apps =
    business.tier === "darb"
      ? [business.apps.web, business.apps.ios, business.apps.android]
          .map((url) => safeHttpUrl(url))
          .filter((url): url is string => url !== null && url !== mainHref)
          .map((url) => ({ label: t(locale, "openTheApp"), href: url }))
      : [];
  const website = safeHttpUrl(business.website);
  // The owner's own pages (set through /join or the admin), each only when it is a web link.
  const social = (
    [
      ["instagram", "Instagram"],
      ["facebook", "Facebook"],
      ["tiktok", "TikTok"],
    ] as const
  ).flatMap(([key, label]) => {
    const url = safeHttpUrl(business.links?.[key] ?? null);
    return url ? [{ key, label, url }] : [];
  });
  const directions = directionsHref(business.lat, business.lng);
  const appointment = isByAppointment(business.hours);
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
          {business.dietary.includes("gluten_free") ? (
            <GlutenFreeBadge label={t(locale, "glutenFree")} />
          ) : null}
          {appointment ? (
            <AppointmentBadge label={t(locale, "byAppointment")} />
          ) : (
            <LiveOpenState
              openNow={business.openNow}
              hours={business.openNow === null ? null : business.hours}
              labels={{ open: t(locale, "openNow"), closed: t(locale, "closed") }}
            />
          )}
        </p>
        {business.phone ? (
          <p className={styles.muted}>
            <span dir="ltr">{formatPhone(business.phone)}</span>
          </p>
        ) : null}
      </header>
      {screen ? <ScreenView screen={screen} template={kind.template} locale={locale} /> : null}
      <SheetActions
        primary={primary}
        ctaLabel={screen ? pickText(screen.cta, locale) : t(locale, "call")}
        secondary={{
          call: business.phone ? telHref(business.phone) : null,
          whatsapp: business.whatsapp ? whatsappHref(business.whatsapp, greeting) : null,
          directions:
            addressHidden(business.attributes) || directions === mainHref ? null : directions,
          website: website === mainHref || apps.some((a) => a.href === website) ? null : website,
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
      {social.length ? (
        <ul className={styles.social}>
          {social.map((s) => (
            <li key={s.key}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                <JoinIcon name={s.key} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <HoursTable locale={locale} hours={business.hours} />
      {business.tier === "darb" ? (
        // Every Darb client's listing invites other business owners (Task 28).
        <p className={styles.builtBy} data-built-by-darb="">
          <Link href={href(locale, paths.forBusiness())}>{t(locale, "builtByDarb")}</Link>
        </p>
      ) : null}
    </article>
  );
}
