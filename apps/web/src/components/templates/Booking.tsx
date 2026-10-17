import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Booking({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} variant="slot" />
      <ul className={styles.cards}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="" data-match-keys={itemKeys(item)} className={styles.card}>
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
