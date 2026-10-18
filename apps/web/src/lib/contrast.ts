function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on the background. */
export function readableOn(background: string): "#000000" | "#ffffff" {
  return contrastRatio("#000000", background) >= contrastRatio("#ffffff", background)
    ? "#000000"
    : "#ffffff";
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/** `a` moved toward `b` by `t` (0..1), in sRGB. */
export function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return `#${[1, 3, 5].map((i) => hex(ch(a, i) + (ch(b, i) - ch(a, i)) * t)).join("")}`;
}

/**
 * The accent as text on `background`: the accent itself when it reads (WCAG AA, 4.5:1), else the
 * accent moved toward `ink` just until it does, so it keeps its hue.
 */
export function readableAccent(accent: string, background: string, ink: string): string {
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mix(accent, ink, t);
    if (contrastRatio(c, background) >= 4.5) return c;
  }
  return ink;
}
