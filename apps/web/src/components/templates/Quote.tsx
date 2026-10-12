import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Quote({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <ol className={styles.steps}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="">
            <span className={styles.number} aria-hidden="true">
              {i + 1}
            </span>
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ol>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
