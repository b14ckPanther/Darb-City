import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

/** A decorative code pattern, the same for the same brand. */
function codeCells(seed: string): boolean[] {
  let x = 7;
  for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: 49 }, (_, i) => ((x >>> (i % 29)) ^ (i * 2654435761)) % 3 === 0);
}

export function Pass({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <div className={styles.pass}>
        <dl className={styles.fields}>
          {screen.items.map((item, i) => (
            <div key={i} data-item="">
              <dt>{text(item.label, locale)}</dt>
              <dd>{text(item.meta, locale)}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.code} aria-hidden="true">
          {codeCells(text(screen.brand, "en")).map((on, i) => (
            <span key={i} data-on={on ? "" : undefined} />
          ))}
        </div>
      </div>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
