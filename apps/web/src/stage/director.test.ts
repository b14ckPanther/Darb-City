import { describe, expect, it, vi } from "vitest";
import type { PlazaLevel, StageLevel } from "@darb/stage";
import { Director, type DirectorDeps } from "./director";
import type { Frame } from "./fade";
import type { StageMap } from "./types";

const sakhnin = { slug: "sakhnin", name: "Sakhnin", lat: 32.8638, lng: 35.3023 };
const door = (slug: string) => ({
  slug,
  href: `/sakhnin/${slug}`,
  label: slug,
  count: 1,
  accent: "#d9aaa2",
});
const place: StageLevel = { depth: 1, place: sakhnin, doors: [door("beauty")] };
const sector: StageLevel = {
  depth: 2,
  place: sakhnin,
  sector: { slug: "beauty", name: "Beauty", accent: "#d9aaa2" },
  doors: [door("barbershops")],
};
const pin = {
  key: "sakhnin/a",
  href: "/sakhnin/beauty/barbershops/a",
  name: "A",
  lat: 32.86,
  lng: 35.3,
};
const kind: StageLevel = { depth: 3, place: sakhnin, pins: [pin] };

function setup(options: { reduced?: boolean; gate?: Promise<void> } = {}) {
  const host = document.createElement("div");
  const layers = { map: document.createElement("div"), plaza: document.createElement("div") };
  const log: string[] = [];
  const fades: { layer: string; from: Frame; to: Frame; duration: number }[] = [];
  const map: StageMap = {
    move: vi.fn(async () => {}),
    setDots: vi.fn(),
    setPins: vi.fn(),
    pointOf: () => null,
    destroy: vi.fn(),
  };
  const deps: DirectorDeps = {
    host,
    layers,
    showPlaza: vi.fn((level: PlazaLevel) => {
      log.push(`plaza ${level.depth}`);
    }),
    fade: async (el, from, to, duration) => {
      const layer = el === layers.map ? "map" : "plaza";
      log.push(`fade ${layer} ${from.opacity}->${to.opacity}`);
      fades.push({ layer, from, to, duration });
      await options.gate;
    },
    frame: async () => {},
    reducedMotion: () => options.reduced ?? false,
    insetEnd: (level) => (level.depth === 3 ? 480 : 0),
  };
  const director = new Director(deps);
  director.attachMap(map);
  return { host, layers, map, deps, director, log, fades };
}

describe("Director", () => {
  it("starts with both layers hidden from people and assistive tech", () => {
    const { layers } = setup();
    for (const el of Object.values(layers)) {
      expect(el.hasAttribute("inert")).toBe(true);
      expect(el.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("shows a place's plaza without flying the first time", async () => {
    const { host, layers, map, deps, director, fades } = setup();
    await director.show(place, "/sakhnin");
    expect(map.move).toHaveBeenCalledWith({ center: [35.3023, 32.8638], zoom: 13.5 }, 0, 0);
    expect(deps.showPlaza).toHaveBeenCalledWith(place);
    expect(layers.plaza.hasAttribute("data-active")).toBe(true);
    expect(layers.plaza.hasAttribute("inert")).toBe(false);
    expect(layers.map.hasAttribute("inert")).toBe(true);
    expect(fades).toEqual([
      {
        layer: "plaza",
        from: { opacity: 0, scale: 1 },
        to: { opacity: 1, scale: 1 },
        duration: 550,
      },
    ]);
    expect({ ...host.dataset }).toEqual({
      stageLevel: "1",
      stageView: "plaza",
      stageMotion: "jump",
      stageFade: "550",
      stagePlace: "sakhnin",
      stagePath: "/sakhnin",
    });
  });

  it("zooms through the plaza into a sector, swapping scenes in the dark", async () => {
    const { map, director, log, fades } = setup();
    await director.show(place, "/sakhnin");
    log.length = 0;
    fades.length = 0;
    await director.show(sector, "/sakhnin/beauty");
    expect(map.move).toHaveBeenLastCalledWith({ center: [35.3023, 32.8638], zoom: 13.5 }, 550, 0);
    expect(log).toEqual(["fade plaza 1->0", "plaza 2", "fade plaza 0->1"]);
    expect(fades.map((f) => [f.to.scale, f.from.scale, f.duration])).toEqual([
      [1.08, 1, 275],
      [1, 0.94, 275],
    ]);
  });

  it("crossfades into the street map with pins, beside the desktop sheet", async () => {
    const { host, layers, map, director, fades } = setup();
    await director.show(sector, "/sakhnin/beauty");
    fades.length = 0;
    await director.show(kind, pin.href);
    expect(map.setPins).toHaveBeenLastCalledWith([pin], pin.href);
    expect(map.move).toHaveBeenLastCalledWith({ center: [35.3023, 32.8638], zoom: 14 }, 550, 480);
    expect(layers.map.hasAttribute("data-active")).toBe(true);
    expect(layers.plaza.hasAttribute("inert")).toBe(true);
    expect(fades.map((f) => `${f.layer} ${f.from.opacity}->${f.to.opacity}`).sort()).toEqual([
      "map 0->1",
      "plaza 1->0",
    ]);
    expect(host.dataset.stageActivePin).toBe("sakhnin/a");
    expect(host.dataset.stageView).toBe("map");
  });

  it("never flies with reduced motion: a 400 ms fade without scaling", async () => {
    const { map, director, fades } = setup({ reduced: true });
    await director.show({ depth: 0 }, "/");
    fades.length = 0;
    await director.show(place, "/sakhnin");
    expect(map.move).toHaveBeenLastCalledWith({ center: [35.3023, 32.8638], zoom: 13.5 }, 0, 0);
    for (const f of fades) {
      expect(f.duration).toBe(400);
      expect([f.from.scale, f.to.scale]).toEqual([1, 1]);
    }
  });

  it("ends where the last URL ends when a move is overtaken", async () => {
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const { host, director } = setup({ gate });
    const first = director.show(place, "/sakhnin");
    const second = director.show({ depth: 0 }, "/");
    expect(host.dataset.stageMoving).toBe("");
    open();
    await Promise.all([first, second]);
    expect(host.dataset.stagePath).toBe("/");
    expect(host.dataset.stageLevel).toBe("0");
    expect(host.dataset.stageMoving).toBeUndefined();
  });

  it("shows the plaza even before the map is ready", async () => {
    const { deps } = setup();
    const director = new Director(deps);
    await director.show(place, "/sakhnin");
    expect(deps.showPlaza).toHaveBeenCalledWith(place);
    expect(director.depth).toBe(1);
  });
  it("fades the map through a map-to-map level change under reduced motion, changing it in the dark", async () => {
    const { map, deps, director, log, fades } = setup({ reduced: true });
    await director.show({ depth: 0 }, "/");
    log.length = 0;
    fades.length = 0;
    vi.mocked(map.setPins).mockImplementation(() => void log.push("pins"));
    vi.mocked(map.move).mockImplementation(async () => void log.push("move"));
    await director.show(kind, "/sakhnin/beauty/barbershops");
    expect(log).toEqual(["fade map 1->0", "pins", "move", "fade map 0->1"]);
    expect(fades.map((f) => [f.layer, f.duration, f.from.scale, f.to.scale])).toEqual([
      ["map", 200, 1, 1],
      ["map", 200, 1, 1],
    ]);
    expect(deps.showPlaza).not.toHaveBeenCalled();
  });

  it("does not re-fade a street map whose pins were only refreshed", async () => {
    const { map, director, fades } = setup({ reduced: true });
    await director.show(kind, "/sakhnin/beauty/barbershops");
    fades.length = 0;
    const b = { ...pin, key: "sakhnin/b", href: "/sakhnin/beauty/barbershops/b" };
    const refreshed: StageLevel = { depth: 3, place: sakhnin, pins: [pin, b] };
    await director.show(refreshed, "/sakhnin/beauty/barbershops");
    expect(fades).toEqual([]);
    expect(map.setPins).toHaveBeenLastCalledWith([pin, b], "/sakhnin/beauty/barbershops");
  });
});
