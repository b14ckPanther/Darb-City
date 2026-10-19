/** A short message in the corner: what just happened. Shown by the shell's Toaster. */
export interface Toast {
  message: string;
  tone?: "ok" | "error";
}

export const TOAST_EVENT = "darb-admin-toast";

/** Safe anywhere in the browser; does nothing on the server. */
export function toast(message: string, tone: Toast["tone"] = "ok"): void {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(new CustomEvent<Toast>(TOAST_EVENT, { detail: { message, tone } }));
}
