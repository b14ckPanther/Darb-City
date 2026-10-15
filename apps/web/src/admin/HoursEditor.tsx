"use client";

import { useState } from "react";
import type { Weekly } from "./hours-form";
import styles from "./admin.module.css";

const DAYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
type Day = (typeof DAYS)[number];

/** Weekly hours in Asia/Jerusalem; an interval may cross midnight (close earlier than open). */
export function HoursEditor({
  weekly,
  labels,
}: {
  weekly: Weekly;
  labels: {
    days: string[];
    closed: string;
    add: string;
    remove: string;
    open: string;
    close: string;
  };
}) {
  const [week, setWeek] = useState<Record<Day, { open: string; close: string }[]>>(
    () =>
      Object.fromEntries(DAYS.map((d) => [d, [...(weekly[d] ?? [])]])) as Record<
        Day,
        { open: string; close: string }[]
      >,
  );
  const update = (day: Day, list: { open: string; close: string }[]) =>
    setWeek((w) => ({ ...w, [day]: list }));
  return (
    <fieldset className={styles.card} style={{ display: "grid", gap: 8 }}>
      <input type="hidden" name="hours.weekly" value={JSON.stringify(week)} />
      {DAYS.map((day, d) => {
        const name = labels.days[d]!;
        return (
          <div key={day} className={styles.actions} style={{ margin: 0 }}>
            <strong style={{ minInlineSize: 96 }}>{name}</strong>
            {week[day].length === 0 ? <span className={styles.hint}>{labels.closed}</span> : null}
            {week[day].map((iv, i) => (
              <span key={i} className={styles.actions} style={{ margin: 0 }}>
                <input
                  type="time"
                  dir="ltr"
                  aria-label={`${name} · ${labels.open} ${i + 1}`}
                  value={iv.open}
                  onChange={(e) =>
                    update(
                      day,
                      week[day].map((x, j) => (j === i ? { ...x, open: e.target.value } : x)),
                    )
                  }
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  dir="ltr"
                  aria-label={`${name} · ${labels.close} ${i + 1}`}
                  value={iv.close}
                  onChange={(e) =>
                    update(
                      day,
                      week[day].map((x, j) => (j === i ? { ...x, close: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  className={styles.ghost}
                  aria-label={`${name} · ${labels.remove} ${i + 1}`}
                  onClick={() =>
                    update(
                      day,
                      week[day].filter((_, j) => j !== i),
                    )
                  }
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              className={styles.ghost}
              onClick={() => update(day, [...week[day], { open: "09:00", close: "17:00" }])}
            >
              {labels.add}
            </button>
          </div>
        );
      })}
    </fieldset>
  );
}
