"use server";

import { LocateQuerySchema, type LocateResultDto } from "@darb/contracts";
import { isSlug } from "@darb/core";
import { adminApi } from "./api";

/** What the finder shows: the API's answer, or "error" when the API could not be asked. */
export type LocateAnswer = LocateResultDto | { found: null; reason: "error" | "signed-out" };

/**
 * Find the place for the pin: an address or a map link (POST /admin/locate with the admin's own
 * token). Never throws: a down API is "error", a lost session "signed-out".
 */
export async function locatePlace(input: {
  query: string;
  locale: string;
  placeSlug?: string;
}): Promise<LocateAnswer> {
  const parsed = LocateQuerySchema.safeParse({
    query: input.query,
    locale: input.locale,
    ...(input.placeSlug && isSlug(input.placeSlug.trim())
      ? { placeSlug: input.placeSlug.trim() }
      : {}),
  });
  if (!parsed.success) return { found: null, reason: "error" };
  try {
    const res = await (await adminApi()).locate({ body: parsed.data });
    if (res.status === 200) return res.body;
    return { found: null, reason: res.status === 401 ? "signed-out" : "error" };
  } catch {
    return { found: null, reason: "error" };
  }
}
