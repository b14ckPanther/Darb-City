import { Fragment } from "react";
import type { Locale } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import { factsOf, type Fact } from "./facts";
import { Glyph, glyphFor, type GlyphName } from "./glyphs";
import { text } from "./shared";

/** A screen item with what every template reads off it: its glyph and its meta's facts. */
export interface Entry {
  item: ScreenDto["items"][number];
  glyph: GlyphName | null;
  facts: Fact[];
}

export function entriesOf(
  screen: ScreenDto,
  locale: Locale,
  rules?: Parameters<typeof glyphFor>[1],
): Entry[] {
  return screen.items.map((item) => ({
    item,
    glyph: glyphFor(item.label.en, rules),
    facts: factsOf(text(item.meta, locale)),
  }));
}

/**
 * The screen's motif: what the business is, read off its title (an import's title is its kind:
 * "Café", "Daycare") and then its items, so a bakery and a grill on the same template differ.
 */
export function motifOf(screen: ScreenDto, fallback: GlyphName): GlyphName {
  return (
    glyphFor(screen.title.en) ??
    screen.items.map((i) => glyphFor(i.label.en)).find((g) => g !== null) ??
    fallback
  );
}

/**
 * A meta as its facts, each marked with its kind (data-fact) for the template to set. The
 * separators stay in the text, so it reads, copies and searches exactly as written.
 */
export function Facts({
  facts,
  className,
  skip,
}: {
  facts: Fact[];
  className?: string | undefined;
  /** Facts the template already shows elsewhere (a price set large). */
  skip?: Fact | undefined;
}) {
  const shown = skip ? facts.filter((f) => f !== skip) : facts;
  if (shown.length === 0) return null;
  return (
    <span className={className} data-facts="">
      {shown.map((f, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <span data-sep="" aria-hidden="true">
              {" · "}
            </span>
          ) : null}
          <span data-fact={f.kind}>{f.text}</span>
        </Fragment>
      ))}
    </span>
  );
}

/** A glyph, or the plain dot when the label matched nothing. */
export function Mark({ name, className }: { name: GlyphName | null; className?: string }) {
  return <Glyph name={name ?? "dot"} className={className} />;
}
