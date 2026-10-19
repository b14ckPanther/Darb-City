import type { Locale, Localized } from "@darb/core";
import { at } from "./copy";
import styles from "./admin.module.css";

export function TextField(p: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  hint?: string;
  dir?: "ltr" | "rtl" | "auto";
  required?: boolean;
  step?: string;
}) {
  const hintId = p.hint ? `${p.name}-hint` : undefined;
  return (
    <label className={styles.field}>
      <span>{p.label}</span>
      <input
        name={p.name}
        type={p.type ?? "text"}
        defaultValue={p.defaultValue ?? ""}
        dir={p.dir}
        required={p.required}
        step={p.step}
        aria-describedby={hintId}
      />
      {p.hint ? (
        <small id={hintId} className={styles.hint}>
          {p.hint}
        </small>
      ) : null}
    </label>
  );
}

export function TextArea(p: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  dir?: "ltr" | "rtl" | "auto";
  rows?: number;
}) {
  const hintId = p.hint ? `${p.name}-hint` : undefined;
  return (
    <label className={styles.field}>
      <span>{p.label}</span>
      <textarea
        name={p.name}
        defaultValue={p.defaultValue ?? ""}
        dir={p.dir}
        rows={p.rows ?? 4}
        aria-describedby={hintId}
      />
      {p.hint ? (
        <small id={hintId} className={styles.hint}>
          {p.hint}
        </small>
      ) : null}
    </label>
  );
}

export function SelectField(p: {
  label: string;
  name: string;
  defaultValue?: string;
  options: [string, string][];
  allowEmpty?: string;
}) {
  // Named by its label text alone: a wrapping label would also read out the selected option.
  const labelId = `${p.name}-label`;
  return (
    <label className={styles.field}>
      <span id={labelId}>{p.label}</span>
      <select name={p.name} defaultValue={p.defaultValue ?? ""} aria-labelledby={labelId}>
        {p.allowEmpty !== undefined ? <option value="">{p.allowEmpty}</option> : null}
        {p.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * One input per alphabet, each in its own direction, so Arabic and Hebrew type naturally. The
 * label shows the alphabet; screen readers hear the field's name with it ("Name · A B C").
 */
export function LocalizedFields({
  locale,
  label,
  name,
  value = {},
}: {
  locale: Locale;
  label: string;
  name: string;
  value?: Localized;
}) {
  const langs = [
    ["he", "langHe", "rtl"],
    ["ar", "langAr", "rtl"],
    ["en", "langEn", "ltr"],
  ] as const;
  return (
    <fieldset className={styles.fieldset}>
      <legend>{label}</legend>
      <div className={styles.localized}>
        {langs.map(([l, key, dir]) => (
          <label key={l} className={styles.field}>
            <span className={styles.alphabet}>
              <span className={styles.srOnly}>{label} · </span>
              {at(locale, key)}
            </span>
            <input name={`${name}.${l}`} defaultValue={value[l] ?? ""} dir={dir} lang={l} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
