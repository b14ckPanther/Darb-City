"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { markHelperSeen } from "./actions";
import type { MilestoneView, MomentsView } from "./moment-view";
import { Seal } from "@/components/Seal";
import d from "./delight.module.css";

/** A milestone reached by a send shows once the send stamp (680 ms) is done. */
export const AFTER_STAMP_MS = 760;

export interface MomentsCopy {
  /** The milestone dialog's name for screen readers. */
  label: string;
  go: string;
  see: string;
  close: string;
}

/**
 * The home screen's small moments. A note when some of their additions went live since the last
 * visit (dismissible), and a full screen milestone at 10, 50, 100 and 500 additions, said once and
 * gone with one tap. Opening the app marks the visit seen; a shown milestone is marked at once, so
 * it never comes back. A refresh after sending may bring a new milestone; the note stays as it was.
 */
export function Moments({
  view,
  seeHref,
  copy,
}: {
  view: MomentsView;
  seeHref: string;
  copy: MomentsCopy;
}) {
  const [note, setNote] = useState(view.note);
  const [milestone, setMilestone] = useState<MilestoneView | null>(view.milestone);
  // The highest milestone shown in this visit: a later refresh never says it (or a lower one) again.
  const [said, setSaid] = useState(view.milestone?.count ?? 0);
  const go = useRef<HTMLButtonElement>(null);

  // A refresh after a send can reach a new milestone: it waits for the send stamp to finish.
  const [queued, setQueued] = useState<MilestoneView | null>(null);
  const next = view.milestone;
  if (next && next.count > said) {
    setSaid(next.count);
    setQueued(next);
  }
  useEffect(() => {
    if (!queued) return;
    const later = setTimeout(() => setMilestone(queued), AFTER_STAMP_MS);
    return () => clearTimeout(later);
  }, [queued]);

  const asOf = view.asOf;
  useEffect(() => {
    void markHelperSeen({ asOf });
    // The visit is marked once, as the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = milestone?.count;
  useEffect(() => {
    if (!shown) return;
    void markHelperSeen({ asOf, milestone: shown });
    go.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMilestone(null);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // Marked once per milestone, with the count it was shown with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  return (
    <>
      {note ? (
        <div className={d.note} role="status" data-went-live="">
          <Seal className={d.noteSeal} />
          <p>
            {note} <a href={seeHref}>{copy.see}</a>
          </p>
          <button
            type="button"
            className={d.noteClose}
            aria-label={copy.close}
            onClick={() => setNote(null)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ) : null}
      {milestone ? (
        <div
          className={d.milestone}
          role="dialog"
          aria-modal="true"
          aria-label={copy.label}
          data-milestone={milestone.count}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMilestone(null);
          }}
        >
          <div className={d.milestoneCard}>
            <Seal className={d.milestoneSeal} />
            <p className={d.milestoneHead}>
              <strong
                className={d.count}
                style={{ "--to": milestone.count } as CSSProperties}
                data-count=""
              >
                <span>{milestone.count}</span>
              </strong>
              <span className={d.milestoneUnit}>{milestone.unit}</span>
            </p>
            {milestone.lines.map((line) => (
              <p key={line} className={d.milestoneLine}>
                {line}
              </p>
            ))}
            <button
              ref={go}
              type="button"
              className={d.milestoneGo}
              onClick={() => setMilestone(null)}
            >
              {copy.go}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
