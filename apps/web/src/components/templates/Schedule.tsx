import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Schedule({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} variant="slot" />
      <ol className={styles.timeline}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="" data-match-keys={itemKeys(item)}>
            <span className={styles.when}>{text(item.meta, locale)}</span>
            <span className={styles.strong}>{text(item.label, locale)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
