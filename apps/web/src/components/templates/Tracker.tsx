import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Tracker({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <ol className={styles.stepper}>
        {screen.items.map((item, i) => (
          <li
            key={i}
            data-item=""
            data-match-keys={itemKeys(item)}
            data-reached={i === 0 ? "" : undefined}
          >
            <span className={styles.marker} aria-hidden="true" />
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ol>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
