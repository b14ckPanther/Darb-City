"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Hours } from "@darb/core";
import { dayPlan } from "@/lib/day-plan";
import styles from "./Today.module.css";

export interface TodayLabels {
  /** Templates with {time}, filled here as the clock moves. */
  openUntil: string;
  opensAt: string;
  opensTomorrow: string;
  closedToday: string;
  openAllDay: string;
  today: string;
}

/**
 * The time, to the minute: the server's render time on the first paint (so hydration matches),
 * then the browser's clock, moving on every minute (as LiveOpenState does for list rows).
 */
function useMinute(renderedAt: number): number {
  const [now, setNow] = useState(renderedAt);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
/** A close at midnight reads as 00:00, as shop doors say it. */
const clock = (time: string) => (time === "24:00" ? "00:00" : time);

/**
 * Today at a glance: a 24 hour dial (midnight at the top, clockwise) with today's open spans in the
 * accent and a dot at this minute, and words beside it ("Open until 22:00"). The dial is CSS (a
 * conic gradient), so this island stays small. Computed in the
 * browser from the hours, so a page cached yesterday still tells today's truth.
 */
export function TodayState({
  hours,
  renderedAt,
  labels,
}: {
  hours: Hours;
  /** The server's clock when the page rendered: the first paint matches it, then the browser's. */
  renderedAt: number;
  labels: TodayLabels;
}) {
  const now = useMinute(renderedAt);
  const plan = dayPlan(hours, new Date(now));
  const fill = (template: string, time: string) => template.replace("{time}", clock(time));
  const words = plan.open
    ? plan.closesAt
      ? fill(labels.openUntil, plan.closesAt)
      : labels.openAllDay
    : plan.opensAt?.day === "today"
      ? fill(labels.opensAt, plan.opensAt.time)
      : plan.spans.length === 0 && plan.opensAt
        ? `${labels.closedToday} · ${fill(labels.opensTomorrow, plan.opensAt.time)}`
        : plan.opensAt
          ? fill(labels.opensTomorrow, plan.opensAt.time)
          : labels.closedToday;
  const allDay = plan.spans.some(([s, e]) => s === 0 && e === 24 * 60);
  // A minute is a quarter of a degree: the open spans as a ring, the hand at this minute.
  const ring = `conic-gradient(${plan.spans
    .map(([s, e]) => `transparent 0 ${s / 4}deg, var(--card-accent) 0 ${e / 4}deg`)
    .join()}, transparent 0)`;
  return (
    <div className={styles.today} data-open={plan.open ? "true" : "false"} data-today-state="">
      <span
        className={styles.dial}
        style={{ "--ring": ring, "--now": `${plan.minutes / 4}deg` } as CSSProperties}
        aria-hidden="true"
      >
        <span className={styles.hand} />
      </span>
      <p className={styles.todayText}>
        <strong className={styles.todayWords}>{words}</strong>
        {plan.spans.length && !allDay ? (
          <span className={styles.todaySpans}>
            {labels.today}{" "}
            <span dir="ltr">{plan.spans.map(([s, e]) => `${hhmm(s)}-${hhmm(e)}`).join(", ")}</span>
          </span>
        ) : null}
      </p>
    </div>
  );
}
