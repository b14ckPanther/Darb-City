/**
 * next/font gives each family a size-adjusted "… Fallback" face that is local Arial with no
 * unicode-range, so `Ubuntu, Ubuntu Fallback, Heebo, …` stops at Arial for Hebrew and Arabic.
 * Turbopack emits that face even with `adjustFontFallback: false`, so the stack is built from
 * the real families only: each script falls through to the one family that covers it, and a
 * Hebrew page keeps its English words in Ubuntu and its Arabic words in Cairo.
 */
export function fontStack(...fonts: { style: { fontFamily: string } }[]): string {
  const first = (stack: string) => stack.split(",", 1)[0]?.trim() ?? stack;
  return `${fonts.map((f) => first(f.style.fontFamily)).join(", ")}, system-ui, sans-serif`;
}
