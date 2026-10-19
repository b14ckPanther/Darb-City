"use server";

import type { Locale } from "@darb/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale } from "@/lib/locale";
import type { ActionState } from "./action-state";
import { actionFailed, answered } from "./admin-errors";
import { adminApi } from "./api";
import { at } from "./copy";
import { text } from "./form-data";
import { adminHref } from "./routes";

const localeOf = (fd: FormData): Locale => {
  const l = text(fd, "locale");
  return isLocale(l) ? l : "he";
};

/**
 * Publishes the join request's draft as it is saved now. The page and the nav's count (and the
 * installed app's badge) render again from the revalidation; the button stamps its gold seal.
 */
export async function approveJoin(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const res = await answered(async () =>
    (await adminApi()).joinRequests.approve({ params: { id }, body: {} }),
  );
  if (!res) return actionFailed(locale, "errJoinNotDecided");
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  if (res.status !== 200) return actionFailed(locale, "errJoinNotDecided", res);
  revalidatePath("/admin/[locale]", "layout");
  return { ok: true, message: null, errors: [] };
}

/** Deletes the draft and its photos; the request stays with the reason. */
export async function rejectJoin(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const reason = text(fd, "reason");
  if (reason.length < 2) return { ok: false, message: at(locale, "joinRejectReason"), errors: [] };
  const res = await answered(async () =>
    (await adminApi()).joinRequests.reject({
      params: { id },
      body: { reason: reason.slice(0, 500) },
    }),
  );
  if (!res) return actionFailed(locale, "errJoinNotDecided");
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  if (res.status !== 200) return actionFailed(locale, "errJoinNotDecided", res);
  revalidatePath("/admin/[locale]", "layout");
  redirect(adminHref(locale, `/join-requests/${id}`));
}

/**
 * Approves every waiting addition of one helper (the API runs the single approval for each, each
 * one audited). Says how many went live, and whether any failed or more still wait.
 */
export async function approveHelperJoins(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const helper = text(fd, "helper");
  const res = await answered(async () =>
    (await adminApi()).joinRequests.approveHelper({ body: { helper } }),
  );
  if (!res) return actionFailed(locale, "errJoinBulk");
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  if (res.status !== 200) return actionFailed(locale, "errJoinBulk", res);
  revalidatePath("/admin/[locale]", "layout");
  const { approved, failed, remaining } = res.body;
  if (approved === 0 && failed > 0) return actionFailed(locale, "errJoinBulk");
  if (failed > 0)
    return {
      ok: false,
      message: at(locale, "joinApproveAllPartial", { approved, failed }),
      errors: [],
    };
  const done = at(locale, "joinApproveAllDone", { count: approved });
  return {
    ok: true,
    message:
      remaining > 0 ? `${done} ${at(locale, "joinApproveAllMore", { count: remaining })}` : done,
    errors: [],
  };
}
