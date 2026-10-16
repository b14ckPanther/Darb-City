import { isByAppointment, type Hours, type Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { hasHours, hoursRows } from "@/lib/format";
import { Icon } from "./icons/Icon";
import styles from "./card/Card.module.css";

const DAY = 24 * 60;
const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/**
 * Each day's open spans on a 24 hour bar (0 to 1440 minutes); a shift past midnight ends its own
 * day's bar and starts the next day's.
 */
export function weekSpans(hours: Pick<Hours, "weekly">): [number, number][][] {
  const days: [number, number][][] = Array.from({ length: 7 }, () => []);
  for (let day = 0; day < 7; day++) {
    for (const { open, close } of hours.weekly[day as keyof Hours["weekly"]] ?? []) {
      const o = minutes(open);
      const c = minutes(close);
      if (c > o) days[day]!.push([o, c]);
      else {
        days[day]!.push([o, DAY]);
        if (c > 0) days[(day + 1) % 7]!.push([0, c]);
      }
    }
  }
  return days.map((spans) => spans.sort((a, b) => a[0] - b[0]));
}

/**
 * The week at a glance: a row a day, its open hours drawn on a bar from midnight to midnight
 * (split shifts as separate pieces), today lit, closed days quiet. Still a table, so screen
 * readers read day and hours; the bars are drawing only.
 */
export function HoursTable({
  locale,
  hours,
  todayLabel,
  at,
}: {
  locale: Locale;
  hours: Hours;
  /** "Today", said to screen readers beside today's name. */
  todayLabel: string;
  /** Which day is today; the clock by default (tests fix it). */
  at?: Date;
}) {
  const title = (
    <h3 id="hours-title" className="visually-hidden">
      {t(locale, "hours")}
    </h3>
  );
  if (isByAppointment(hours))
    return (
      <section aria-labelledby="hours-title" className={styles.week}>
        {title}
        <p className={styles.quiet} data-appointment-hours="">
          <Icon name="calendar" size={20} />
          {t(locale, "byAppointment")}
        </p>
      </section>
    );
  if (!hasHours(hours))
    return (
      <section aria-labelledby="hours-title" className={styles.week}>
        {title}
        <p className={styles.quiet}>
          <Icon name="clock" size={20} />
          {t(locale, "hoursUnknown")}
        </p>
      </section>
    );
  const spans = weekSpans(hours);
  return (
    <section aria-labelledby="hours-title" className={styles.week}>
      {title}
      <table className={styles.hours} aria-labelledby="hours-title">
        <thead className={styles.axis} aria-hidden="true">
          <tr>
            <td />
            <td>
              <span className={styles.scale}>
                {["00", "06", "12", "18", "24"].map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </span>
            </td>
          </tr>
        </thead>
        <tbody>
          {hoursRows(hours, locale, at).map((row) => (
            <tr
              key={row.day}
              data-today={row.today ? "" : undefined}
              data-closed={row.closed ? "" : undefined}
            >
              <th scope="row">
                {row.name}
                {row.today ? <span className="visually-hidden"> ({todayLabel})</span> : null}
              </th>
              <td>
                <span className={styles.dayLine}>
                  <span className={styles.bar} aria-hidden="true">
                    {spans[row.day]!.map(([s, e]) => (
                      <span
                        key={s}
                        className={styles.span}
                        style={{
                          insetInlineStart: `${(s / DAY) * 100}%`,
                          inlineSize: `${((e - s) / DAY) * 100}%`,
                        }}
                      />
                    ))}
                  </span>
                  <span className={styles.times}>
                    {row.closed
                      ? row.text
                      : row.text.split(", ").map((shift) => (
                          <span key={shift} dir="ltr">
                            {shift}
                          </span>
                        ))}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
