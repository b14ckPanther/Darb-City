import type { CSSProperties } from "react";
import { factOf } from "./facts";
import { Glyph } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Donate.module.css";

/**
 * A cause you give to (a nonprofit, a waqf), read like a ripple: a heart with rings spreading out
 * from it, the amounts as coins, a real percentage (when the meta has one) as a filling bar, and
 * each way to give with its glyph. Nothing is counted that the business did not write.
 */
export function Donate({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "heart");
  const entries = entriesOf(screen, locale);
  const progress = entries.find((e) => factOf(e.facts, "percent"));
  const ways = entries.filter((e) => e !== progress);
  const percent = progress ? factOf(progress.facts, "percent") : undefined;
  return (
    <div className={styles.give} data-motif={motif}>
      <header className={styles.head}>
        <span className={styles.heart}>
          <span className={styles.rings} aria-hidden="true" />
          <Glyph name={motif} className={styles.heartGlyph} />
        </span>
        <p className={styles.title}>{text(screen.title, locale)}</p>
        {screen.subtitle ? (
          <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
        ) : null}
      </header>
      {progress && percent ? (
        <div
          className={styles.progress}
          data-item=""
          data-match-keys={itemKeys(progress.item)}
          style={{ "--p": `${percent.value ?? 0}%` } as CSSProperties}
        >
          <span className={styles.progressName}>{text(progress.item.label, locale)}</span>
          <span className={styles.bar} aria-hidden="true">
            <span className={styles.fill} />
          </span>
          <Facts facts={progress.facts} className={styles.progressFacts} />
        </div>
      ) : null}
      <Tags screen={screen} locale={locale} variant="amount" className={styles.coins} />
      {ways.length > 0 ? (
        <ul className={styles.ways}>
          {ways.map(({ item, glyph, facts }, i) => (
            <li key={i} data-item="" data-match-keys={itemKeys(item)}>
              <span className={styles.badge}>
                <Mark name={glyph} className={styles.badgeGlyph} />
              </span>
              <span className={styles.what}>
                <span className={styles.name}>{text(item.label, locale)}</span>
                <Facts facts={facts} className={styles.note} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
