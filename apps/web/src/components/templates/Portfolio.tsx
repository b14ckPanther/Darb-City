import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Portfolio({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <ul className={styles.gallery}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="">
            <span className={styles.frame} aria-hidden="true" />
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
