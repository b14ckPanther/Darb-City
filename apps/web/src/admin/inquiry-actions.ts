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

const localeOf = (fd: FormData): Locale => {
  const l = text(fd, "locale");
  return isLocale(l) ? l : "he";
};

/** Mark a contact message handled, or reopen it. The nav's count of new ones follows. */
export async function setInquiryStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const status = text(fd, "status");
  if (status !== "new" && status !== "handled") return actionFailed(locale, "errInquiryNotChanged");
  const res = await answered(async () =>
    (await adminApi()).inquiries.status({ params: { id: text(fd, "id") }, body: { status } }),
  );
  if (!res) return actionFailed(locale, "errInquiryNotChanged");
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  if (res.status !== 200) return actionFailed(locale, "errInquiryNotChanged", res);
  revalidatePath("/admin/[locale]", "layout");
  return { ok: true, message: null, errors: [] };
}
