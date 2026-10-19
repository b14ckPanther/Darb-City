"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { AdminIcon } from "./AdminIcon";
import { listHref, type ListState } from "./list-params";
import styles from "./list.module.css";

export interface FilterOption {
  value: string;
  label: string;
  /** A colour swatch or a count beside the label. */
  swatch?: string;
  note?: string;
}

export interface ListFilter {
  /** The URL key ("status", "kind"). */
  name: string;
  label: string;
  options: FilterOption[];
  /** A box to narrow long lists (kinds, places); `remote` asks the server as you type. */
  searchable?: boolean;
  remote?: (q: string) => Promise<FilterOption[]>;
  /** The chosen value's label when it is not among `options` (a place found remotely). */
  chosenLabel?: string;
}

export interface ToolbarLabels {
  search: string;
  placeholder: string;
  clear: string;
  clearAll: string;
  any: string;
  narrow: string;
  noMatch: string;
  remove: string;
}

/**
 * The list's toolbar: search as you type (the URL follows, so a list is shareable and reloadable),
 * a chip per filter that opens a small menu, and the active filters as chips that remove themselves.
 * Every option is a plain link: it works without JavaScript and opens in a new tab.
 */
export function ListToolbar({
  base,
  state,
  filters,
  labels,
  qKey = "q",
}: {
  base: string;
  state: ListState;
  filters: ListFilter[];
  labels: ToolbarLabels;
  qKey?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(state[qKey] ?? "");
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchId = useId();

  const push = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      start(() =>
        router.replace(listHref(base, state, { [qKey]: value.trim() || undefined }), {
          scroll: false,
        }),
      );
    }, 300);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const active = filters.filter((f) => state[f.name]);
  return (
    <div className={styles.toolbar} data-pending={pending ? "" : undefined} data-list-toolbar="">
      <form
        role="search"
        className={styles.search}
        action={base}
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          start(() => router.replace(listHref(base, state, { [qKey]: q.trim() || undefined })));
        }}
      >
        <label htmlFor={searchId} className={styles.srOnly}>
          {labels.search}
        </label>
        <AdminIcon name="search" size={18} />
        <input
          id={searchId}
          type="search"
          name={qKey}
          value={q}
          placeholder={labels.placeholder}
          dir="auto"
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            setQ(e.target.value);
            push(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && q) {
              e.preventDefault();
              setQ("");
              push("");
            }
          }}
          data-list-search=""
        />
        {/* Kept so the plain form still filters without JavaScript. */}
        {Object.entries(state).map(([k, v]) =>
          k !== qKey && k !== "page" && v ? (
            <input key={k} type="hidden" name={k} value={v} />
          ) : null,
        )}
        {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
      </form>
      <div className={styles.chips}>
        {filters.map((f) => (
          <FilterChip
            key={f.name}
            filter={f}
            value={state[f.name]}
            open={open === f.name}
            onOpen={(on) => setOpen(on ? f.name : null)}
            href={(value) => listHref(base, state, { [f.name]: value })}
            labels={labels}
          />
        ))}
        {active.length > 1 ? (
          <Link
            href={listHref(base, state, Object.fromEntries(active.map((f) => [f.name, undefined])))}
            className={styles.clearAll}
          >
            {labels.clearAll}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({
  filter,
  value,
  open,
  onOpen,
  href,
  labels,
}: {
  filter: ListFilter;
  value: string | undefined;
  open: boolean;
  onOpen: (open: boolean) => void;
  href: (value: string | undefined) => string;
  labels: ToolbarLabels;
}) {
  const [narrow, setNarrow] = useState("");
  const [remote, setRemote] = useState<{ q: string; options: FilterOption[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const chosen =
    filter.options.find((o) => o.value === value)?.label ?? filter.chosenLabel ?? value;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpen]);

  useEffect(() => {
    const ask = filter.remote;
    const q = narrow.trim();
    if (!ask || !open || q.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const options = await ask(q).catch(() => []);
      if (live) setRemote({ q, options });
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [narrow, open, filter.remote]);

  const needle = narrow.trim().toLocaleLowerCase();
  const options =
    filter.remote && needle.length >= 2 && remote?.q === narrow.trim()
      ? remote.options
      : needle
        ? filter.options.filter((o) => o.label.toLocaleLowerCase().includes(needle))
        : filter.options;

  return (
    <div className={styles.chipBox} ref={box}>
      {value ? (
        <span className={styles.chipOn}>
          <button
            ref={button}
            type="button"
            className={styles.chipMain}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => onOpen(!open)}
            data-filter={filter.name}
          >
            <span className={styles.chipLabel}>{filter.label}:</span> <bdi>{chosen}</bdi>
          </button>
          <Link
            href={href(undefined)}
            className={styles.chipX}
            aria-label={`${labels.remove}: ${filter.label}`}
            data-filter-clear={filter.name}
          >
            <AdminIcon name="close" size={14} />
          </Link>
        </span>
      ) : (
        <button
          ref={button}
          type="button"
          className={styles.chip}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => onOpen(!open)}
          data-filter={filter.name}
        >
          {filter.label}
          <AdminIcon name="chevronDown" size={14} />
        </button>
      )}
      {open ? (
        <div id={menuId} className={styles.menu} role="group" aria-label={filter.label}>
          {filter.searchable || filter.remote ? (
            <input
              className={styles.menuSearch}
              type="search"
              value={narrow}
              onChange={(e) => setNarrow(e.target.value)}
              placeholder={labels.narrow}
              aria-label={`${labels.narrow}: ${filter.label}`}
              dir="auto"
              autoFocus
            />
          ) : null}
          <ul role="list" className={styles.menuList}>
            {value ? (
              <li>
                <Link
                  href={href(undefined)}
                  className={styles.menuItem}
                  onClick={() => onOpen(false)}
                >
                  {labels.any}
                </Link>
              </li>
            ) : null}
            {options.length === 0 ? <li className={styles.menuEmpty}>{labels.noMatch}</li> : null}
            {options.map((o) => (
              <li key={o.value}>
                <Link
                  href={href(o.value)}
                  className={styles.menuItem}
                  aria-current={o.value === value ? "true" : undefined}
                  onClick={() => onOpen(false)}
                  data-option={o.value}
                >
                  {o.swatch ? (
                    <span className={styles.swatch} style={{ background: o.swatch }} />
                  ) : null}
                  <bdi className={styles.menuText}>{o.label}</bdi>
                  {o.note ? <span className={styles.menuNote}>{o.note}</span> : null}
                  {o.value === value ? <AdminIcon name="check" size={16} /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
