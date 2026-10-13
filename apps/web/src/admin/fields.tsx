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
  return (
    <label className={styles.field}>
      <span>{p.label}</span>
      <select name={p.name} defaultValue={p.defaultValue ?? ""}>
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

/** One input per language, each in its own direction, so Arabic and Hebrew type naturally. */
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
    <fieldset className={styles.row} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className={styles.hint}>{label}</legend>
      {langs.map(([l, key, dir]) => (
        <TextField
          key={l}
          label={`${label} · ${at(locale, key)}`}
          name={`${name}.${l}`}
          defaultValue={value[l]}
          dir={dir}
        />
      ))}
    </fieldset>
  );
}
