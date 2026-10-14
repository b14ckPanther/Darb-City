import type { AdminErrorDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import type { ActionState } from "./action-state";
import { at, type AdminKey } from "./copy";

/** The API's stable reasons (409/400 `code`), said in the admin's language. */
const CODES: Record<string, AdminKey> = {
  already_exists: "errAlreadyExists",
  kind_has_sub_kinds: "errKindHasSubKinds",
  kind_tree_too_deep: "errKindTreeTooDeep",
  example_tier_fixed: "errExampleTier",
};

/**
 * A refused write as form state. A 409 without a code on a create is a taken address, so the
 * caller may name it (`conflict`); anything else keeps the API's own reason and field errors.
 */
export function apiError(
  locale: Locale,
  res: { status: number; body: unknown },
  opts: { conflict?: AdminKey } = {},
): ActionState {
  const body = (
    res.body && typeof res.body === "object" ? res.body : {}
  ) as Partial<AdminErrorDto> & { code?: unknown };
  const code = typeof body.code === "string" ? CODES[body.code] : undefined;
  if (code) return { ok: false, message: at(locale, code), errors: [] };
  if (res.status === 409 && opts.conflict)
    return { ok: false, message: at(locale, opts.conflict), errors: [] };
  const known = res.status === 400 || res.status === 404 || res.status === 409;
  const message =
    known && typeof body.message === "string" ? body.message : at(locale, "errorGeneric");
  const errors = Array.isArray(body.errors)
    ? body.errors.filter((e): e is string => typeof e === "string")
    : [];
  return { ok: false, message, errors: known ? errors : [] };
}

/**
 * A one-button action (status, delete, return to seed) that did not happen: the admin's own words
 * say what did not change (`headline`), and the API's reason, when it gave one, follows.
 */
export function actionFailed(
  locale: Locale,
  headline: AdminKey,
  res?: { status: number; body: unknown },
): ActionState {
  const reason = res ? apiError(locale, res) : null;
  const errors =
    reason && reason.message !== at(locale, "errorGeneric")
      ? [reason.message ?? "", ...reason.errors].filter(Boolean)
      : [];
  return { ok: false, message: at(locale, headline), errors };
}

/** The API's answer, or null when there was none (unreachable, or a 5xx the contract does not list). */
export async function answered<T>(call: () => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch {
    return null;
  }
}
