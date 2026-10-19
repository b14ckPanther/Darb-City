"use client";

import { useState, useSyncExternalStore, type ComponentType } from "react";
import type { Locale } from "@darb/core";
import { hasAdminHint } from "@/admin/marker";
import styles from "./AdminEdit.module.css";

export interface QuickEditorProps {
  locale: Locale;
  id: string;
  onClose: () => void;
}
type Loader = () => Promise<{ default: ComponentType<QuickEditorProps> }>;

const WORD: Record<Locale, string> = { he: "עריכה", ar: "تعديل", en: "Edit" };
const noSubscribe = () => () => {};

/**
 * An Edit button on a business's card, for a browser that has signed in to the admin. The page
 * stays the same static page for everyone: the button appears only after the browser reads its
 * own marker cookie, which grants nothing (every read and save goes through the admin proxy and
 * the API's guard), and the editor's code loads only on the first press.
 */
export function AdminEdit({
  locale,
  id,
  load = () => import("@/admin/quick/QuickEditor"),
}: {
  locale: Locale;
  id: string;
  load?: Loader;
}) {
  const maybeAdmin = useSyncExternalStore(
    noSubscribe,
    () => hasAdminHint(document.cookie),
    () => false,
  );
  const [Editor, setEditor] = useState<ComponentType<QuickEditorProps> | null>(null);
  const [open, setOpen] = useState(false);
  if (!maybeAdmin) return null;
  return (
    <>
      <button
        type="button"
        className={styles.edit}
        onClick={async () => {
          if (!Editor) {
            const mod = await load();
            setEditor(() => mod.default);
          }
          setOpen(true);
        }}
        data-admin-edit=""
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {WORD[locale]}
      </button>
      {open && Editor ? <Editor locale={locale} id={id} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
