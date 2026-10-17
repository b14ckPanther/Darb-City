import { colors, themes } from "@darb/tokens";
import { expect, it } from "vitest";
import { tokensCss } from "./tokens-css";

it("exposes every brand colour and motion curve as a custom property", () => {
  const css = tokensCss();
  expect(css.startsWith(":root{")).toBe(true);
  expect(css).toContain("--night:#03110c;");
  expect(css).toContain("--forest-950:#051811;");
  expect(css).toContain("--gold-300:#f0c77a;");
  expect(css).toContain("--ink-muted:#4c5f56;");
  expect(css).toContain("--ease-out:cubic-bezier(0.22, 1, 0.36, 1);");
  for (const value of Object.values(colors)) expect(css).toContain(value);
});

it("paints day by default and night for a dark device, a night pick or a night band", () => {
  const css = tokensCss();
  const [root] = css.split("@media");
  expect(root).toContain("color-scheme:light;");
  expect(root).toContain(`--bg:${themes.day.bg};`);
  expect(root).toContain(`--text:${themes.day.text};`);
  expect(css).toContain(
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:${themes.night.bg};`,
  );
  expect(css).toContain(`:root[data-theme="dark"],[data-scheme="night"]{color-scheme:dark;`);
  // Every role is declared in each block, the derived ones too (a night band resolves its own).
  for (const block of css.split("{").slice(1))
    if (block.startsWith("color-scheme")) expect(block).toContain("--focus-ring:");
});
