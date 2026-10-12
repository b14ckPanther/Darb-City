import { describe, expect, it } from "vitest";
import {
  cameraFor,
  ISRAEL_NORTH,
  MOTION,
  planTransition,
  PLACE_ZOOM,
  sceneKey,
  STREET_ZOOM,
  viewFor,
} from "./camera.js";
import type { CityDot, StageLevel } from "./types.js";

const sakhnin = { slug: "sakhnin", name: "Sakhnin", lat: 32.8638, lng: 35.3023 };
const door = (slug: string) => ({
  slug,
  href: `/sakhnin/${slug}`,
  label: slug,
  count: 1,
  accent: "#d9aaa2",
});
const country: StageLevel = { depth: 0 };
const place: StageLevel = { depth: 1, place: sakhnin, doors: [door("beauty"), door("food")] };
const sector: StageLevel = {
  depth: 2,
  place: sakhnin,
  sector: { slug: "beauty", name: "Beauty", accent: "#d9aaa2" },
  doors: [door("barbershops")],
};
const kind: StageLevel = {
  depth: 3,
  place: sakhnin,
  pins: [
    { key: "sakhnin/a", href: "/sakhnin/beauty/barbershops/a", name: "A", lat: 32.86, lng: 35.3 },
  ],
};
const dots: CityDot[] = [
  { slug: "sakhnin", name: "Sakhnin", lat: 32.86, lng: 35.3, count: 40, href: "/sakhnin" },
  { slug: "haifa", name: "Haifa", lat: 32.79, lng: 34.99, count: 90, href: "/haifa" },
];
const motionOff = { reducedMotion: false };

describe("views and cameras", () => {
  it("shows the map at levels 0 and 3, the plaza at 1 and 2", () => {
    expect([country, place, sector, kind].map(viewFor)).toEqual(["map", "plaza", "plaza", "map"]);
  });
  it("shows the map for a place with no doors (a soon place)", () => {
    expect(viewFor({ depth: 1, place: sakhnin, doors: [] })).toBe("map");
  });
  it("frames every live place at level 0, or the north before they load", () => {
    expect(cameraFor(country)).toEqual(ISRAEL_NORTH);
    const camera = cameraFor(country, dots);
    expect("bounds" in camera && camera.bounds[0][0]).toBeLessThan(34.99);
    expect("bounds" in camera && camera.bounds[1][1]).toBeGreaterThan(32.86);
  });
  it("centres on the place, closer at street level", () => {
    expect(cameraFor(place)).toEqual({ center: [35.3023, 32.8638], zoom: PLACE_ZOOM });
    expect(cameraFor(kind)).toEqual({ center: [35.3023, 32.8638], zoom: STREET_ZOOM });
  });
  it("frames the pins when there are several", () => {
    const two: StageLevel = {
      ...kind,
      pins: [...kind.pins, { key: "sakhnin/b", href: "/b", name: "B", lat: 32.87, lng: 35.31 }],
    };
    expect(cameraFor(two)).toMatchObject({ maxZoom: 15 });
  });
  it("keys plaza scenes by place and sector", () => {
    expect(sceneKey(place)).toBe("place:sakhnin");
    expect(sceneKey(sector)).toBe("sector:sakhnin/beauty");
  });
});

describe("planTransition", () => {
  it("appears without flying the first time", () => {
    const plan = planTransition(null, place, dots, motionOff);
    expect(plan).toMatchObject({ view: "plaza", motion: "jump", duration: 0, direction: "none" });
    expect(plan.fade).toEqual({ kind: "cross", duration: MOTION.move, outScale: 1, inScale: 1 });
  });
  it("flies into a place and crossfades the map into its plaza", () => {
    const plan = planTransition(country, place, dots, motionOff);
    expect(plan).toMatchObject({ view: "plaza", motion: "fly", duration: 550, direction: "in" });
    expect(plan.fade).toEqual({ kind: "cross", duration: 550, outScale: 1.08, inScale: 0.94 });
  });
  it("zooms through the plaza into a sector and back out", () => {
    expect(planTransition(place, sector, dots, motionOff).fade).toEqual({
      kind: "through",
      duration: 550,
      outScale: 1.08,
      inScale: 0.94,
    });
    expect(planTransition(sector, place, dots, motionOff).fade).toEqual({
      kind: "through",
      duration: 550,
      outScale: 0.94,
      inScale: 1.08,
    });
  });
  it("crossfades the plaza back to the map at street level", () => {
    const plan = planTransition(sector, kind, dots, motionOff);
    expect(plan).toMatchObject({ view: "map", direction: "in" });
    expect(plan.fade?.kind).toBe("cross");
  });
  it("only moves the camera between two map levels", () => {
    const plan = planTransition(kind, country, dots, motionOff);
    expect(plan).toMatchObject({ view: "map", motion: "fly", direction: "out", fade: null });
  });
  it("does nothing visible for the same plaza scene", () => {
    expect(planTransition(place, { ...place }, dots, motionOff).fade).toBeNull();
  });
  it("never flies with reduced motion: a 400 ms fade, no scaling", () => {
    const plan = planTransition(country, place, dots, { reducedMotion: true });
    expect(plan).toMatchObject({ motion: "jump", duration: 0 });
    expect(plan.fade).toEqual({ kind: "cross", duration: MOTION.fade, outScale: 1, inScale: 1 });
  });
  it("keeps every move and fade within 400–700 ms", () => {
    for (const d of Object.values(MOTION)) {
      expect(d).toBeGreaterThanOrEqual(400);
      expect(d).toBeLessThanOrEqual(700);
    }
  });
});
