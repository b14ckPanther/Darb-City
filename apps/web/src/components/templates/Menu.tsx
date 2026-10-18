import { factOf } from "./facts";
import { Glyph } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Menu.module.css";

/**
 * A place to eat, read like its own board: a menu card by day, a chalkboard at night. Its emblem
 * comes from what it serves (a café's cup, a bakery's loaf, a grill's skewer), the first dish is
 * plated large, priced dishes are set as menu lines and bare ones as a tray of icon tiles. A meta
 * without a price never draws a price column.
 */
export function Menu({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "plate");
  const [first, ...rest] = entriesOf(screen, locale);
  const priced = rest.filter((e) => factOf(e.facts, "price"));
  const bare = rest.filter((e) => !factOf(e.facts, "price"));
  const featuredPrice = first ? factOf(first.facts, "price") : undefined;
  return (
    <div className={styles.board} data-motif={motif}>
      <header className={styles.head}>
        <span className={styles.emblem}>
          <Glyph name={motif} className={styles.emblemGlyph} />
          {motif === "cup" ? <span className={styles.steam} aria-hidden="true" /> : null}
        </span>
        <p className={styles.title}>{text(screen.title, locale)}</p>
        {screen.subtitle ? (
          <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
        ) : null}
      </header>

      {first ? (
        <div className={styles.featured} data-item="" data-match-keys={itemKeys(first.item)}>
          <span className={styles.plate} aria-hidden="true">
            <Mark name={first.glyph ?? motif} className={styles.plateGlyph} />
          </span>
          <span className={styles.featuredText}>
            <span className={styles.featuredName}>{text(first.item.label, locale)}</span>
            {featuredPrice ? <span className={styles.bigPrice}>{featuredPrice.text}</span> : null}
            <Facts facts={first.facts} skip={featuredPrice} className={styles.note} />
          </span>
        </div>
      ) : null}

      {priced.length > 0 ? (
        <ul className={styles.lines}>
          {priced.map(({ item, facts }, i) => {
            const price = factOf(facts, "price");
            return (
              <li key={i} data-item="" data-match-keys={itemKeys(item)}>
                <span className={styles.lineName}>{text(item.label, locale)}</span>
                <span className={styles.leader} aria-hidden="true" />
                <span className={styles.linePrice}>{price?.text}</span>
                <Facts facts={facts} skip={price} className={styles.lineNote} />
              </li>
            );
          })}
        </ul>
      ) : null}

      {bare.length > 0 ? (
        <ul className={styles.tray}>
          {bare.map(({ item, glyph, facts }, i) => (
            <li key={i} data-item="" data-match-keys={itemKeys(item)}>
              <span className={styles.badge}>
                <Mark name={glyph} className={styles.badgeGlyph} />
              </span>
              <span className={styles.trayText}>
                <span className={styles.trayName}>{text(item.label, locale)}</span>
                <Facts facts={facts} className={styles.note} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <Tags screen={screen} locale={locale} className={styles.amenities} />
    </div>
  );
}
