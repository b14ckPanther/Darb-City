"use client";

import { useId, useMemo, useRef, useState } from "react";
import { foldText } from "@/lib/fold-text";
import styles from "./Join.module.css";

export interface PickerOption {
  slug: string;
  label: string;
  /** Every name and spelling, folded (foldText), to match what people type. */
  search: string;
}

const SHOWN = 8;

/**
 * A search box over a long list (kinds, towns): type a few letters, pick from at most eight
 * matches. The choice shows in the box; typing again searches again. Arrow keys move through the
 * matches, Enter picks, Escape closes.
 */
export function SearchPicker({
  label,
  placeholder,
  noMatch,
  options,
  value,
  onChange,
  inputId,
  errorId,
  error,
}: {
  label: string;
  placeholder: string;
  noMatch: string;
  options: PickerOption[];
  value: string;
  onChange: (slug: string) => void;
  inputId: string;
  errorId: string;
  error: string | null;
}) {
  const listId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const chosen = options.find((o) => o.slug === value) ?? null;
  const matches = useMemo(() => {
    if (query === null) return [];
    const q = foldText(query);
    const hits = q ? options.filter((o) => o.search.includes(q)) : options;
    // Names that start with the letters first.
    return [...hits]
      .sort((a, b) => Number(!a.search.startsWith(q)) - Number(!b.search.startsWith(q)))
      .slice(0, SHOWN);
  }, [query, options]);
  const open = query !== null && query.trim() !== "";
  const pick = (o: PickerOption) => {
    onChange(o.slug);
    setQuery(null);
    input.current?.focus();
  };
  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={input}
        id={inputId}
        type="search"
        role="combobox"
        autoComplete="off"
        dir="auto"
        placeholder={placeholder}
        value={query ?? chosen?.label ?? ""}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, matches.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && matches[active]) pick(matches[active]);
          else if (e.key === "Escape") setQuery(null);
          else return;
          e.preventDefault();
        }}
        onBlur={(e) => {
          // A tap on a match blurs the box first; the match's own click still lands.
          if (!e.relatedTarget?.closest(`#${CSS.escape(listId)}`)) setQuery(null);
        }}
      />
      <ul id={listId} role="listbox" aria-label={label} className={styles.options} hidden={!open}>
        {matches.map((o, i) => (
          <li
            key={o.slug}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            tabIndex={-1}
            className={styles.option}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(o)}
          >
            {o.label}
          </li>
        ))}
        {open && matches.length === 0 ? (
          <li role="presentation" className={styles.noMatch}>
            {noMatch}
          </li>
        ) : null}
      </ul>
      {error ? (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
