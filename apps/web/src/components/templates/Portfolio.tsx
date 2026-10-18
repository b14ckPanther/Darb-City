import type { CSSProperties } from "react";
import { Glyph } from "./glyphs";
import { entriesOf, Facts, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Portfolio.module.css";

/**
 * Someone who makes things (an artist, a photographer, a sign maker), read like a gallery wall:
 * the first work hangs large in a frame with a mat under a spotlight, the others in a salon hang,
 * each with a museum label. The works themselves are drawn from what the maker does (an aperture
 * for a photographer, a brush for a painter), never passed off as real photos.
 */
export function Portfolio({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "palette");
  const entries = entriesOf(screen, locale);
  return (
    <div className={styles.wall} data-motif={motif}>
      <header className={styles.head}>
        <p className={styles.title}>{text(screen.title, locale)}</p>
        {screen.subtitle ? (
          <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
        ) : null}
      </header>
      <ul className={styles.hang} data-count={Math.min(entries.length, 3)}>
        {entries.map(({ item, glyph, facts }, i) => (
          <li
            key={i}
            data-item=""
            data-match-keys={itemKeys(item)}
            style={{ "--i": i } as CSSProperties}
          >
            <span className={styles.frame} aria-hidden="true">
              <span className={styles.canvas} data-art={i % 4}>
                <Glyph name={i === 0 ? motif : (glyph ?? motif)} className={styles.artGlyph} />
              </span>
            </span>
            <span className={styles.label}>
              <span className={styles.name}>{text(item.label, locale)}</span>
              <Facts facts={facts} className={styles.facts} />
            </span>
          </li>
        ))}
      </ul>
      <Tags screen={screen} locale={locale} className={styles.amenities} />
    </div>
  );
}
