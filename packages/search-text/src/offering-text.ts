import { normalize } from "./normalize.js";

/**
 * How a card's lines read as things it offers, shared by the API (which indexes them) and the
 * web (which highlights the one a search matched), so both cut a line the same way.
 */

/** A part worth searching has a word in it: "₪68", "100%" and "20:05" are not things. */
const WORDY = /\p{L}{2}/u;
/** "Including gluten-free knafeh": the lead-in is not part of the thing's name. */
const LEAD_IN = /^(?:כולל גם|כולל|including|incl\.?|بما في ذلك|بما فيها|بما فيه|منها)\s+/iu;
/** Segments of a meta line ("₪68 · chicken, sumac, onion"). */
const SEGMENT = /\s*[·•|]\s*/u;
/** A list inside a segment. */
const LIST = /\s*[,،;]\s*/u;

export const hasWords = (text: string): boolean => WORDY.test(text);

export interface ListSegment {
  /** "Challah and laffa sandwiches" in "Challah and laffa sandwiches: schnitzel, kebab". */
  head: string | null;
  parts: string[];
}

/** A meta line's segments, each with its heading (before a colon) and its listed things. */
export function splitList(text: string): ListSegment[] {
  return text
    .split(SEGMENT)
    .filter(Boolean)
    .map((segment) => {
      const colon = segment.indexOf(":");
      const head = colon > 0 ? segment.slice(0, colon).trim() : null;
      const list = colon > 0 ? segment.slice(colon + 1) : segment;
      return {
        head: head && WORDY.test(head) ? head : null,
        parts: list
          .split(LIST)
          .map((p) => p.replace(LEAD_IN, "").trim())
          .filter((p) => WORDY.test(p)),
      };
    });
}

/** A line without its price, time or percentage segments ("₪45 · inside and out"). */
export const wordySegments = (text: string): string =>
  text
    .split(SEGMENT)
    .filter((segment) => WORDY.test(segment))
    .join(" · ");

/** The key a matched thing travels under (`?hl=`): its normalized words, hyphenated. */
export const matchKey = (text: string): string => normalize(text).replace(/ /g, "-");
