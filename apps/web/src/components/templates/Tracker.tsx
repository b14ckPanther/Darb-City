import type { CSSProperties } from "react";
import { factOf, type Fact } from "./facts";
import { Glyph, type GlyphName } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Tracker.module.css";

/** Workshops that look after a vehicle get a dashboard dial in their header. */
const VEHICLE: GlyphName[] = ["engine", "car", "tyre", "brush", "bolt", "snow", "truck", "gear"];

/** A stop's state, only from what its meta says: 100% done, a lower percent in progress. */
function stateOf(percent: Fact | undefined): "done" | "now" | "next" | undefined {
  if (!percent) return undefined;
  if ((percent.value ?? 0) >= 100) return "done";
  return (percent.value ?? 0) > 0 ? "now" : "next";
}

/**
 * A job you follow (a garage, a daycare, a repair lab, a council office), read like a live
 * tracker: a track with a stop per item, each lit with its glyph; a percent in the meta fills its
 * bar and sets the stop done or in progress. A workshop for vehicles shows a dashboard dial.
 */
export function Tracker({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "clipboard");
  const entries = entriesOf(screen, locale);
  const vehicle = VEHICLE.includes(motif);
  return (
    <div className={styles.tracker} data-motif={motif}>
      <header className={styles.head}>
        <span className={vehicle ? styles.dial : styles.pulse} aria-hidden="true">
          {vehicle ? <span className={styles.needle} /> : null}
          <Glyph name={motif} className={styles.headGlyph} />
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{text(screen.title, locale)}</p>
          {screen.subtitle ? (
            <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
          ) : null}
        </div>
      </header>
      <ol className={styles.track}>
        {entries.map(({ item, glyph, facts }, i) => {
          const percent = factOf(facts, "percent");
          return (
            <li
              key={i}
              data-item=""
              data-match-keys={itemKeys(item)}
              data-state={stateOf(percent)}
              style={
                {
                  "--i": i,
                  ...(percent ? { "--p": `${percent.value ?? 0}%` } : {}),
                } as CSSProperties
              }
            >
              <span className={styles.node}>
                <Mark name={glyph} className={styles.nodeGlyph} />
              </span>
              <span className={styles.body}>
                <span className={styles.name}>{text(item.label, locale)}</span>
                <Facts facts={facts} className={styles.facts} />
                {percent ? (
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.fill} />
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
