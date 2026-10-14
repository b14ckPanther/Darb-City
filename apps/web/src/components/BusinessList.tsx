import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import type { BusinessRowData } from "@/lib/rows";
import { BusinessRow, type RowLabels } from "./BusinessRow";
import styles from "./List.module.css";
import { ShowMore } from "./ShowMore";

export function rowLabels(locale: Locale): RowLabels {
  return {
    example: t(locale, "example"),
    openNow: t(locale, "openNow"),
    closed: t(locale, "closed"),
    glutenFree: t(locale, "glutenFree"),
    byAppointment: t(locale, "byAppointment"),
  };
}

export interface MoreQuery {
  place: string;
  kind: string;
  cursor: string;
}

export function BusinessList({
  locale,
  rows,
  more,
}: {
  locale: Locale;
  rows: BusinessRowData[];
  more: MoreQuery | null;
}) {
  const labels = rowLabels(locale);
  return (
    <section aria-labelledby="businesses-title">
      <h2 id="businesses-title" className="visually-hidden">
        {t(locale, "businesses")}
      </h2>
      <ul className={styles.list} data-business-list="">
        {rows.map((row) => (
          <BusinessRow key={row.key} row={row} labels={labels} />
        ))}
      </ul>
      {more ? (
        <ShowMore
          locale={locale}
          {...more}
          labels={{ showMore: t(locale, "showMore"), unreachable: t(locale, "unreachable") }}
          rowLabels={labels}
        />
      ) : null}
    </section>
  );
}
