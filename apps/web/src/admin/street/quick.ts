/** Where the helper app's service worker keeps a photo shared into it (public/helper-sw.js). */
export const SHARE_CACHE = "darb-helper-share";
export const SHARE_PHOTO = "/__darb-share/photo";

/** A short tap of the phone, where it can (Android); silent elsewhere, never an error. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function")
      navigator.vibrate(pattern);
  } catch {
    // Some browsers refuse without a recent tap: the feedback on screen is enough.
  }
}

/** The photo another app shared into the helper app, taken once (it is gone after this). */
export async function takeSharedPhoto(): Promise<File | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(SHARE_CACHE);
    const res = await cache.match(SHARE_PHOTO);
    if (!res) return null;
    await cache.delete(SHARE_PHOTO);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return new File([blob], "shared.jpg", { type: blob.type });
  } catch {
    return null;
  }
}
