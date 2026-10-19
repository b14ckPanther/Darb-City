"use client";

import { useId, useState } from "react";
import { AdminIcon } from "./AdminIcon";
import styles from "./editor.module.css";
import admin from "./admin.module.css";

export interface KindOption {
  id: string;
  slug: string;
  name: string;
  sector: string;
}

/** Kinds grouped under their categories, for a native select (searchable by typing, accessible). */
function grouped(kinds: KindOption[]) {
  const groups = new Map<string, KindOption[]>();
  for (const k of kinds) groups.set(k.sector, [...(groups.get(k.sector) ?? []), k]);
  return [...groups.entries()];
}

/**
 * The business's kind and the kinds it is also listed under. The main kind is a select grouped
 * by category; the others are chips with a remove button, added from a second select. The form
 * gets `primaryKindId` and `kinds` (one slug per line), as before.
 */
export function KindPicker({
  kinds,
  primary,
  extra: initialExtra,
  labels,
}: {
  kinds: KindOption[];
  primary: string;
  extra: string[];
  labels: { kind: string; also: string; add: string; remove: string; none: string };
}) {
  const [main, setMain] = useState(primary);
  const [extra, setExtra] = useState(initialExtra);
  const id = useId();
  const bySlug = new Map(kinds.map((k) => [k.slug, k]));
  const mainSlug = kinds.find((k) => k.id === main)?.slug;
  const groups = grouped(kinds);
  return (
    <div className={admin.row}>
      <label className={admin.field}>
        <span id={`${id}-kind`}>{labels.kind}</span>
        <select
          name="primaryKindId"
          value={main}
          onChange={(e) => setMain(e.target.value)}
          aria-labelledby={`${id}-kind`}
          required
        >
          {main ? null : <option value="">{labels.none}</option>}
          {groups.map(([sector, list]) => (
            <optgroup key={sector} label={sector}>
              {list.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className={admin.field} data-field="kinds">
        <span id={`${id}-also`} className={admin.label}>
          {labels.also}
        </span>
        <input type="hidden" name="kinds" value={extra.join("\n")} />
        {extra.length ? (
          <ul className={styles.chips} role="list" aria-labelledby={`${id}-also`}>
            {extra.map((slug) => (
              <li key={slug} className={styles.kindChip}>
                <bdi>{bySlug.get(slug)?.name ?? slug}</bdi>
                <button
                  type="button"
                  aria-label={`${labels.remove}: ${bySlug.get(slug)?.name ?? slug}`}
                  onClick={() => setExtra((x) => x.filter((s) => s !== slug))}
                >
                  <AdminIcon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <select
          value=""
          aria-label={labels.add}
          onChange={(e) => {
            const slug = e.target.value;
            if (slug && !extra.includes(slug)) setExtra((x) => [...x, slug]);
          }}
          data-add-kind=""
        >
          <option value="">{labels.add}</option>
          {groups.map(([sector, list]) => (
            <optgroup key={sector} label={sector}>
              {list
                .filter((k) => k.slug !== mainSlug && !extra.includes(k.slug))
                .map((k) => (
                  <option key={k.id} value={k.slug}>
                    {k.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
