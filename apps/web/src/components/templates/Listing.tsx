import { Glyph } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Listing.module.css";

/**
 * A place you look up (a school, a hotel, a bank branch, a hall), read like its fact sheet: what
 * it is as a row of headline levels (Primary, Middle school, High school), then each labelled fact
 * on a spec plate, a code or number set like a registration plate, a price or distance large.
 */
export function Listing({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "doc");
  const entries = entriesOf(screen, locale);
  const levels = entries.filter((e) => e.facts.length === 0);
  const specs = entries.filter((e) => e.facts.length > 0);
  return (
    <div className={styles.sheet} data-motif={motif}>
      <header className={styles.head}>
        <span className={styles.emblem}>
          <Glyph name={motif} className={styles.emblemGlyph} />
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{text(screen.title, locale)}</p>
          {screen.subtitle ? (
            <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
          ) : null}
        </div>
      </header>
      {levels.length > 0 ? (
        <ul className={styles.levels}>
          {levels.map(({ item, glyph }, i) => (
            <li key={i} data-item="" data-match-keys={itemKeys(item)}>
              <Mark name={glyph} className={styles.levelGlyph} />
              <span>{text(item.label, locale)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {specs.length > 0 ? (
        <dl className={styles.specs}>
          {specs.map(({ item, glyph, facts }, i) => {
            const code = facts.length === 1 && facts[0]!.kind === "number";
            return (
              <div
                key={i}
                data-item=""
                data-match-keys={itemKeys(item)}
                data-code={code ? "" : undefined}
              >
                <dt>
                  <Mark name={glyph} className={styles.specGlyph} />
                  {text(item.label, locale)}
                </dt>
                <dd>
                  <Facts facts={facts} className={code ? styles.plate : styles.value} />
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
