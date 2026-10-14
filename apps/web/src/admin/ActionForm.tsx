"use client";

import { useActionState, type ReactNode } from "react";
import { idle, type ActionState } from "./action-state";
import styles from "./admin.module.css";

/** A server-action form that keeps what was typed and announces the outcome (role=alert). */
export function ActionForm({
  action,
  submit,
  labels,
  children,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  submit: string;
  labels: { fix: string };
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  return (
    <form action={formAction} aria-busy={pending} className={styles.card}>
      {children}
      {state.message ? (
        <div role="alert" className={state.ok ? styles.notice : styles.error}>
          <p>{state.message}</p>
          {state.errors.length > 0 ? (
            <>
              <p>{labels.fix}</p>
              <ul>
                {state.errors.map((e) => (
                  <li key={e}>
                    <bdi>{e}</bdi>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={pending}>
          {submit}
        </button>
      </div>
    </form>
  );
}
