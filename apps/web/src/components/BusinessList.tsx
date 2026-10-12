import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import type { BusinessRowData } from "@/lib/rows";
import { BusinessRow, type RowLabels } from "./BusinessRow";
import styles from "./List.module.css";

export function rowLabels(locale: Locale): RowLabels {
  return {
    example: t(locale, "example"),
    openNow: t(locale, "openNow"),
    closed: t(locale, "closed"),
  };
}

export function BusinessList({ locale, rows }: { locale: Locale; rows: BusinessRowData[] }) {
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
    </section>
  );
}
