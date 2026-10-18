/** Where the iOS home screen tip remembers it was dismissed (it shows once, then never again). */
export const IOS_TIP_KEY = "darb-ios-tip";

/** The window property the boot script parks Chrome's install prompt on. */
export const PROMPT_KEY = "__darbInstall";
export const PROMPT_EVENT = "darb-install-ready";

/**
 * Runs in <head>: Chrome may offer the install prompt before React hydrates, so it is caught here
 * and kept. Holding it also keeps Chrome's own bottom banner away: Darb never nags.
 */
export function installBootScript(): string {
  return `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.${PROMPT_KEY}=e;window.dispatchEvent(new Event("${PROMPT_EVENT}"))});window.addEventListener("appinstalled",function(){window.${PROMPT_KEY}=null;window.dispatchEvent(new Event("${PROMPT_EVENT}"))});`;
}

/** Already opened from the home screen (any platform). */
export function standalone(win: Window = window): boolean {
  return (
    win.matchMedia?.("(display-mode: standalone)").matches === true ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Safari on an iPhone or iPad (iPadOS reports a Mac with touch). Other iOS browsers have their own
 * share menus, so the tip, which names Safari's, is for Safari only.
 */
export function iosSafari(nav: Pick<Navigator, "userAgent" | "maxTouchPoints">): boolean {
  const ua = nav.userAgent;
  const ios = /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  return ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}
