import { Glyph } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Pass.module.css";

/** A decorative code pattern, the same for the same brand. */
function codeCells(seed: string): boolean[] {
  let x = 7;
  for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: 49 }, (_, i) => ((x >>> (i % 29)) ^ (i * 2654435761)) % 3 === 0);
}

/**
 * A place you go in to (a gym, a hummus place, a car park, a tour), read like its ticket: a stub
 * with the place's glyph, a perforated fold with notches, the title and each item as a field of
 * the ticket on security print, a thin foil edge, and its code.
 */
export function Pass({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "ticket");
  const entries = entriesOf(screen, locale);
  return (
    <div className={styles.wrap} data-motif={motif}>
      <div className={styles.ticket}>
        <div className={styles.stub} aria-hidden="true">
          <Glyph name={motif} className={styles.stubGlyph} />
          <span className={styles.code}>
            {codeCells(text(screen.brand, "en")).map((on, i) => (
              <span key={i} data-on={on ? "" : undefined} />
            ))}
          </span>
        </div>
        <div className={styles.main}>
          <p className={styles.title}>{text(screen.title, locale)}</p>
          {screen.subtitle ? (
            <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
          ) : null}
          <ul className={styles.fields}>
            {entries.map(({ item, glyph, facts }, i) => (
              <li
                key={i}
                data-item=""
                data-match-keys={itemKeys(item)}
                data-bare={facts.length === 0 ? "" : undefined}
              >
                <span className={styles.fieldLabel}>
                  <Mark name={glyph} className={styles.fieldGlyph} />
                  {text(item.label, locale)}
                </span>
                <Facts facts={facts} className={styles.fieldValue} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
