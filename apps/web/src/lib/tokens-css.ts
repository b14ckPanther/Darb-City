import { colors, motion, themes, type ThemeName } from "@darb/tokens";

/** forest950 → forest-950, inkMuted → ink-muted, surface1 → surface-1. */
const kebab = (key: string) => key.replace(/([a-z])([0-9A-Z])/g, "$1-$2").toLowerCase();

/**
 * Roles built from a theme's roles. They are declared again wherever a theme is (not only on
 * :root), so a night band inside a day page (the landing hero, the footer) resolves its own.
 */
const DERIVED = [
  "--focus-ring:0 0 0 2px var(--bg),0 0 0 4px var(--focus);",
  "--shadow-1:0 1px 2px rgb(var(--shadow) / calc(var(--shadow-k) * 0.06)),0 3px 12px rgb(var(--shadow) / calc(var(--shadow-k) * 0.05));",
  "--shadow-2:0 1px 2px rgb(var(--shadow) / calc(var(--shadow-k) * 0.06)),0 10px 30px rgb(var(--shadow) / calc(var(--shadow-k) * 0.09));",
  "--shadow-panel:0 2px 6px rgb(var(--shadow) / calc(var(--shadow-k) * 0.06)),0 24px 64px rgb(var(--shadow) / calc(var(--shadow-k) * 0.16));",
].join("");

function themeDeclarations(name: ThemeName): string {
  const roles = Object.entries(themes[name]).map(([key, value]) => `--${kebab(key)}:${value};`);
  // Shadows on paper are soft and warm; at night they have to be much deeper to show at all.
  const k = name === "day" ? 1 : 5;
  const scheme = name === "day" ? "light" : "dark";
  return `color-scheme:${scheme};${roles.join("")}--shadow-k:${k};${DERIVED}`;
}

/**
 * The brand tokens and the theme roles as CSS custom properties: the single source for every
 * colour and curve. Day by default; night when the device prefers dark (unless the visitor picked
 * day), when the visitor picked night (html[data-theme="dark"]), and inside any
 * [data-scheme="night"] band (which stays night by day, on purpose).
 */
export function tokensCss(): string {
  const brand = [
    ...Object.entries(colors).map(([key, value]) => `--${kebab(key)}:${value};`),
    `--ease-out:${motion.easeOut};`,
    `--ease-in-out:${motion.easeInOut};`,
  ];
  const day = themeDeclarations("day");
  const night = themeDeclarations("night");
  return [
    `:root{${brand.join("")}${day}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${night}}}`,
    `:root[data-theme="dark"],[data-scheme="night"]{${night}}`,
  ].join("");
}
