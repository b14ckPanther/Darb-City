"use client";

import { useActionState, useEffect, useId } from "react";
import { idle, type ActionState } from "./action-state";
import { LIMIT_CHOICES, type LimitChoice } from "./helper-view";
import { toast } from "./toast";
import styles from "./admin.module.css";
import h from "./helpers.module.css";


/**
 * A helper's cap a day as three pressed-or-not buttons: one press saves it (audited by the API),
 * a toast says so, and a refusal shows next to it.
 */
export function LimitPicker({
  action,
  id,
  locale,
  current,
  labels,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  id: string;
  locale: string;
  current: LimitChoice;
  labels: { group: string; hint: string; none: string; saved: string };
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  const hint = useId();
  useEffect(() => {
    if (state.ok) toast(labels.saved);
  }, [state, labels.saved]);
  return (
    <form action={formAction} aria-busy={pending} className={h.limit} data-limit={current}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <div role="group" aria-label={labels.group} aria-describedby={hint} className={h.limitRow}>
        <span className={h.limitLabel} aria-hidden="true">
          {labels.group}
        </span>
        <span className={h.segmented}>
          {LIMIT_CHOICES.map((c) => (
            <button
              key={c}
              type="submit"
              name="limit"
              value={c}
              aria-pressed={c === current}
              disabled={pending}
              onClick={(e) => {
                if (c === current) e.preventDefault();
              }}
            >
              {c === "none" ? labels.none : c}
            </button>
          ))}
        </span>
      </div>
      <p id={hint} className={h.limitHint}>
        {labels.hint}
      </p>
      {!state.ok && state.message ? (
        <div role="alert" className={styles.error}>
          <p>{state.message}</p>
        </div>
      ) : null}
    </form>
  );
}
