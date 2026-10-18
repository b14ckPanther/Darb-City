import { factOf } from "./facts";
import { Glyph } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Quote.module.css";

/**
 * A trade that quotes before it works (a contractor, a technician, a jeweller, a mover), read
 * like its work order: a slip torn off a pad, on blueprint paper, stamped with the trade's
 * glyph, a measuring line under the title, and each item a numbered line with its price set
 * to the end like an estimate.
 */
export function Quote({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "hammer");
  const entries = entriesOf(screen, locale);
  return (
    <div className={styles.order} data-motif={motif}>
      <span className={styles.perforation} aria-hidden="true" />
      <header className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.title}>{text(screen.title, locale)}</p>
          {screen.subtitle ? (
            <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
          ) : null}
        </div>
        <span className={styles.stamp} aria-hidden="true">
          <Glyph name={motif} className={styles.stampGlyph} />
        </span>
      </header>
      <span className={styles.measure} aria-hidden="true" />
      <ol className={styles.lines}>
        {entries.map(({ item, glyph, facts }, i) => {
          const price = factOf(facts, "price");
          return (
            <li key={i} data-item="" data-match-keys={itemKeys(item)}>
              <span className={styles.no} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={styles.box}>
                <Mark name={glyph} className={styles.boxGlyph} />
              </span>
              <span className={styles.what}>
                <span className={styles.name}>{text(item.label, locale)}</span>
                <Facts facts={facts} skip={price} className={styles.note} />
              </span>
              {price ? <span className={styles.price}>{price.text}</span> : null}
            </li>
          );
        })}
      </ol>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
