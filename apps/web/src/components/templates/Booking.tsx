import { factOf } from "./facts";
import { Glyph } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Booking.module.css";

/**
 * A place you book (a barber, a clinic, a court), read like its appointment book: a ruled diary
 * page under binder rings, a bookmark in the business's colour carrying what it does, open slots
 * as time chips with the first one picked, and each service written in as an entry with its
 * stamp, its price and how long it takes.
 */
export function Booking({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "calendar");
  const entries = entriesOf(screen, locale);
  return (
    <div className={styles.book} data-motif={motif}>
      <span className={styles.rings} aria-hidden="true" />
      <header className={styles.head}>
        <span className={styles.bookmark} aria-hidden="true">
          <Glyph name={motif} className={styles.bookmarkGlyph} />
        </span>
        <p className={styles.title}>{text(screen.title, locale)}</p>
        {screen.subtitle ? (
          <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
        ) : null}
      </header>
      <Tags screen={screen} locale={locale} variant="slot" className={styles.slots} />
      <ol className={styles.entries}>
        {entries.map(({ item, glyph, facts }, i) => {
          const price = factOf(facts, "price");
          return (
            <li key={i} data-item="" data-match-keys={itemKeys(item)}>
              <span className={styles.stamp}>
                <Mark name={glyph} className={styles.stampGlyph} />
              </span>
              <span className={styles.entry}>
                <span className={styles.name}>{text(item.label, locale)}</span>
                <Facts facts={facts} skip={price} className={styles.facts} />
              </span>
              {price ? <span className={styles.price}>{price.text}</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
