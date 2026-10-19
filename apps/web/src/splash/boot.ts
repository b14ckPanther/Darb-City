import {
  BADGE,
  DOOR,
  FLOOR,
  HALO_R,
  MARK,
  MARK_MAX,
  MARK_VH,
  MARK_VW,
  MARK_Y,
} from "./geometry.mjs";
import { NAME_GAP, NAME_MAX, NAME_MIN, NAME_VW, ROAD_ANGLE } from "./geometry.mjs";
import stylesheet from "./stylesheet.json";

/** The three installed apps; each ends its reveal on its own beat. */
export type SplashApp = "darb" | "helpers" | "admin";

/** Where a session remembers that its reveal has played (it plays once, on a cold start). */
export const SPLASH_KEY = "darb-splash";

/** The reveal's longest run, then the safety net that removes it whatever happened. */
export const SPLASH_MS = 900;
export const SPLASH_SAFETY_MS = 1200;

export type SplashConfig = {
  key: string;
  app: SplashApp;
  name: string;
  href: string;
  ms: number;
  g: {
    vw: number;
    vh: number;
    max: number;
    ratio: number;
    y: number;
    halo: number;
    gap: number;
    nameMin: number;
    nameVw: number;
    nameMax: number;
    door: { x: number; y: number };
    floor: { x: number; y: number };
    badge: { x: number; y: number };
    angle: number;
  };
};

export function splashConfig(app: SplashApp, name: string): SplashConfig {
  return {
    key: SPLASH_KEY,
    app,
    name,
    href: stylesheet.href,
    ms: SPLASH_SAFETY_MS,
    g: {
      vw: MARK_VW,
      vh: MARK_VH,
      max: MARK_MAX,
      ratio: MARK.height / MARK.width,
      y: MARK_Y,
      halo: HALO_R,
      gap: NAME_GAP,
      nameMin: NAME_MIN,
      nameVw: NAME_VW,
      nameMax: NAME_MAX,
      door: DOOR,
      floor: FLOOR,
      badge: BADGE,
      angle: ROAD_ANGLE,
    },
  };
}

/**
 * The launch reveal, run inline in <head> before the first paint. It plays only in an installed app
 * (display-mode: standalone, or iOS's navigator.standalone), only once per session, and never when
 * storage is blocked. Then it writes the reveal's stylesheet into <head> (parser-inserted, so it
 * holds the first paint: iOS keeps its launch image up until the page can paint the same frame) and
 * puts the overlay on <html>, beside <body>, so React never sees it. CSS runs the motion (and its
 * reduced-motion variant); this only lays it out, skips on a tap or a key, and removes it.
 *
 * Self-contained on purpose: it is serialised with Function#toString into the inline script.
 * Returns the overlay, or null when it does not play.
 */
export function splashBoot(w: Window, c: SplashConfig): HTMLElement | null {
  try {
    const d = w.document;
    const n = w.navigator as Navigator & { standalone?: boolean };
    const ios = n.standalone === true;
    const installed = ios || (!!w.matchMedia && w.matchMedia("(display-mode: standalone)").matches);
    if (!installed || d.visibilityState === "hidden") return null;
    const store = w.sessionStorage;
    if (store.getItem(c.key)) return null;
    store.setItem(c.key, "1");
    d.write('<link rel="stylesheet" href="' + c.href + '">');

    // iOS paints its launch image over the whole screen; under an opaque status bar the page
    // starts below it. Lay the frame out on the screen, then lift it by the bar.
    const width = w.innerWidth;
    const view = w.innerHeight;
    let bar = 0;
    if (ios) {
      const gap = w.screen.height - view;
      if (gap > 0 && gap < 120 && w.screen.width === width) bar = gap;
    }
    const height = view + bar;
    const g = c.g;
    const mw = Math.min(g.vw * width, g.vh * height, g.max);
    const mh = mw * g.ratio;
    const ml = (width - mw) / 2;
    const mt = g.y * height - mh / 2 - bar;
    const ns = Math.min(Math.max(g.nameVw * width, g.nameMin), g.nameMax);
    const dx = g.door.x * mw;
    const dy = g.door.y * mh;
    const fx = ml + g.floor.x * mw;
    const fy = mt + g.floor.y * mh;
    const px = (v: number) => Math.round(v * 100) / 100 + "px";
    const vars: Record<string, string> = {
      ml: px(ml),
      mt: px(mt),
      mw: px(mw),
      mh: px(mh),
      dx: px(dx),
      dy: px(dy),
      ox: px(ml + dx),
      oy: px(mt + dy),
      hx: px(width / 2),
      hy: px(mt + mh / 2),
      hr: px(g.halo * mw),
      nt: px(mt + mh + g.gap * mw),
      ns: px(ns),
      bx: px(g.badge.x * mw),
      by: px(g.badge.y * mh),
    };
    // The road comes in from the screen's lower edge and reaches the doorway's floor along the
    // mark's own isometric axis (it arrives climbing up and in, as the block's edges run).
    const r = (v: number) => Math.round(v * 10) / 10;
    const rad = (g.angle * Math.PI) / 180;
    const sx = width / 2 + Math.min(0.9 * mw, width * 0.4);
    const sy = view + 12;
    const road =
      "M" +
      r(sx) +
      " " +
      r(sy) +
      "C" +
      r(sx) +
      " " +
      r(sy - 0.45 * (sy - fy)) +
      " " +
      r(fx + Math.cos(rad) * 0.7 * mw) +
      " " +
      r(fy + Math.sin(rad) * 0.7 * mw) +
      " " +
      r(fx) +
      " " +
      r(fy);
    const beat =
      c.app === "helpers"
        ? '<i class="dsp-ring"></i><svg class="dsp-badge" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 7.6v8.8M7.6 12h8.8"/></svg>'
        : c.app === "admin"
          ? '<svg class="dsp-badge" viewBox="0 0 24 24"><path class="dsp-shield" d="M12 1.6 20.6 5v6.3c0 5.6-3.7 9.6-8.6 11.3-4.9-1.7-8.6-5.7-8.6-11.3V5Z"/><path class="dsp-check" pathLength="1" d="m7.9 12.2 3 3.1 5.4-6.4"/></svg>'
          : "";

    const el = d.createElement("div");
    el.id = "darb-splash";
    el.className = "dsp";
    el.setAttribute("data-app", c.app);
    el.setAttribute("aria-hidden", "true");
    // Hidden until its stylesheet says otherwise: if that fails to load, nothing shows.
    el.setAttribute("style", "display:none");
    for (const k in vars) el.style.setProperty("--dsp-" + k, vars[k]!);
    el.innerHTML =
      '<svg class="dsp-road" viewBox="0 0 ' +
      width +
      " " +
      view +
      '"><path pathLength="1" d="' +
      road +
      '"/><path pathLength="1" d="' +
      road +
      '"/></svg>' +
      '<div class="dsp-stage"><i class="dsp-bloom"></i><i class="dsp-mark"></i><i class="dsp-light"></i><i class="dsp-glint"></i>' +
      beat +
      '</div><p class="dsp-name"></p>';
    el.querySelector("p")!.textContent = c.name;
    d.documentElement.appendChild(el);

    let safety = 0;
    const done = () => {
      w.clearTimeout(safety);
      w.removeEventListener("keydown", skip, true);
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    const skip = () => el.classList.add("dsp-skip");
    el.addEventListener("animationend", (e) => {
      if (e.target === el && e.animationName === "dsp-out") done();
    });
    // The clock starts with the motion (the stylesheet may still be on its way); a stylesheet
    // that never comes leaves the overlay hidden, and it goes after a few seconds all the same.
    el.addEventListener(
      "animationstart",
      () => {
        w.clearTimeout(safety);
        safety = w.setTimeout(done, c.ms);
      },
      { once: true },
    );
    safety = w.setTimeout(done, 4 * c.ms);
    el.addEventListener("pointerdown", skip);
    w.addEventListener("keydown", skip, true);
    return el;
  } catch {
    return null;
  }
}

/** The inline <head> script for `app`, named `name` in the page's language. */
export function splashBootScript(app: SplashApp, name: string): string {
  return `(${splashBoot.toString()})(window,${JSON.stringify(splashConfig(app, name)).replace(/</g, "\\u003c")});`;
}
