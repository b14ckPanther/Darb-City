import { colors } from "@darb/tokens";
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
