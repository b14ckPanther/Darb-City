"use client";

import { useRef, useState } from "react";
import type { Locale } from "@darb/core";
import type { BusinessRowData } from "@/lib/rows";
import { BusinessRow, type RowLabels } from "./BusinessRow";
import styles from "./List.module.css";

export interface ShowMoreProps {
  locale: Locale;
  place: string;
  kind: string;
  cursor: string;
  labels: { showMore: string; unreachable: string };
  rowLabels: RowLabels;
}

export function ShowMore({ locale, place, kind, cursor, labels, rowLabels }: ShowMoreProps) {
  const [rows, setRows] = useState<BusinessRowData[]>([]);
  const [next, setNext] = useState<string | null>(cursor);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const list = useRef<HTMLUListElement>(null);

  async function load() {
    if (!next) return;
    setState("loading");
    const firstNew = rows.length;
    try {
      const res = await fetch(
        `/api/businesses?${new URLSearchParams({ locale, place, kind, cursor: next })}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { rows: BusinessRowData[]; nextCursor: string | null };
      setRows((current) => [...current, ...body.rows]);
      setNext(body.nextCursor);
      setState("idle");
      // Keyboard users continue from the first new row.
      requestAnimationFrame(() =>
        list.current?.querySelectorAll<HTMLAnchorElement>("a")[firstNew]?.focus(),
      );
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <ul ref={list} className={styles.list} hidden={rows.length === 0}>
        {rows.map((row) => (
          <BusinessRow key={row.key} row={row} labels={rowLabels} />
        ))}
      </ul>
      <div className={styles.more}>
        {state === "error" ? <p role="status">{labels.unreachable}</p> : null}
        {next ? (
          <button
            type="button"
            className="button"
            onClick={load}
            disabled={state === "loading"}
            aria-busy={state === "loading"}
            data-show-more=""
          >
            {labels.showMore}
          </button>
        ) : null}
      </div>
    </>
  );
}
