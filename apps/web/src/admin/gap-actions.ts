"use server";

import type { Locale } from "@darb/core";
import { revalidatePath } from "next/cache";
import { adminApi } from "./api";

/** The language a search word was typed in, by its letters (Hebrew, Arabic, else Latin). */
function scriptOf(word: string): Locale {
  if (/[\u0590-\u05FF]/.test(word)) return "he";
  if (/[\u0600-\u06FF]/.test(word)) return "ar";
  return "en";
}

/** Adds a search gap's words to a kind's words (audited by the API). True when it was saved. */
export async function addSearchWord(kindId: string, word: string): Promise<boolean> {
  const clean = word.trim().slice(0, 80);
  if (!clean || !/^[0-9a-f-]{36}$/i.test(kindId)) return false;
  try {
    const res = await (
      await adminApi()
    ).kinds.synonym({
      params: { id: kindId },
      body: { locale: scriptOf(clean), word: clean },
    });
    if (res.status !== 200) return false;
    revalidatePath("/admin/[locale]", "layout");
    return true;
  } catch {
    return false;
  }
}
