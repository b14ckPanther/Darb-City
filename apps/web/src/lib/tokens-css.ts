import { colors, motion } from "@darb/tokens";

/** forest950 → forest-950, inkMuted → ink-muted. */
const kebab = (key: string) => key.replace(/([a-z])([0-9A-Z])/g, "$1-$2").toLowerCase();

/** The brand tokens as CSS custom properties: the single source for every colour and curve. */
export function tokensCss(): string {
  const declarations = [
    ...Object.entries(colors).map(([key, value]) => `--${kebab(key)}:${value};`),
    `--ease-out:${motion.easeOut};`,
    `--ease-in-out:${motion.easeInOut};`,
  ];
  return `:root{${declarations.join("")}}`;
}
