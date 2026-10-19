"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { AdminIcon } from "./AdminIcon";
import { idle, type ActionState } from "./action-state";
import { snapshot } from "./editor-state";
import { toast } from "./toast";
import styles from "./editor.module.css";

export interface EditorLabels {
  save: string;
  saved: string;
  unsaved: string;
  allSaved: string;
  discard: string;
  discardConfirm: string;
  leaveConfirm: string;
  fix: string;
  sections: string;
  edit: string;
  preview: string;
  shortcut: string;
}

/**
 * The frame every editor shares: a sticky list of sections that follows the scroll, the form,
 * an optional live preview beside it (a tab on phones), and a save bar that says when something
 * changed. Ctrl+S or Cmd+S saves; leaving with unsaved changes asks first.
 */
export function EditorShell({
  id,
  action,
  sections,
  labels,
  submit,
  preview,
  after,
  children,
}: {
  id: string;
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  sections: { id: string; label: string }[];
  labels: EditorLabels;
  /** The button's word ("Save", "Create"). */
  submit: string;
  preview?: ReactNode;
  /** Sections after the form (they hold forms of their own, which cannot nest). */
  after?: ReactNode;
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const base = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // A save that worked is the new starting point; a refused one marks what to fix.
  const run = async (prev: ActionState, fd: FormData) => {
    const next = await action(prev, fd);
    const el = form.current;
    if (next.ok) {
      if (el) base.current = snapshot(el);
      setDirty(false);
      if (next.message) toast(next.message);
    } else markInvalid(el, next.errors);
    return next;
  };
  const [state, formAction, pending] = useActionState(run, idle);
  const [current, setCurrent] = useState(sections[0]?.id ?? "");
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  // What was loaded; every change compares against it (typing back the old value is not a change).
  useEffect(() => {
    const el = form.current;
    if (!el) return;
    // Widgets fill their hidden inputs after their first render.
    const start = requestAnimationFrame(() => (base.current = snapshot(el)));
    const check = () => {
      if (base.current !== null) setDirty(snapshot(el) !== base.current);
    };
    el.addEventListener("input", check);
    el.addEventListener("change", check);
    // Hidden inputs (map pin, hours, photos) change without events; their value attribute moves.
    const observer = new MutationObserver(check);
    observer.observe(el, { subtree: true, attributes: true, attributeFilter: ["value"] });
    return () => {
      cancelAnimationFrame(start);
      el.removeEventListener("input", check);
      el.removeEventListener("change", check);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        form.current?.requestSubmit();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
    };
    // In-app links leave without unloading: ask there too.
    const onClick = (e: MouseEvent) => {
      if (!dirty || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement).closest("a[href]");
      if (!a || a.getAttribute("target") === "_blank" || form.current?.contains(a)) return;
      if (!window.confirm(labels.leaveConfirm)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, labels.leaveConfirm]);

  // The section in view lights up in the list.
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  const errors = !state.ok && state.message ? state.errors : [];
  return (
    <div className={styles.editor} data-has-preview={preview ? "" : undefined} data-tab={tab}>
      {preview ? (
        <div className={styles.viewTabs} role="group" aria-label={labels.preview}>
          <button type="button" aria-pressed={tab === "edit"} onClick={() => setTab("edit")}>
            <AdminIcon name="edit" size={16} />
            {labels.edit}
          </button>
          <button
            type="button"
            aria-pressed={tab === "preview"}
            onClick={() => setTab("preview")}
            data-preview-tab=""
          >
            <AdminIcon name="image" size={16} />
            {labels.preview}
          </button>
        </div>
      ) : null}
      <nav className={styles.sectionNav} aria-label={labels.sections}>
        <ul role="list">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={current === s.id ? "true" : undefined}
                onClick={() => setCurrent(s.id)}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.column}>
        <form
          id={id}
          ref={form}
          action={formAction}
          aria-busy={pending}
          className={styles.form}
          noValidate
        >
          {children}
          <div className={styles.saveBar} data-dirty={dirty ? "" : undefined} data-save-bar="">
            <div className={styles.saveState}>
              {!state.ok && state.message ? (
                <div role="alert" className={styles.saveError}>
                  <p>
                    <AdminIcon name="alert" size={16} /> {state.message}
                  </p>
                  {errors.length ? (
                    <>
                      <p className={styles.srOnly}>{labels.fix}</p>
                      <ul>
                        {errors.map((e) => (
                          <li key={e}>
                            <bdi>{e}</bdi>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : (
                <p role="status" className={styles.saveStatus}>
                  <span className={styles.saveDot} aria-hidden="true" />
                  {dirty
                    ? labels.unsaved
                    : state.ok && state.message
                      ? labels.saved
                      : labels.allSaved}
                </p>
              )}
            </div>
            {dirty ? (
              <button
                type="button"
                className={styles.discard}
                onClick={() => {
                  if (window.confirm(labels.discardConfirm)) {
                    setDirty(false);
                    window.location.reload();
                  }
                }}
              >
                {labels.discard}
              </button>
            ) : null}
            <button
              type="submit"
              className={styles.save}
              disabled={pending}
              aria-keyshortcuts="Control+S Meta+S"
              title={labels.shortcut}
            >
              {submit}
            </button>
          </div>
        </form>
        {after}
      </div>
      {preview ? (
        <aside className={styles.preview} aria-label={labels.preview}>
          {preview}
        </aside>
      ) : null}
    </div>
  );
}

/**
 * Marks the fields the save refused (errors read "name.en: Required" or "location: …") and moves
 * focus to the first, so the admin lands on what to fix.
 */
function markInvalid(form: HTMLFormElement | null, errors: string[]) {
  if (!form) return;
  form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  let first: HTMLElement | null = null;
  for (const e of errors) {
    const path = /^([\w.]+):/.exec(e)?.[1];
    if (!path) continue;
    const head = path.split(".")[0]!;
    const field =
      form.querySelector<HTMLElement>(`[name="${CSS.escape(path)}"]:not([type="hidden"])`) ??
      form.querySelector<HTMLElement>(`[name^="${CSS.escape(head)}"]:not([type="hidden"])`) ??
      form.querySelector<HTMLElement>(`[data-field="${CSS.escape(head)}"]`);
    if (!field) continue;
    field.setAttribute("aria-invalid", "true");
    first ??= field;
  }
  first?.focus({ preventScroll: false });
  first?.scrollIntoView({ block: "center" });
}
