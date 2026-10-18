"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { StagePin } from "@darb/stage";
import { LiveDistance } from "@/components/LiveDistance";
import { LiveOpenState } from "@/components/LiveOpenState";
import { AppointmentBadge } from "@/components/Badges";
import { cardOf } from "@/lib/map-pins";
import type { StageLabels } from "./types";
import styles from "./focus.module.css";

/**
 * What the map is showing, said in one line over it: "Garages in Haifa · 140". On a desktop it is
 * a quiet chip (the list beside it says the same, so it is hidden from assistive tech); on a phone
 * it heads the open map, with the way back to the list.
 */
export function MapCaption({
  title,
  count,
  loading,
  phone,
  labels,
  onBack,
}: {
  title: string;
  count: string | null;
  loading: boolean;
  phone: boolean;
  labels: Pick<StageLabels, "backToList" | "loadingPins">;
  onBack: () => void;
}) {
  return (
    <div
      className={styles.caption}
      data-stage-caption=""
      data-phone={phone ? "" : undefined}
      data-loading={loading ? "" : undefined}
      aria-hidden={phone ? undefined : true}
    >
      {phone ? (
        <button type="button" className={styles.back} onClick={onBack} data-stage-back="">
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M10 3.5 5.5 8 10 12.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{labels.backToList}</span>
        </button>
      ) : null}
      <p className={styles.captionText} role={phone ? "status" : undefined}>
        <span className={styles.captionTitle}>{title}</span>
        {count ? (
          <>
            <span className={styles.captionDot} aria-hidden="true">
              ·
            </span>
            <span className={styles.captionCount}>{count}</span>
          </>
        ) : null}
        {loading ? <span className="visually-hidden">{labels.loadingPins}</span> : null}
      </p>
      <span className={styles.progress} aria-hidden="true" />
    </div>
  );
}

/**
 * A phone's answer to a tapped pin: the business in brief, and a button into it. A pin never opens
 * a page by surprise on a small screen.
 */
export function PinCard({
  pin,
  n,
  labels,
  locale,
  onClose,
}: {
  pin: StagePin;
  /** Its number on the list; 0 on a preview. */
  n: number;
  labels: StageLabels;
  /** The Intl tag, for the live distance. */
  locale: string;
  onClose: () => void;
}) {
  const card = cardOf(pin);
  return (
    <div
      className={styles.card}
      role="group"
      aria-label={pin.name}
      data-pin-card={pin.key}
      style={card ? ({ "--pin-accent": card.accent } as CSSProperties) : undefined}
    >
      <span className={styles.mark} aria-hidden="true">
        {n > 0 ? n : null}
      </span>
      <span className={styles.cardText}>
        <span className={styles.cardName}>{pin.name}</span>
        {card?.tagline ? <span className={styles.cardLine}>{card.tagline}</span> : null}
        <span className={styles.cardMeta}>
          {card?.byAppointment ? (
            <AppointmentBadge label={labels.byAppointment} />
          ) : card ? (
            <LiveOpenState
              openNow={card.openNow}
              hours={card.hours}
              labels={{ open: labels.openNow, closed: labels.closed }}
            />
          ) : null}
          <LiveDistance
            lat={pin.lat}
            lng={pin.lng}
            template={labels.distanceKm}
            metres={labels.distanceM}
            locale={locale}
          />
          {card?.placeName ? <span className={styles.cardPlace}>{card.placeName}</span> : null}
        </span>
      </span>
      <Link href={pin.href} scroll={false} className={styles.open} data-pin-open="">
        {labels.openBusiness}
      </Link>
      <button
        type="button"
        className={styles.close}
        aria-label={labels.close}
        onClick={onClose}
        data-pin-close=""
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M7 7l10 10M17 7 7 17"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
