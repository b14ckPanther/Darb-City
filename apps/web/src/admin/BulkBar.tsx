"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { AdminIcon, type AdminIconName } from "./AdminIcon";
import { bulkBusinesses } from "./list-actions";
import { toast } from "./toast";
import styles from "./list.module.css";
import admin from "./admin.module.css";

type Action = "publish" | "draft" | "suspend" | "kind";

export interface BulkLabels {
  selected: string;
  selectAll: string;
  clear: string;
  publish: string;
  draft: string;
  suspend: string;
  kind: string;
  confirmTitle: Record<Action, string>;
  confirmBody: Record<Action, string>;
  chooseKind: string;
  confirm: string;
  cancel: string;
}

/**
 * Rows carry a checkbox (name="pick"); this watches them, keeps the page's "all" box honest, and
 * raises a bar with the safe changes. Each change asks first, then says what happened.
 */
export function BulkBar({
  locale,
  labels,
  kinds,
  children,
}: {
  locale: string;
  labels: BulkLabels;
  kinds: { id: string; name: string }[];
  children: ReactNode;
}) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [action, setAction] = useState<Action | null>(null);
  const [kindId, setKindId] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const boxes = () => [...el.querySelectorAll<HTMLInputElement>('input[name="pick"]')];
    const sync = () => {
      const all = boxes();
      const picked = all.filter((b) => b.checked);
      for (const b of all) b.closest("tr")?.toggleAttribute("data-selected", b.checked);
      const head = el.querySelector<HTMLInputElement>('input[name="pick-all"]');
      if (head) {
        head.checked = all.length > 0 && picked.length === all.length;
        head.indeterminate = picked.length > 0 && picked.length < all.length;
      }
      setIds(picked.map((b) => b.value));
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.name === "pick-all") for (const b of boxes()) b.checked = t.checked;
      if (t.name === "pick" || t.name === "pick-all") sync();
    };
    el.addEventListener("change", onChange);
    sync();
    return () => el.removeEventListener("change", onChange);
  }, [children]);

  const clear = () => {
    root.current
      ?.querySelectorAll<HTMLInputElement>('input[name="pick"], input[name="pick-all"]')
      .forEach((b) => {
        b.checked = false;
        b.indeterminate = false;
        b.closest("tr")?.removeAttribute("data-selected");
      });
    setIds([]);
  };

  const ask = (a: Action) => {
    setAction(a);
    dialog.current?.showModal();
  };
  const run = () => {
    if (!action) return;
    start(async () => {
      const r = await bulkBusinesses(locale, ids, action, kindId || undefined);
      dialog.current?.close();
      toast(r.message, r.ok ? "ok" : "error");
      clear();
      router.refresh();
    });
  };
  const button = (a: Action, icon: AdminIconName, tone?: "gold") => (
    <button
      type="button"
      className={styles.bulkButton}
      data-tone={tone}
      onClick={() => ask(a)}
      data-bulk={a}
    >
      <AdminIcon name={icon} size={16} />
      {labels[a]}
    </button>
  );
  const count = labels.selected.replace("{count}", String(ids.length));

  return (
    <div ref={root}>
      {children}
      {ids.length > 0 ? (
        <div className={styles.bulk} role="region" aria-label={count} data-bulk-bar="">
          <span className={styles.bulkCount} aria-live="polite">
            {count}
          </span>
          {button("publish", "check", "gold")}
          {button("draft", "undo")}
          {button("suspend", "alert")}
          {button("kind", "tag")}
          <button type="button" className={styles.bulkButton} onClick={clear}>
            <AdminIcon name="close" size={16} />
            {labels.clear}
          </button>
        </div>
      ) : null}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="bulk-title"
        onClose={() => setAction(null)}
      >
        {action ? (
          <form
            method="dialog"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <h2 id="bulk-title">
              {labels.confirmTitle[action].replace("{count}", String(ids.length))}
            </h2>
            <p>{labels.confirmBody[action]}</p>
            {action === "kind" ? (
              <label className={admin.field}>
                <span>{labels.chooseKind}</span>
                <select required value={kindId} onChange={(e) => setKindId(e.target.value)}>
                  <option value="" disabled>
                    {labels.chooseKind}
                  </option>
                  {kinds.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className={styles.dialogActions}>
              <button type="button" className={admin.ghost} onClick={() => dialog.current?.close()}>
                {labels.cancel}
              </button>
              <button
                type="submit"
                className={action === "suspend" ? admin.danger : admin.primary}
                disabled={pending}
                data-bulk-confirm=""
              >
                {labels.confirm}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </div>
  );
}
