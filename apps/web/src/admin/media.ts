import { MEDIA_ORIGIN } from "@/lib/csp";

/** A media key ("biz/…/logo.webp") as the small image the admin lists show; null without one. */
export function mediaThumb(key: string | null | undefined): string | null {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  return `${MEDIA_ORIGIN}/${key.replace(/^\/+/, "")}`;
}
