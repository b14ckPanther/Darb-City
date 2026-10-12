import { normalize } from "./normalize.js";

export const tokenize = (normalized: string): string[] =>
  normalized === "" ? [] : normalized.split(" ");

/** Words that never name a kind or a place. Normalized at load. */
export const STOPWORDS: ReadonlySet<string> = new Set(
  [
    "in",
    "at",
    "near",
    "around",
    "the",
    "a",
    "an",
    "for",
    "of",
    "to",
    "with",
    "best",
    "good",
    "cheap",
    "i",
    "want",
    "need",
    "looking",
    "where",
    "is",
    "are",
    "there",
    "any",
    "some",
    "please",
    "ב",
    "ליד",
    "של",
    "את",
    "עם",
    "על",
    "יש",
    "איפה",
    "רוצה",
    "צריך",
    "צריכה",
    "מחפש",
    "מחפשת",
    "הכי",
    "טוב",
    "טובה",
    "באזור",
    "קרוב",
    "في",
    "عند",
    "على",
    "من",
    "مع",
    "بدي",
    "اريد",
    "وين",
    "فيه",
    "في",
    "احسن",
    "افضل",
    "منطقة",
    "بمنطقة",
  ].map(normalize),
);

const HE_PREFIXES = ["וה", "וב", "ול", "שה", "שב", "כש", "מה", "ה", "ב", "ל", "ו", "ש", "כ", "מ"];
const AR_PREFIXES = ["وال", "بال", "فال", "كال", "لل", "ال", "و", "ب", "ف", "ل", "ك"];

/** The token, then the token without an attached Hebrew or Arabic prefix (one or two letters). */
export function variants(token: string): string[] {
  const out = [token];
  const prefixes = /\p{Script=Hebrew}/u.test(token)
    ? HE_PREFIXES
    : /\p{Script=Arabic}/u.test(token)
      ? AR_PREFIXES
      : [];
  for (const p of prefixes) {
    if (!token.startsWith(p)) continue;
    const rest = token.slice(p.length);
    if (rest.length >= 2 && !out.includes(rest)) out.push(rest);
    // "بالحلاق" → "حلاق": a preposition before the article.
    if (rest.startsWith("ال") && rest.length - 2 >= 2 && !out.includes(rest.slice(2)))
      out.push(rest.slice(2));
  }
  return out;
}
