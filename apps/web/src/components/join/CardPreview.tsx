import type { CardAccent, CardIconStyle, LatLng } from "@darb/core";
import type { JoinCopy } from "@/content/join";
import { openNow, type Week } from "@/lib/week-hours";
import { Icon as JoinIcon, type IconName as JoinIconName } from "../icons/Icon";
import styles from "./Join.module.css";

export interface CardPreviewProps {
  copy: JoinCopy["preview"];
  name: string;
  kindName: string | null;
  townName: string | null;
  address: string;
  accent: CardAccent;
  icons: CardIconStyle;
  logoUrl: string | null;
  photoUrl: string | null;
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
 * The business card as it will look, redrawn on every keystroke. Its buttons are pictures of
 * buttons (nothing here leaves the form); the list still names each one for screen readers.
 */
export function CardPreview(p: CardPreviewProps) {
  const open = openNow(p.week, p.now);
  const actions: [JoinIconName, string, boolean][] = [
    ["phone", p.copy.call, Boolean(p.phone.trim())],
    ["whatsapp", p.copy.whatsapp, Boolean(p.whatsapp.trim())],
    ["waze", p.copy.waze, p.point !== null],
    ["globe", p.copy.website, Boolean(p.website.trim())],
    ["instagram", p.copy.instagram, Boolean(p.instagram.trim())],
    ["facebook", p.copy.facebook, Boolean(p.facebook.trim())],
    ["tiktok", p.copy.tiktok, Boolean(p.tiktok.trim())],
  ];
  const shown = actions.filter(([, , on]) => on);
  const name = p.name.trim() || p.copy.yourName;
  return (
    <figure
      className={styles.card}
      data-icons={p.icons}
      style={{ "--accent": p.accent } as React.CSSProperties}
      aria-label={p.copy.title}
    >
      {p.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- an upload preview, not a page image
        <img className={styles.cover} src={p.photoUrl} alt="" />
      ) : (
        <div className={styles.cover} aria-hidden="true" />
      )}
      <div className={styles.cardHead}>
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- an upload preview
          <img className={styles.logo} src={p.logoUrl} alt="" />
        ) : (
          <span className={styles.logo} aria-hidden="true">
            {[...name][0]?.toUpperCase()}
          </span>
        )}
        <div className={styles.cardTitle}>
          <strong dir="auto">{name}</strong>
          {p.kindName || p.townName ? (
            <span>{[p.kindName, p.townName].filter(Boolean).join(" · ")}</span>
          ) : null}
        </div>
      </div>
      {open !== null ? (
        <p className={open ? `${styles.state} ${styles.stateOpen}` : styles.state}>
          <JoinIcon name="clock" size={16} />
          {open ? p.copy.openNow : p.copy.closedNow}
        </p>
      ) : null}
      {p.address.trim() ? (
        <p className={styles.place}>
          <JoinIcon name="pin" size={16} />
          <bdi>{p.address.trim()}</bdi>
        </p>
      ) : null}
      {shown.length ? (
        <ul className={styles.actionsRow}>
          {shown.map(([icon, label]) => (
            <li key={icon} className={styles.action}>
              <span className={styles.actionIcon}>
                <JoinIcon name={icon} />
              </span>
              <span className={styles.actionLabel}>{label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
