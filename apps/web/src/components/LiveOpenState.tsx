"use client";

import { useEffect, useState } from "react";
import { isOpenAt, type Hours } from "@darb/core";
import { OpenState } from "./Badges";

/**
 * Cached pages carry the open state of the moment they rendered. The browser recomputes it from
 * the hours (same isOpenAt as the API), so a page cached for a day never shows a stale "Open".
 */
export function LiveOpenState({
  openNow,
  hours,
  labels,
}: {
  openNow: boolean | null;
  hours: Hours | null;
  labels: { open: string; closed: string };
}) {
  const [open, setOpen] = useState(openNow);
  useEffect(() => {
    if (!hours) return;
    const tick = () => setOpen(isOpenAt(hours, new Date()));
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [hours]);
  return <OpenState openNow={open} labels={labels} />;
}
