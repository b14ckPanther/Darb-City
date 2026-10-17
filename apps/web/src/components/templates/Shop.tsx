import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Shop({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} />
      <ul className={styles.grid}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="" data-match-keys={itemKeys(item)} className={styles.tile}>
            <span className={styles.swatch} aria-hidden="true" />
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
