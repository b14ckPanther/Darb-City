"use client";

import { useId } from "react";
import type { JoinCopy } from "@/content/join";
import { copyToAll, presetWeek, type Preset, type Week } from "@/lib/week-hours";
import styles from "./Join.module.css";

const PRESETS: Preset[] = ["sunThu", "everyDay", "allDay"];

/**
 * A plain week: each day open or closed, one "from" and one "to". Quick fills set the whole week;
 * a day's own button copies it to every day. Produces the contracts' Hours (weekToHours).
 */
export function WeekHours({
  week,
  onChange,
  copy,
  invalid,
  errorId,
}: {
  week: Week;
  onChange: (week: Week) => void;
  copy: JoinCopy["hours"];
  invalid: boolean;
  errorId: string;
}) {
  const id = useId();
  const set = (day: number, patch: Partial<Week[number]>) =>
    onChange(week.map((d, i) => (i === day ? { ...d, ...patch } : d)));
  return (
    <div className={styles.week}>
      <div className={styles.presets} role="group" aria-label={copy.presets}>
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={styles.chip}
            onClick={() => onChange(presetWeek(p))}
          >
            {copy[p]}
          </button>
        ))}
      </div>
      <ul className={styles.days}>
        {week.map((d, i) => {
          const day = copy.days[i]!;
          return (
            <li key={day} className={styles.day} data-open={d.open || undefined}>
              <label className={styles.dayName}>
                <input
                  type="checkbox"
                  checked={d.open}
                  onChange={(e) => set(i, { open: e.target.checked })}
                  aria-describedby={invalid ? errorId : undefined}
                />
                <span>{day}</span>
              </label>
              {d.open ? (
                <div className={styles.times}>
                  <label htmlFor={`${id}-${i}-from`} className={styles.srOnly}>
                    {`${day}, ${copy.from}`}
                  </label>
                  <input
                    id={`${id}-${i}-from`}
                    type="time"
                    value={d.from}
                    dir="ltr"
                    onChange={(e) => set(i, { from: e.target.value })}
                    aria-invalid={invalid && !d.from ? true : undefined}
                  />
                  <span aria-hidden="true">{copy.to}</span>
                  <label htmlFor={`${id}-${i}-to`} className={styles.srOnly}>
                    {`${day}, ${copy.to}`}
                  </label>
                  <input
                    id={`${id}-${i}-to`}
                    type="time"
                    value={d.to === "24:00" ? "23:59" : d.to}
                    dir="ltr"
                    onChange={(e) =>
                      set(i, { to: e.target.value === "23:59" ? "24:00" : e.target.value })
                    }
                    aria-invalid={invalid && !d.to ? true : undefined}
                  />
                  <button
                    type="button"
                    className={styles.copyAll}
                    onClick={() => onChange(copyToAll(week, i))}
                  >
                    {copy.copyAll}
                    <span className={styles.srOnly}>{` (${day})`}</span>
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
