import type { CSSProperties } from "react";
import { factOf } from "./facts";
import { Glyph } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Builder.module.css";

/**
 * A business you put an order together with (a caterer, a butcher, a florist, an optician), read
 * like a builder: the options stack up as layers in the header, one per item, topped with the
 * business's glyph, and each option is a card with a switch, the first one on.
 */
export function Builder({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "box");
  const entries = entriesOf(screen, locale);
  const layers = Math.max(2, Math.min(entries.length, 4));
  return (
    <div className={styles.builder} data-motif={motif}>
      <header className={styles.head}>
        <span className={styles.stack} aria-hidden="true">
          {Array.from({ length: layers }, (_, i) => (
            <span key={i} className={styles.layer} style={{ "--l": i } as CSSProperties} />
          ))}
          <span className={styles.top}>
            <Glyph name={motif} className={styles.topGlyph} />
          </span>
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{text(screen.title, locale)}</p>
          {screen.subtitle ? (
            <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
          ) : null}
        </div>
      </header>
      <ul className={styles.options}>
        {entries.map(({ item, glyph, facts }, i) => {
          const price = factOf(facts, "price");
          return (
            <li
              key={i}
              data-item=""
              data-match-keys={itemKeys(item)}
              data-on={i === 0 ? "" : undefined}
            >
              <span className={styles.badge}>
                <Mark name={glyph} className={styles.badgeGlyph} />
              </span>
              <span className={styles.what}>
                <span className={styles.name}>{text(item.label, locale)}</span>
                <Facts facts={facts} skip={price} className={styles.note} />
              </span>
              {price ? <span className={styles.price}>{price.text}</span> : null}
              <span className={styles.switch} aria-hidden="true" />
            </li>
          );
        })}
      </ul>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
