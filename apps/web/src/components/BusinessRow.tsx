import Link from "next/link";
import { getImageProps } from "next/image";
import type { CSSProperties } from "react";
import type { BusinessRowData } from "@/lib/rows";
import { AppointmentBadge, ExampleBadge, GlutenFreeBadge } from "./Badges";
import { LiveOpenState } from "./LiveOpenState";
import styles from "./List.module.css";

export interface RowLabels {
  example: string;
  openNow: string;
  closed: string;
  glutenFree: string;
  byAppointment: string;
}

/** Pure: rendered by the server list and by ShowMore on the client. */
export function BusinessRow({
  row,
  labels,
  onOpen,
}: {
  row: BusinessRowData;
  labels: RowLabels;
  /** Client lists only (search results report the click); server lists never pass a function. */
  onOpen?: () => void;
}) {
  // A list can be long: the logo is 40 px from a resized source (48 or 96 px wide), loaded lazily.
  const logo = row.logoUrl
    ? getImageProps({ src: row.logoUrl, alt: "", width: 40, height: 40, loading: "lazy" }).props
    : null;
  return (
    <li className={styles.row} data-business={row.key}>
      <Link
        href={row.href}
        scroll={false}
        className={styles.rowLink}
        style={{ "--row-accent": row.accent } as CSSProperties}
        data-business-link={row.key}
        onClick={onOpen}
      >
        <span className={styles.rowLogo} aria-hidden="true">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- getImageProps gives the resized sources
            <img {...logo} alt="" decoding="async" />
          ) : (
            [...row.name][0]?.toUpperCase()
          )}
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowName} data-business-name="">
            {row.name}
          </span>
          {row.tagline ? <span className={styles.rowTagline}>{row.tagline}</span> : null}
          <span className={styles.rowMeta}>
            {row.placeName ? (
              <span className={`${styles.rowPlace} ${styles.pinned}`}>{row.placeName}</span>
            ) : null}
            {row.distance ? (
              <span className={`${styles.rowPlace} ${styles.pinned}`} data-distance="">
                {row.distance}
              </span>
            ) : null}
            {row.example ? <ExampleBadge label={labels.example} /> : null}
            {row.glutenFree ? <GlutenFreeBadge label={labels.glutenFree} /> : null}
            {row.byAppointment ? (
              <AppointmentBadge label={labels.byAppointment} />
            ) : (
              <LiveOpenState
                openNow={row.openNow}
                hours={row.hours}
                labels={{ open: labels.openNow, closed: labels.closed }}
              />
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
