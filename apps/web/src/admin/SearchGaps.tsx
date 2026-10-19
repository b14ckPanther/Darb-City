"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Locale } from "@darb/core";
import { AdminIcon } from "./AdminIcon";
import { addSearchWord } from "./gap-actions";
import { toast } from "./toast";
import styles from "./admin.module.css";
import o from "./overview.module.css";

/**
 * Searches that found no kind, each with two ways to close the gap: make a new kind named after
 * it, or teach an existing kind the word (it is added to that kind's words, and search learns it).
 */
export function SearchGaps({
  locale,
  terms,
  kinds,
  labels,
  newKindHref,
}: {
  locale: Locale;
  terms: { term: string; count: number }[];
  kinds: { id: string; name: string }[];
  labels: {
    term: string;
    count: string;
    empty: string;
    createKind: string;
    addWord: string;
    chooseKind: string;
    add: string;
    added: string;
    failed: string;
    cancel: string;
  };
  newKindHref: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const n = new Intl.NumberFormat(locale === "ar" ? "ar-IL-u-nu-latn" : `${locale}-IL`);
  if (terms.length === 0) return <p className={styles.muted}>{labels.empty}</p>;
  return (
    <ul className={o.gaps} role="list">
      {terms.map((r) => {
        const isOpen = open === r.term;
        const id = `gap-${r.term.replace(/\s+/g, "-")}`;
        return (
          <li key={r.term} className={o.gap} data-gap={r.term}>
            <div className={o.gapMain}>
              <bdi className={o.gapTerm}>{r.term}</bdi>
              <span className={`${o.gapCount} ${styles.num}`}>
                {n.format(r.count)} <span className={styles.srOnly}>{labels.count}</span>
              </span>
              {done.has(r.term) ? (
                <span className={styles.status} data-status="active">
                  {labels.added}
                </span>
              ) : (
                <span className={o.gapActions}>
                  <Link
                    href={`${newKindHref}?name=${encodeURIComponent(r.term)}`}
                    className={`${styles.ghost} ${styles.sm}`}
                  >
                    <AdminIcon name="plus" size={16} />
                    {labels.createKind}
                  </Link>
                  <button
                    type="button"
                    className={`${styles.quiet} ${styles.sm}`}
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(isOpen ? null : r.term)}
                  >
                    <AdminIcon name="tag" size={16} />
                    {labels.addWord}
                  </button>
                </span>
              )}
            </div>
            {isOpen ? (
              <form
                id={id}
                className={o.gapForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const kindId = String(new FormData(e.currentTarget).get("kind") ?? "");
                  start(async () => {
                    const ok = await addSearchWord(kindId, r.term);
                    toast(ok ? labels.added : labels.failed, ok ? "ok" : "error");
                    if (ok) {
                      setDone((d) => new Set(d).add(r.term));
                      setOpen(null);
                    }
                  });
                }}
              >
                <label className={styles.field}>
                  <span>{labels.chooseKind}</span>
                  <select name="kind" required defaultValue="">
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
                <button
                  type="submit"
                  className={`${styles.primary} ${styles.sm}`}
                  disabled={pending}
                >
                  {labels.add}
                </button>
                <button
                  type="button"
                  className={`${styles.quiet} ${styles.sm}`}
                  onClick={() => setOpen(null)}
                >
                  {labels.cancel}
                </button>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
