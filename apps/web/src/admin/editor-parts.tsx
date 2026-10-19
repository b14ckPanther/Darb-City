import type { ReactNode } from "react";
import { AdminIcon } from "./AdminIcon";
import styles from "./editor.module.css";
import admin from "./admin.module.css";

/** One part of an editor: a titled panel the section list jumps to. */
export function Section({
  id,
  title,
  hint,
  aside,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`} data-section={id}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id={`${id}-title`} className={styles.sectionTitle}>
            {title}
          </h2>
          {hint ? <p className={styles.sectionHint}>{hint}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SubHead({ children }: { children: ReactNode }) {
  return <h3 className={styles.sub}>{children}</h3>;
}

/** A row of radio buttons drawn as one control (tier, icon style). Plain inputs: no script. */
export function Segmented({
  legend,
  name,
  value,
  options,
  hint,
}: {
  legend: string;
  name: string;
  value: string;
  options: [string, string][];
  hint?: string;
}) {
  return (
    <fieldset className={`${admin.fieldset} ${admin.field}`}>
      <legend className={admin.label}>{legend}</legend>
      <div className={styles.segmented}>
        {options.map(([v, label]) => (
          <label key={v}>
            <input type="radio" name={name} value={v} defaultChecked={v === value} />
            {label}
          </label>
        ))}
      </div>
      {hint ? <small className={admin.hint}>{hint}</small> : null}
    </fieldset>
  );
}

/** Colour choices as swatches; the first may be "the default" (an empty value). */
export function Swatches({
  legend,
  name,
  value,
  options,
  defaultLabel,
  hint,
}: {
  legend: string;
  name: string;
  value: string;
  options: string[];
  defaultLabel?: string;
  hint?: string;
}) {
  return (
    <fieldset className={`${admin.fieldset} ${admin.field}`}>
      <legend className={admin.label}>{legend}</legend>
      <div className={styles.swatches}>
        {defaultLabel ? (
          <label className={`${styles.swatchChoice} ${styles.swatchDefault}`} title={defaultLabel}>
            <input
              type="radio"
              name={name}
              value=""
              defaultChecked={!value}
              aria-label={defaultLabel}
            />
            <AdminIcon name="check" size={18} />
          </label>
        ) : null}
        {options.map((c) => (
          <label key={c} className={styles.swatchChoice} style={{ background: c }} title={c}>
            <input type="radio" name={name} value={c} defaultChecked={c === value} aria-label={c} />
            <AdminIcon name="check" size={18} />
          </label>
        ))}
      </div>
      {hint ? <small className={admin.hint}>{hint}</small> : null}
    </fieldset>
  );
}

export function Check({
  name,
  label,
  checked,
  hint,
}: {
  name: string;
  label: string;
  checked: boolean;
  hint?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div className={admin.field}>
      <label className={admin.check}>
        <input type="checkbox" name={name} defaultChecked={checked} aria-describedby={hintId} />
        <span>{label}</span>
      </label>
      {hint ? (
        <small id={hintId} className={admin.hint}>
          {hint}
        </small>
      ) : null}
    </div>
  );
}
