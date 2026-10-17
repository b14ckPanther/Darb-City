import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Menu({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} />
      <ul className={styles.menu}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="" data-match-keys={itemKeys(item)}>
            <span>{text(item.label, locale)}</span>
            <span className={styles.leader} aria-hidden="true" />
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
