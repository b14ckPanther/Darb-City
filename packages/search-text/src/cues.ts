import { normalize } from "./normalize.js";

export interface Cues {
  openNow: boolean;
  delivers: boolean;
  nearMe: boolean;
}

/** Raw phrases; matched as whole word sequences after normalization, longest first. */
const PHRASES: Record<keyof Cues, string[]> = {
  openNow: [
    "open now",
    "opened now",
    "open late",
    "open",
    "פתוח עכשיו",
    "פתוחה עכשיו",
    "פתוח",
    "פתוחה",
    "مفتوح هلأ",
    "مفتوح الان",
    "مفتوح هسا",
    "مفتوح",
    "فاتح",
  ],
  delivers: [
    "delivery",
    "deliveries",
    "delivers",
    "deliver",
    "משלוחים",
    "משלוח",
    "עושה משלוחים",
    "توصيل",
    "ديليفري",
    "دليفري",
  ],
  nearMe: [
    "near me",
    "nearby",
    "close to me",
    "around me",
    "closest",
    "nearest",
    "לידי",
    "קרוב אליי",
    "קרוב אלי",
    "בסביבה",
    "הכי קרוב",
    "قريب مني",
    "بالقرب مني",
    "جنبي",
    "قريب علي",
    "الاقرب",
  ],
};

const TABLE = (Object.keys(PHRASES) as (keyof Cues)[])
  .flatMap((cue) => PHRASES[cue].map((p) => ({ cue, words: normalize(p).split(" ") })))
  .sort((a, b) => b.words.length - a.words.length);

export function detectCues(normalized: string): { cues: Cues; rest: string } {
  const cues: Cues = { openNow: false, delivers: false, nearMe: false };
  const words = normalized === "" ? [] : normalized.split(" ");
  const keep: string[] = [];
  for (let i = 0; i < words.length;) {
    const hit = TABLE.find((p) => p.words.every((w, j) => words[i + j] === w));
    if (hit) {
      cues[hit.cue] = true;
      i += hit.words.length;
    } else keep.push(words[i++] as string);
  }
  return { cues, rest: keep.join(" ") };
}
