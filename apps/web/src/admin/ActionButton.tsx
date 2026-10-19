"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { idle, type ActionState } from "./action-state";
import { toast } from "./toast";
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
  confirm,
  done,
  icon,
  children,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  /** Asked first (destructive actions); the action runs only on yes. */
  confirm?: string;
  /** Said in a toast once it worked. */
  done?: string;
  icon?: ReactNode;
  className?: string;
  /** Shown after the button, e.g. a hint. */
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  useEffect(() => {
    if (state.ok && done) toast(done);
  }, [state, done]);
  return (
    <form action={formAction} aria-busy={pending} className={styles.actions}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className={className}
        disabled={pending}
        onClick={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        {icon}
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
