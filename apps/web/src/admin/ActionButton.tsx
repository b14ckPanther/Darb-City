"use client";

import { useActionState, type ReactNode } from "react";
import { idle, type ActionState } from "./action-state";
import styles from "./admin.module.css";

/**
 * One button that runs a server action (publish, suspend, delete, return to seed). A refusal or an
 * unreachable API is announced in an alert next to it, never swallowed.
 */
export function ActionButton({
  action,
  fields,
  label,
  className,
  children,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  className?: string;
  /** Shown after the button, e.g. a hint. */
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  return (
    <form action={formAction} aria-busy={pending} className={styles.actions}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={className} disabled={pending}>
        {label}
      </button>
      {children}
      {!state.ok && state.message ? (
        <div role="alert" className={styles.error}>
          <p>{state.message}</p>
          {state.errors.length > 0 ? (
            <ul>
              {state.errors.map((e) => (
                <li key={e}>
                  <bdi>{e}</bdi>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
