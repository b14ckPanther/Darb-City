"use server";

import type { Locale } from "@darb/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale } from "@/lib/locale";
import type { ActionState } from "./action-state";
import { actionFailed, answered } from "./admin-errors";
import { adminApi } from "./api";
import { text } from "./form-data";
import { adminHref } from "./routes";

const MOVES = ["approve", "pause", "resume"] as const;
type Move = (typeof MOVES)[number];

/**
 * Approves a waiting helper, pauses an active one, or resumes a paused one (audited by the API).
 * The helper sees it the next time they open their app; the nav's count follows.
 */
export async function decideHelper(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = text(fd, "locale");
  const locale: Locale = isLocale(raw) ? raw : "he";
  const id = text(fd, "id");
  const move = text(fd, "move") as Move;
  if (!MOVES.includes(move)) return actionFailed(locale, "errHelperNotDecided");
  const res = await answered(async () =>
    (await adminApi()).helpers[move]({ params: { id }, body: {} }),
  );
  if (!res) return actionFailed(locale, "errHelperNotDecided");
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  if (res.status !== 200) return actionFailed(locale, "errHelperNotDecided", res);
  revalidatePath("/admin/[locale]", "layout");
  return { ok: true, message: "", errors: [] };
}

/** The caps an admin may pick on a helper's card, as the form sends them. */
const LIMITS = { "150": 150, "500": 500, none: null } as const;

/** One helper's cap on additions and sign readings a day (audited by the API). */
export async function setHelperLimit(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = text(fd, "locale");
  const locale: Locale = isLocale(raw) ? raw : "he";
  const id = text(fd, "id");
  const picked = text(fd, "limit");
  if (!Object.hasOwn(LIMITS, picked)) return actionFailed(locale, "errHelperLimit");
  const limit = LIMITS[picked as keyof typeof LIMITS];
  const res = await answered(async () =>
    (await adminApi()).helpers.limit({ params: { id }, body: { limit } }),
  );
  if (!res) return actionFailed(locale, "errHelperLimit");
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  if (res.status !== 200) return actionFailed(locale, "errHelperLimit", res);
  revalidatePath("/admin/[locale]/helpers", "page");
  return { ok: true, message: "", errors: [] };
}
