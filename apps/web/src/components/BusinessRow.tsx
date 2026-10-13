import Link from "next/link";
import type { BusinessRowData } from "@/lib/rows";
import { ExampleBadge } from "./Badges";
import { LiveOpenState } from "./LiveOpenState";
import styles from "./List.module.css";

export interface RowLabels {
  example: string;
  openNow: string;
  closed: string;
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
  return (
    <li className={styles.row} data-business={row.key}>
      <Link
        href={row.href}
        scroll={false}
        className={styles.rowLink}
        data-business-link={row.key}
        onClick={onOpen}
      >
        <span className={styles.rowName} data-business-name="">
          {row.name}
        </span>
        {row.tagline ? <span className={styles.rowTagline}>{row.tagline}</span> : null}
        <span className={styles.rowMeta}>
          {row.placeName ? <span className={styles.rowPlace}>{row.placeName}</span> : null}
          {row.distance ? (
            <span className={styles.rowPlace} data-distance="">
              {row.distance}
            </span>
          ) : null}
          {row.example ? <ExampleBadge label={labels.example} /> : null}
          <LiveOpenState
            openNow={row.openNow}
            hours={row.hours}
            labels={{ open: labels.openNow, closed: labels.closed }}
          />
        </span>
      </Link>
    </li>
  );
}
