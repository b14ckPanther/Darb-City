import Link from "next/link";
import type { BusinessRowData } from "@/lib/rows";
import { ExampleBadge, OpenState } from "./Badges";
import styles from "./List.module.css";

export interface RowLabels {
  example: string;
  openNow: string;
  closed: string;
}

/** Pure: rendered by the server list and by ShowMore on the client. */
export function BusinessRow({ row, labels }: { row: BusinessRowData; labels: RowLabels }) {
  return (
    <li className={styles.row} data-business={row.key}>
      <Link href={row.href} scroll={false} className={styles.rowLink} data-business-link={row.key}>
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
          <OpenState
            openNow={row.openNow}
            labels={{ open: labels.openNow, closed: labels.closed }}
          />
        </span>
      </Link>
    </li>
  );
}
