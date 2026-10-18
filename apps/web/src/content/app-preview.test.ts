import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import { appPreview } from "./app-preview";

const all = LOCALES.flatMap((l) => {
  const c = appPreview[l];
  return [c.eyebrow, c.open, c.live, c.frameTitle, c.shotAlt, ...Object.values(c.owner)];
});

it("speaks every language", () => {
  for (const l of LOCALES) expect(appPreview[l].owner.question).not.toBe("");
});

it("keeps to plain words: no long dashes or maqaf, no halal, no AI, no Modern Standard 'now'", () => {
  for (const text of all) {
    expect(text).not.toMatch(/[–—־]/);
    expect(text).not.toMatch(/halal|حلال|חלאל/i);
    expect(text).not.toMatch(/\bAI\b|בינה מלאכותית|ذكاء اصطناعي/);
    expect(text).not.toMatch(/هلأ|هلقيت/);
  }
});
