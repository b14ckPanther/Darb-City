"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AdminIcon } from "./AdminIcon";
import type { AdminKey } from "./copy";
import { filterStatic, step, type PaletteHit } from "./palette";
import { paletteSearch } from "./palette-actions";
import styles from "./shell.module.css";

export interface PaletteLabels {
  title: string;
  placeholder: string;
  empty: string;
  searching: string;
  error: string;
  keys: string;
  close: string;
  groups: Partial<Record<AdminKey, string>>;
}

/**
 * ⌘K: one box that goes anywhere. Screens and quick actions answer at once; businesses, places,
 * kinds and categories come from the API as you type (debounced). A combobox over a listbox:
 * arrows move, Enter opens, Esc closes, and the dialog gives focus back where it came from.
 */
export default function CommandPalette({
  locale,
  statics,
  labels,
  onClose,
}: {
  locale: string;
  statics: PaletteHit[];
  labels: PaletteLabels;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    input.current?.focus();
  }, []);

  // The last answer and the words it answers; an answer to older words is never shown.
  const [answer, setAnswer] = useState<{ q: string; hits: PaletteHit[] | null }>({
    q: "",
    hits: [],
  });
  const query = q.trim();
  useEffect(() => {
    if (query.length < 2) return;
    let live = true;
    const timer = setTimeout(async () => {
      const hits = await paletteSearch(locale, query);
      if (live) setAnswer({ q: query, hits });
    }, 160);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, locale]);
  const fresh = query.length >= 2 && answer.q === query;
  const found = useMemo(() => (fresh ? (answer.hits ?? []) : []), [fresh, answer]);
  const state: "idle" | "busy" | "error" =
    query.length < 2 ? "idle" : !fresh ? "busy" : answer.hits ? "idle" : "error";

  const hits = useMemo(() => [...filterStatic(statics, q), ...found], [statics, q, found]);
  const current = Math.min(active, Math.max(0, hits.length - 1));

  const go = (hit: PaletteHit | undefined) => {
    if (!hit) return;
    onClose();
    router.push(hit.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive(step(current, hits.length, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[current]);
    } else if (e.key === "Home" && e.ctrlKey) setActive(0);
  };

  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current, listId]);

  // Grouped for reading, one flat index for the keyboard.
  const groups: { key: AdminKey; items: { hit: PaletteHit; index: number }[] }[] = [];
  hits.forEach((hit, index) => {
    const g = groups.find((x) => x.key === hit.group);
    if (g) g.items.push({ hit, index });
    else groups.push({ key: hit.group, items: [{ hit, index }] });
  });

  return (
    <dialog
      ref={dialog}
      className={styles.palette}
      aria-label={labels.title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className={styles.paletteBox}>
        <div className={styles.paletteInput}>
          <AdminIcon name="search" />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={listId}
            aria-activedescendant={hits.length ? `${listId}-${current}` : undefined}
            aria-autocomplete="list"
            aria-label={labels.title}
            placeholder={labels.placeholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            dir="auto"
            autoComplete="off"
            spellCheck={false}
            data-palette-input=""
          />
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => dialog.current?.close()}
            aria-label={labels.close}
          >
            <AdminIcon name="close" />
          </button>
        </div>
        <div id={listId} role="listbox" aria-label={labels.title} className={styles.paletteList}>
          {groups.map((g) => (
            <div key={g.key} role="group" aria-label={labels.groups[g.key] ?? g.key}>
              <div className={styles.paletteGroup} aria-hidden="true">
                {labels.groups[g.key] ?? g.key}
              </div>
              {g.items.map(({ hit, index }) => (
                <div
                  key={hit.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === current}
                  className={styles.paletteOption}
                  onMouseMove={() => setActive(index)}
                  onClick={() => go(hit)}
                  data-palette-option={hit.id}
                >
                  <span className={styles.paletteGlyph} aria-hidden="true">
                    {hit.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hit.thumb} alt="" width={28} height={28} />
                    ) : hit.swatch ? (
                      <span className={styles.swatch} style={{ background: hit.swatch }} />
                    ) : (
                      <AdminIcon name={hit.icon} size={18} />
                    )}
                  </span>
                  <span className={styles.paletteText}>
                    <bdi>{hit.label}</bdi>
                    {hit.sub ? <small>{hit.sub}</small> : null}
                  </span>
                  {hit.status ? <span className={styles.dot} data-status={hit.status} /> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className={styles.paletteFoot} role="status">
          {state === "busy"
            ? labels.searching
            : state === "error"
              ? labels.error
              : q.trim() && hits.length === 0
                ? labels.empty.replace("{q}", q.trim())
                : labels.keys}
        </p>
      </div>
    </dialog>
  );
}
