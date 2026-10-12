import { describe, expect, it, vi } from "vitest";
import { moveCamera, type MovableMap } from "./camera-move";

/**
 * Behaves like MapLibre 6.11: setPadding and jumpTo are jumps that fire moveend at once, and a new
 * flyTo or fitBounds first stops the running move, which fires that move's moveend.
 */
function fakeMap() {
  const listeners = new Set<() => void>();
  const fire = () => {
    for (const fn of [...listeners]) fn();
  };
  const map = {
    setPadding: vi.fn(fire),
    jumpTo: vi.fn(fire),
    fitBounds: vi.fn((_b: unknown, options: { duration?: number }) => {
      fire();
      if (!options.duration) fire();
    }),
    flyTo: vi.fn(fire),
    cameraForBounds: vi.fn(() => ({ zoom: 10.5 })),
    on: vi.fn((_type: "moveend", fn: () => void) => void listeners.add(fn)),
    off: vi.fn((_type: "moveend", fn: () => void) => void listeners.delete(fn)),
  } satisfies MovableMap;
  return { map, fire, listeners };
}

const inset = { top: 68, left: 0, right: 480 };
const settled = async (p: Promise<void>) => {
  let done = false;
  void p.then(() => (done = true));
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

describe("moveCamera", () => {
  it("waits for the flight's own moveend, not the one stopping the last move", async () => {
    vi.useFakeTimers();
    const { map, fire, listeners } = fakeMap();
    const move = moveCamera(map, { center: [35.3, 32.86], zoom: 14 }, 550, inset);
    expect(move.target).toBe(14);
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ padding: { top: 68, bottom: 0, left: 0, right: 480 } }),
    );
    expect(await settled(move.arrived)).toBe(false);
    fire();
    expect(await settled(move.arrived)).toBe(true);
    expect(listeners.size).toBe(0);
    vi.useRealTimers();
  });

  it("fits bounds after resetting the padding, with the header and sheet inside it", async () => {
    vi.useFakeTimers();
    const { map, fire } = fakeMap();
    const bounds: [[number, number], [number, number]] = [
      [35.2, 32.8],
      [35.4, 32.9],
    ];
    const move = moveCamera(map, { bounds, maxZoom: 15 }, 550, inset);
    expect(map.setPadding.mock.invocationCallOrder[0]).toBeLessThan(
      map.on.mock.invocationCallOrder[0]!,
    );
    const padding = { top: 116, bottom: 48, left: 48, right: 528 };
    expect(map.fitBounds).toHaveBeenCalledWith(bounds, expect.objectContaining({ padding }));
    expect(map.cameraForBounds).toHaveBeenCalledWith(bounds, { padding, maxZoom: 15 });
    expect(move.target).toBe(10.5);
    expect(await settled(move.arrived)).toBe(false);
    fire();
    expect(await settled(move.arrived)).toBe(true);
    vi.useRealTimers();
  });

  it("arrives at once for a jump", async () => {
    const { map, listeners } = fakeMap();
    const move = moveCamera(map, { center: [35.3, 32.86], zoom: 13.5 }, 0, inset);
    expect(map.jumpTo).toHaveBeenCalled();
    expect(await settled(move.arrived)).toBe(true);
    expect(listeners.size).toBe(0);
  });

  it("gives up waiting shortly after the move should have ended", async () => {
    vi.useFakeTimers();
    const { map } = fakeMap();
    const move = moveCamera(map, { center: [35.3, 32.86], zoom: 14 }, 550, inset);
    vi.advanceTimersByTime(800);
    expect(await settled(move.arrived)).toBe(true);
    vi.useRealTimers();
  });
});
