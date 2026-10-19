import type { CSSProperties, ReactNode } from "react";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import type { CardCopy } from "@/content/card";
import type { CardModel } from "@/lib/card";
import { AppointmentBadge, ExampleBadge, GlutenFreeBadge } from "../Badges";
import { HoursTable } from "../HoursTable";
import { Icon } from "../icons/Icon";
import { SheetActions } from "../SheetActions";
import { CardImage } from "./CardImage";
import { PhotoStrip, TodayState } from "./Lazy";
import styles from "./Card.module.css";
import photoStyles from "./Photos.module.css";
import todayStyles from "./Today.module.css";

/**
 * A business's card, in the owner's colours: a band in their accent with their logo (or the first
 * letter of the name), today's hours on a dial, the main button and a row of round icon buttons,
 * the address, photos, social pages and the week. The public sheet and the /join preview draw this
 * same card; the preview's buttons are pictures (nothing there leaves the form).
 */
export function BusinessCard({
  locale,
  copy,
  card,
  renderedAt,
  preview = false,
}: {
  locale: Locale;
  copy: CardCopy;
  card: CardModel;
  /** The server's clock at render; today's state starts from it, then follows the browser's. */
  renderedAt: number;
  preview?: boolean;
}) {
  const vars = {
    "--card-accent": card.accent,
    "--card-ink": card.ink,
    // Light falls away from the ink, so the band's glow only ever adds contrast.
    "--card-glow": card.ink === "#000000" ? "rgb(255 255 255 / 0.22)" : "rgb(0 0 0 / 0.22)",
  } as CSSProperties;
  const Title = preview ? "p" : "h2";
  const hasHours = Object.values(card.hours.weekly).some((d) => (d?.length ?? 0) > 0);
  const label = (key: Parameters<typeof t>[1]) => t(locale, key);
  const badges: ReactNode[] = [
    card.example ? <ExampleBadge key="example" label={label("example")} /> : null,
    card.glutenFree ? <GlutenFreeBadge key="gf" label={label("glutenFree")} /> : null,
  ].filter(Boolean);
  return (
    <div
      className={styles.card}
      style={vars}
      data-icons={card.icons}
      data-business-card={preview ? "preview" : ""}
    >
      <header className={styles.band}>
        <span className={styles.logo}>
          {card.logoUrl ? (
            <CardImage src={card.logoUrl} alt="" sizes="64px" eager />
          ) : (
            <span className={styles.monogram} aria-hidden="true" data-monogram="">
              {[...card.name][0]?.toLocaleUpperCase(locale)}
            </span>
          )}
        </span>
        <span className={styles.identity}>
          <Title
            id={preview ? undefined : "sheet-title"}
            className={styles.name}
            dir="auto"
            {...(preview ? {} : { "data-sheet-title": "" })}
          >
            {card.name}
          </Title>
          {card.meta ? <span className={styles.meta}>{card.meta}</span> : null}
        </span>
        {badges.length ? <span className={styles.badges}>{badges}</span> : null}
      </header>

      {card.appointment ? (
        <p className={todayStyles.today} data-appointment-state="">
          <span className={styles.dialIcon} aria-hidden="true">
            <Icon name="calendar" variant={card.icons} />
          </span>
          <AppointmentBadge label={label("byAppointment")} />
        </p>
      ) : hasHours ? (
        <TodayState
          hours={card.hours}
          renderedAt={renderedAt}
          labels={{
            openUntil: copy.openUntil,
            opensAt: copy.opensAt,
            opensTomorrow: copy.opensTomorrow,
            closedToday: copy.closedToday,
            openAllDay: copy.openAllDay,
            today: copy.today,
          }}
        />
      ) : null}

      <SheetActions
        primary={card.primary}
        ctaLabel={card.ctaLabel}
        actions={card.actions}
        share={card.share}
        glyphs={{
          primary: <Icon name={card.primaryIcon} variant={card.icons} size={22} />,
          actions: card.actions.map((a) => (
            <Icon key={a.href} name={a.icon} variant={card.icons} />
          )),
          share: <Icon name="share" variant={card.icons} />,
          more: <Icon name="more" variant={card.icons} />,
        }}
        preview={preview}
        labels={{
          share: label("share"),
          more: copy.more,
          moreWays: copy.moreWays,
          contactWays: copy.contactWays,
          exampleNotice: label("exampleNotice"),
          linkCopied: label("linkCopied"),
          linkCopyFailed: label("linkCopyFailed"),
        }}
      />

      {card.address ? (
        <p className={styles.address} data-address="">
          <Icon name="pin" variant={card.icons} size={20} />
          <span className="visually-hidden">{copy.address}: </span>
          <bdi>{card.address}</bdi>
        </p>
      ) : null}

      {card.photos.length ? (
        <PhotoStrip
          thumbs={card.photos.map((p) => (
            <CardImage key={p.src} src={p.src} alt={p.alt} sizes="160px" />
          ))}
          slides={card.photos.map((p) => (
            <CardImage key={p.src} src={p.src} alt={p.alt} sizes="100vw" contain />
          ))}
          glyphs={{
            close: <Icon name="close" />,
            previous: <Icon name="chevron" className={photoStyles.back} />,
            next: <Icon name="chevron" />,
          }}
          labels={{
            photos: copy.photos,
            openPhoto: copy.openPhoto,
            photoCount: copy.photoCount,
            previous: copy.previousPhoto,
            next: copy.nextPhoto,
            close: label("close"),
          }}
        />
      ) : null}

      {card.social.length ? (
        <ul className={styles.social} aria-label={copy.socialPages}>
          {card.social.map((s) => (
            <li key={s.key}>
              {preview ? (
                <span className={styles.chip} data-social={s.key}>
                  <Icon name={s.key} variant={card.icons} size={20} />
                  {s.label}
                </span>
              ) : (
                <a
                  href={s.href}
                  className={styles.chip}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-social={s.key}
                >
                  <Icon name={s.key} variant={card.icons} size={20} />
                  {s.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {preview && !hasHours ? null : (
        <HoursTable locale={locale} hours={card.hours} todayLabel={copy.today} />
      )}
    </div>
  );
}
