import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Listing({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <dl className={styles.specs}>
        {screen.items.map((item, i) => (
          <div key={i} data-item="" data-match-keys={itemKeys(item)}>
            <dt>{text(item.label, locale)}</dt>
            <dd>{text(item.meta, locale)}</dd>
          </div>
        ))}
      </dl>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
