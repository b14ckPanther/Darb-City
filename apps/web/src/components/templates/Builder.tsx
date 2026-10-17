import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Builder({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} />
      <ul className={styles.options}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="" data-match-keys={itemKeys(item)}>
            <span
              className={styles.check}
              aria-hidden="true"
              data-checked={i === 0 ? "" : undefined}
            />
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
