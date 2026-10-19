/** A short message in the corner: what just happened. Shown by the shell's Toaster. */
export interface Toast {
  message: string;
  tone?: "ok" | "error";
  /** A gold seal stamps in instead of the check: something went live (an approval). */
  seal?: boolean;
}

export const TOAST_EVENT = "darb-admin-toast";

/** Safe anywhere in the browser; does nothing on the server. */
export function toast(message: string, tone: Toast["tone"] = "ok", seal = false): void {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(new CustomEvent<Toast>(TOAST_EVENT, { detail: { message, tone, seal } }));
}
