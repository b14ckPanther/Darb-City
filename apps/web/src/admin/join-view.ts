import type { JoinSource, JoinStatus } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { INTL_TAG } from "@/lib/locale";
import type { AdminKey } from "./copy";

export const JOIN_STATUS_KEY: Record<JoinStatus, AdminKey> = {
  pending: "joinPending",
  approved: "joinApproved",
  rejected: "joinRejected",
};

/** When a request came in, in Israel's time. */
export const receivedAt = (locale: Locale, iso: string) =>
  new Intl.DateTimeFormat(INTL_TAG[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));

/** tel: keeps only what a dialler reads: digits and a leading +. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** How a request came in: the owner's form (with or without the lookup), or the street. */
export const joinSourceKey = (source: JoinSource): AdminKey =>
  source === "lookup"
    ? "joinSourceLookup"
    : source === "field"
      ? "streetBadge"
      : "joinSourceManual";
