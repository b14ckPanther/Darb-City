import { describe, expect, it } from "vitest";
import { t } from "@darb/i18n";
import { FALLBACK_TEXT } from "./fallback";

describe("the error and not-found views' own words", () => {
  it("match the message table in every language", () => {
    for (const [locale, words] of Object.entries(FALLBACK_TEXT))
      for (const [key, text] of Object.entries(words))
        expect(text).toBe(t(locale as "he" | "ar" | "en", key as never));
  });
});
