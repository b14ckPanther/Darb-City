import { isByAppointment, type Locale } from "@darb/core";
import type { BusinessDetailDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { hasHours, hoursRows } from "@/lib/format";
import styles from "./Experience.module.css";

export function HoursTable({
  locale,
  hours,
}: {
  locale: Locale;
  hours: BusinessDetailDto["hours"];
}) {
  return (
    <section aria-labelledby="hours-title" className={styles.section}>
      <h3 id="hours-title" className={styles.sectionTitle}>
        {t(locale, "hours")}
      </h3>
      {isByAppointment(hours) ? (
        <p className={styles.muted} data-appointment-hours="">
          {t(locale, "byAppointment")}
        </p>
      ) : hasHours(hours) ? (
        <table className={styles.hours}>
          <tbody>
            {hoursRows(hours, locale).map((row) => (
              <tr key={row.day} data-today={row.today ? "" : undefined}>
                <th scope="row">{row.name}</th>
                <td>{row.closed ? row.text : <span dir="ltr">{row.text}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.muted}>{t(locale, "hoursUnknown")}</p>
      )}
    </section>
  );
}
