import type { CardAccent, CardIconStyle, LatLng, Locale } from "@darb/core";
import type { JoinCopy } from "@/content/join";
import { cardFromDraft } from "@/lib/card";
import { weekToHours, type Week } from "@/lib/week-hours";
import { BusinessCard } from "../card/BusinessCard";
import styles from "./Join.module.css";

export interface CardPreviewProps {
  locale: Locale;
  copy: JoinCopy["preview"];
  name: string;
  kindName: string | null;
  townName: string | null;
  address: string;
  accent: CardAccent;
  icons: CardIconStyle;
  logoUrl: string | null;
  photoUrls: string[];
  phone: string;
  whatsapp: string;
  point: LatLng | null;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  week: Week;
  /** Fixed in tests; the live preview reads the clock. */
  now?: Date;
}

/**
 * The business card as it will look, redrawn on every keystroke: the very card the public sheet
 * draws, in preview mode, so its buttons are pictures of buttons (nothing here leaves the form).
 */
export function CardPreview({ locale, copy, week, now, ...p }: CardPreviewProps) {
  const card = cardFromDraft(locale, copy.card, {
    ...p,
    name: p.name.trim() || copy.yourName,
    hours: weekToHours(week),
  });
  return (
    <figure className={styles.card} aria-label={copy.title}>
      <BusinessCard
        locale={locale}
        copy={copy.card}
        card={card}
        renderedAt={(now ?? new Date()).getTime()}
        preview
      />
    </figure>
  );
}
