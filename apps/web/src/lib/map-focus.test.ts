import { describe, expect, it, vi } from "vitest";
import { createStore, hotStore, previewStore, type Preview } from "./map-focus";

const garages: Preview = {
  place: "haifa",
  kind: "garages",
  title: "Garages in Haifa",
  count: 140,
  sticky: false,
};

describe("map focus stores", () => {
  it("tells listeners about a change, once", () => {
    const store = createStore(0);
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.set(1);
    store.set(1);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    store.set(2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(2);
  });

  it("treats the same category as no change, so a re-hover never refetches", () => {
    const listener = vi.fn();
    const stop = previewStore.subscribe(listener);
    previewStore.set(garages);
    previewStore.set({ ...garages });
    expect(listener).toHaveBeenCalledTimes(1);
    previewStore.set({ ...garages, sticky: true });
    expect(listener).toHaveBeenCalledTimes(2);
    previewStore.set(null);
    stop();
  });

  it("lifts one business at a time", () => {
    const listener = vi.fn();
    const stop = hotStore.subscribe(listener);
    hotStore.set({ key: "haifa/a", from: "list" });
    hotStore.set({ key: "haifa/a", from: "list" });
    hotStore.set({ key: "haifa/a", from: "map" });
    expect(listener).toHaveBeenCalledTimes(2);
    hotStore.set(null);
    stop();
  });
});
