import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stageAllowed, stageBootScript } from "./stage-boot";

const html = document.documentElement;
const boot = () => new Function(stageBootScript())();
const loseContext = vi.fn();
/** A GPU that gives a WebGL2 context (jsdom has none): the boot script probes for a real one. */
const gpu = (context: object | null) =>
  vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(((type: string) => (type === "webgl2" ? context : null)) as never);

beforeEach(() => {
  html.removeAttribute("data-stage");
  html.removeAttribute("data-stage-capable");
  loseContext.mockClear();
  gpu({ getExtension: (name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null) });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("stageAllowed", () => {
  it("shows the stage on city pages only", () => {
    for (const path of ["/", "/ar", "/sakhnin", "/en/k/barbershops", "/haifa/beauty/barbershops"])
      expect(stageAllowed(path), path).toBe(true);
    for (const path of ["/for-business", "/ar/for-business", "/search", "/en/search"])
      expect(stageAllowed(path), path).toBe(false);
  });
});

describe("the boot script", () => {
  it("marks a WebGL2 device and turns the stage on for a city page", () => {
    vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {});
    vi.stubGlobal("Worker", function Worker() {});
    window.history.pushState({}, "", "/sakhnin");
    boot();
    expect(html.hasAttribute("data-stage-capable")).toBe(true);
    expect(html.getAttribute("data-stage")).toBe("on");
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
  it("keeps it off on the marketing page, without asking the GPU for a context", () => {
    vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {});
    vi.stubGlobal("Worker", function Worker() {});
    const probe = gpu(null);
    window.history.pushState({}, "", "/en/for-business");
    boot();
    expect(html.getAttribute("data-stage")).toBe("off");
    expect(probe).not.toHaveBeenCalled();
  });
  it("leaves a device without WebGL2 as the plain list", () => {
    vi.stubGlobal("WebGL2RenderingContext", undefined);
    vi.stubGlobal("Worker", function Worker() {});
    boot();
    expect(html.hasAttribute("data-stage-capable")).toBe(false);
    expect(html.hasAttribute("data-stage")).toBe(false);
  });
  it("leaves a GPU that refuses a WebGL2 context as the plain list, before the first paint", () => {
    vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {});
    vi.stubGlobal("Worker", function Worker() {});
    gpu(null);
    window.history.pushState({}, "", "/sakhnin");
    boot();
    expect(html.hasAttribute("data-stage-capable")).toBe(false);
    expect(html.hasAttribute("data-stage")).toBe(false);
  });
});
