import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { layout } from "./geometry.mjs";
import stylesheet from "./stylesheet.json";
import { SPLASH_KEY, SPLASH_SAFETY_MS, splashBoot, splashBootScript, splashConfig } from "./boot";

type Fake = {
  standalone?: boolean;
  iosStandalone?: boolean;
  storage?: Storage | "blocked";
  hidden?: boolean;
  width?: number;
  height?: number;
  screenHeight?: number;
};

/** A window over jsdom's document: its display mode, iOS flag, storage and screen are the test's. */
function fakeWindow(f: Fake = {}) {
  const width = f.width ?? 390;
  const height = f.height ?? 844;
  const write = vi.fn();
  Object.defineProperty(document, "write", { value: write, configurable: true });
  Object.defineProperty(document, "visibilityState", {
    value: f.hidden ? "hidden" : "visible",
    configurable: true,
  });
  const storage =
    f.storage === "blocked"
      ? new Proxy({} as Storage, {
          get() {
            throw new DOMException("blocked", "SecurityError");
          },
        })
      : (f.storage ?? window.sessionStorage);
  const w = {
    document,
    navigator: { standalone: f.iosStandalone },
    matchMedia: (q: string) => ({
      matches: /display-mode:\s*standalone/.test(q) && !!f.standalone,
    }),
    get sessionStorage() {
      if (f.storage === "blocked") throw new DOMException("blocked", "SecurityError");
      return storage;
    },
    innerWidth: width,
    innerHeight: height,
    screen: { width, height: f.screenHeight ?? height },
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
  };
  return { w: w as unknown as Window, write };
}

const overlay = () => document.getElementById("darb-splash");
const config = splashConfig("helpers", "עוזרי דרב");

beforeEach(() => {
  sessionStorage.clear();
  overlay()?.remove();
});
afterEach(() => {
  vi.useRealTimers();
  overlay()?.remove();
});

describe("only in an installed app", () => {
  it("never plays in a browser tab: no overlay, no stylesheet, nothing remembered", () => {
    const { w, write } = fakeWindow();
    expect(splashBoot(w, config)).toBeNull();
    expect(overlay()).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(SPLASH_KEY)).toBeNull();
  });

  it("plays when the display mode is standalone (Android, desktop)", () => {
    const { w, write } = fakeWindow({ standalone: true });
    const el = splashBoot(w, config);
    expect(el).toBe(overlay());
    expect(write).toHaveBeenCalledWith(`<link rel="stylesheet" href="${stylesheet.href}">`);
    // Beside <body>, on <html>: React never renders or hydrates it.
    expect(el?.parentNode).toBe(document.documentElement);
    expect(el?.getAttribute("aria-hidden")).toBe("true");
    expect(el?.getAttribute("data-app")).toBe("helpers");
    expect(el?.textContent).toBe("עוזרי דרב");
    // Hidden until its stylesheet loads, so a failed fetch never shows a bare overlay.
    expect(el?.style.display).toBe("none");
  });

  it("plays when iOS opens it from the home screen (navigator.standalone)", () => {
    const { w } = fakeWindow({ iosStandalone: true });
    expect(splashBoot(w, config)).not.toBeNull();
  });

  it("never plays in a page being prerendered or opened in the background", () => {
    const { w } = fakeWindow({ standalone: true, hidden: true });
    expect(splashBoot(w, config)).toBeNull();
  });
});

describe("only once per session", () => {
  it("plays on the cold start, then never again in the same session", () => {
    const first = fakeWindow({ standalone: true });
    expect(splashBoot(first.w, config)).not.toBeNull();
    expect(sessionStorage.getItem(SPLASH_KEY)).toBe("1");
    overlay()?.remove();
    const again = fakeWindow({ standalone: true });
    expect(splashBoot(again.w, config)).toBeNull();
    expect(again.write).not.toHaveBeenCalled();
  });

  it("does not play (and does not throw) when storage is blocked", () => {
    const { w, write } = fakeWindow({ standalone: true, storage: "blocked" });
    expect(splashBoot(w, config)).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});

describe("lays out the launch image's frame", () => {
  const px = (el: HTMLElement, k: string) => parseFloat(el.style.getPropertyValue(`--dsp-${k}`));

  it("puts the mark where the launch image has it", () => {
    const el = splashBoot(fakeWindow({ standalone: true }).w, config)!;
    const at = layout(390, 844);
    expect(px(el, "ml")).toBeCloseTo(at.mark.left, 1);
    expect(px(el, "mt")).toBeCloseTo(at.mark.top, 1);
    expect(px(el, "mw")).toBeCloseTo(at.mark.width, 1);
    expect(px(el, "mh")).toBeCloseTo(at.mark.height, 1);
    expect(px(el, "hr")).toBeCloseTo(at.halo.r, 1);
  });

  it("lifts it by iOS's status bar, which the launch image covers and the page does not", () => {
    // An opaque status bar: the page is 54 px shorter than the screen and starts below the bar.
    const el = splashBoot(
      fakeWindow({ iosStandalone: true, height: 790, screenHeight: 844 }).w,
      config,
    )!;
    expect(px(el, "mt")).toBeCloseTo(layout(390, 844).mark.top - 54, 1);
  });
});

describe("hands off", () => {
  it("skips on a tap: the overlay fades at once", () => {
    const el = splashBoot(fakeWindow({ standalone: true }).w, config)!;
    el.dispatchEvent(new Event("pointerdown"));
    expect(el.classList.contains("dsp-skip")).toBe(true);
  });

  it("removes itself when its fade ends", () => {
    const el = splashBoot(fakeWindow({ standalone: true }).w, config)!;
    const end = Object.assign(new Event("animationend"), { animationName: "dsp-out" });
    el.dispatchEvent(end);
    expect(overlay()).toBeNull();
  });

  it("removes itself soon after the motion starts, whatever happens to its events", () => {
    vi.useFakeTimers();
    const el = splashBoot(fakeWindow({ standalone: true }).w, config)!;
    el.dispatchEvent(new Event("animationstart"));
    vi.advanceTimersByTime(SPLASH_SAFETY_MS - 1);
    expect(overlay()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(overlay()).toBeNull();
  });
});

describe("the inline script", () => {
  it("is self-contained: it runs from its own text", () => {
    const script = splashBootScript("admin", "Darb admin");
    const { w } = fakeWindow({ standalone: true });
    new Function("window", script)(w);
    expect(overlay()?.getAttribute("data-app")).toBe("admin");
    expect(overlay()?.textContent).toBe("Darb admin");
  });

  it("never lets a name close the script tag", () => {
    expect(splashBootScript("darb", "</script><b>")).not.toContain("</script>");
  });

  it("does nothing in a browser tab, from its own text too", () => {
    new Function("window", splashBootScript("darb", "Darb"))(fakeWindow().w);
    expect(overlay()).toBeNull();
  });
});
