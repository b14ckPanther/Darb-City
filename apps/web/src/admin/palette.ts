import type { AdminIconName } from "./AdminIcon";
import type { AdminKey } from "./copy";

/** One line in the command palette: a screen, an action, or something found. */
export interface PaletteHit {
  id: string;
  group: AdminKey;
  label: string;
  sub?: string;
  href: string;
  icon: AdminIconName;
  thumb?: string | null;
  status?: "draft" | "published" | "suspended";
  swatch?: string;
}

/** Folds case, Hebrew points and Arabic marks so "kafe" finds "Kafe" and "مقهى" finds "مَقهى". */
export const fold = (s: string): string =>
  s
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[֑-ׇً-ٰٟ̀-ͯ]/g, "")
    .trim();

/** Screens and actions that match what is typed, best first (start of a word beats inside). */
export function filterStatic(hits: PaletteHit[], q: string): PaletteHit[] {
  const needle = fold(q);
  if (!needle) return hits;
  const scored = hits.flatMap((h) => {
    const hay = fold(`${h.label} ${h.sub ?? ""}`);
    const i = hay.indexOf(needle);
    if (i < 0) return [];
    const wordStart = i === 0 || hay[i - 1] === " ";
    return [{ h, score: (i === 0 ? 0 : wordStart ? 1 : 2) * 1000 + i }];
  });
  return scored.sort((a, b) => a.score - b.score).map((s) => s.h);
}

/** Next option index with the arrow keys, wrapping around. */
export function step(index: number, length: number, by: 1 | -1): number {
  if (length === 0) return -1;
  return (index + by + length) % length;
}
