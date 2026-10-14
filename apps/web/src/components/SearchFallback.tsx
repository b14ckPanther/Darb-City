"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@darb/core";
import { instantOptions, loadPrepared } from "@/search/engine";
import type { SearchLabels, SearchOption } from "@/search/types";
import list from "./List.module.css";

/** Spec §7: the API is down, so lane 1 (places and kinds, in the browser) answers, with a retry. */
export function SearchFallback({
  locale,
  q,
  labels,
}: {
  locale: Locale;
  q: string;
  labels: SearchLabels & { notice: string; retry: string };
}) {
  const [options, setOptions] = useState<SearchOption[]>([]);
  useEffect(() => {
    let live = true;
    loadPrepared().then(
      (p) => {
        if (live)
          setOptions(instantOptions(p, q, locale, labels).filter((o) => o.group !== "search"));
      },
      () => undefined, // the notice and the retry link still stand
    );
    return () => {
      live = false;
    };
  }, [q, locale, labels]);
  return (
    <section data-search-fallback="">
      <p role="status">{labels.notice}</p>
      <p>
        <a className="button-link" href="">
          {labels.retry}
        </a>
      </p>
      <ul className={list.list}>
        {options.map((o) => (
          <li key={o.id} className={list.row}>
            <Link href={o.href} className={list.rowLink}>
              <span className={list.rowName}>{o.label}</span>
              {o.sublabel ? <span className={list.rowTagline}>{o.sublabel}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
