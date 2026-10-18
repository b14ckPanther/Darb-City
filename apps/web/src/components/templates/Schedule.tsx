import { Fragment, type CSSProperties } from "react";
import type { Fact } from "./facts";
import { Glyph } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Schedule.module.css";

/** Times and numbers go to the board's clock column; the words stay with the name. */
const onClock = (f: Fact) => f.kind === "time" || f.kind === "number" || f.kind === "duration";

/**
 * A place that runs on times (a kindergarten, a mosque, a pool, a bus station), read like a
 * departure board: the title on split flaps, days as a strip, and each item a board row with its
 * glyph and its time in flap digits. The flaps turn over once when the screen opens.
 */
export function Schedule({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "clock");
  const entries = entriesOf(screen, locale);
  const words = text(screen.title, locale).split(/\s+/).filter(Boolean);
  return (
    <div className={styles.board} data-motif={motif}>
      <header className={styles.head}>
        <span className={styles.lamp}>
          <Glyph name={motif} className={styles.lampGlyph} />
        </span>
        <p className={styles.title}>
          {words.map((w, i) => (
            <Fragment key={i}>
              {i > 0 ? " " : null}
              <span className={styles.flap} style={{ "--i": i } as CSSProperties}>
                {w}
              </span>
            </Fragment>
          ))}
        </p>
        {screen.subtitle ? (
          <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
        ) : null}
      </header>
      <Tags screen={screen} locale={locale} variant="slot" className={styles.days} />
      <ol className={styles.rows}>
        {entries.map(({ item, glyph, facts }, i) => {
          const clock = facts.filter(onClock);
          const rest = facts.filter((f) => !onClock(f));
          return (
            <li
              key={i}
              data-item=""
              data-match-keys={itemKeys(item)}
              style={{ "--i": i } as CSSProperties}
            >
              <span className={styles.badge}>
                <Mark name={glyph} className={styles.badgeGlyph} />
              </span>
              <span className={styles.what}>
                <span className={styles.name}>{text(item.label, locale)}</span>
                <Facts facts={rest} className={styles.note} />
              </span>
              {clock.length > 0 ? <Facts facts={clock} className={styles.clock} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
