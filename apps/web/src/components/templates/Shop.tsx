import type { CSSProperties } from "react";
import { factOf } from "./facts";
import { Glyph } from "./glyphs";
import { entriesOf, Facts, Mark, motifOf, type Entry } from "./kit";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Shop.module.css";

/** "Chain: Rami Levy" is the shop's banner, not a product: it gets a round sticker. */
const isChain = (e: Entry) => /^chain$/i.test(e.item.label.en?.trim() ?? "");

/**
 * A shop, read like its shelf: what it sells hangs from a rail as swing tags, the first one
 * large, each with its glyph and, when there is one, its price as the tag's headline. A chain's
 * name is a round sticker on the shelf. Tags settle on their strings when the screen opens.
 */
export function Shop({ screen, locale }: TemplateProps) {
  const motif = motifOf(screen, "tag");
  const entries = entriesOf(screen, locale);
  const chain = entries.find(isChain);
  const tags = entries.filter((e) => e !== chain);
  return (
    <div className={styles.shop} data-motif={motif}>
      <header className={styles.head}>
        <span className={styles.sign}>
          <Glyph name={motif} className={styles.signGlyph} />
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{text(screen.title, locale)}</p>
          {screen.subtitle ? (
            <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
          ) : null}
        </div>
        {chain ? (
          <p className={styles.sticker} data-item="" data-match-keys={itemKeys(chain.item)}>
            <span className={styles.stickerLabel}>{text(chain.item.label, locale)}</span>
            <Facts facts={chain.facts} className={styles.stickerName} />
          </p>
        ) : null}
      </header>
      {tags.length > 0 ? (
        <div className={styles.shelf}>
          <span className={styles.rail} aria-hidden="true" />
          <ul className={styles.tags} data-count={Math.min(tags.length, 4)}>
            {tags.map(({ item, glyph, facts }, i) => {
              const price = factOf(facts, "price");
              return (
                <li
                  key={i}
                  data-item=""
                  data-match-keys={itemKeys(item)}
                  style={{ "--i": i } as CSSProperties}
                >
                  <span className={styles.tag}>
                    <span className={styles.hole} aria-hidden="true" />
                    <Mark name={glyph} className={styles.tagGlyph} />
                    {price ? <span className={styles.price}>{price.text}</span> : null}
                    <span className={styles.name}>{text(item.label, locale)}</span>
                    <Facts facts={facts} skip={price} className={styles.facts} />
                  </span>
                </li>
              );
            })}
          </ul>
          <span className={styles.plank} aria-hidden="true" />
        </div>
      ) : null}
      <Tags screen={screen} locale={locale} className={styles.amenities} />
    </div>
  );
}
