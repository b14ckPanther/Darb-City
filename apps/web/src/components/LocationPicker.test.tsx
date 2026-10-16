import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LatLng } from "@darb/core";

/** A MapLibre stand-in: 1 px is 0.001°, and the first idle frame comes at once. */
class FakeMap {
  handlers: Record<string, ((e: unknown) => void)[]> = {};
  canvas = document.createElement("canvas");
  easeTo = vi.fn();
  remove = vi.fn();
  constructor(public options: { container: HTMLElement; cooperativeGestures?: boolean }) {
    if (fake.refuse) throw new Error("No WebGL2");
    fake.maps.push(this);
  }
  on(type: string, fn: (e: unknown) => void) {
    (this.handlers[type] ??= []).push(fn);
  }
  off() {}
  once(type: string, fn: () => void) {
    if (type === "idle") queueMicrotask(fn);
  }
  fire(type: string, event: unknown) {
    for (const fn of this.handlers[type] ?? []) fn(event);
  }
  getCanvas() {
    return this.canvas;
  }
  getZoom() {
    return 15;
  }
  project(p: { lng: number; lat: number }) {
    return { x: p.lng * 1000, y: -p.lat * 1000 };
  }
  unproject([x, y]: [number, number]) {
    return { lng: x / 1000, lat: -y / 1000 };
  }
}
class FakeMarker {
  element: HTMLElement;
  at: [number, number] = [0, 0];
  handlers: Record<string, () => void> = {};
  constructor(options: { element: HTMLElement }) {
    this.element = options.element;
    fake.markers.push(this);
  }
  setLngLat(at: [number, number]) {
    this.at = at;
    return this;
  }
  getLngLat() {
    return { lng: this.at[0], lat: this.at[1] };
  }
  addTo(map: FakeMap) {
    map.options.container.append(this.element);
    return this;
  }
  remove() {
    this.element.remove();
  }
  on(type: string, fn: () => void) {
    this.handlers[type] = fn;
  }
}
const fake = { refuse: false, maps: [] as FakeMap[], markers: [] as FakeMarker[] };
vi.mock("@/stage/load-maplibre", () => ({
  loadMapLibre: async () => ({ Map: FakeMap, Marker: FakeMarker, addProtocol: () => {} }),
}));

const { LocationPicker } = await import("./LocationPicker");

const labels = {
  map: "Map for choosing where the business is",
  pin: "Business pin",
  hint: "Drag the pin",
  centre: "Centre on pin",
  locate: "Use my location",
  locating: "Finding you",
  noLocation: "Your location is not available",
  outside: "That point is outside Israel",
  editNumbers: "Edit numbers",
  lat: "Latitude",
  lng: "Longitude",
  noMap: "The map could not load",
  mapData: "Map data",
  gestures: { windows: "Ctrl", mac: "Cmd", mobile: "Two fingers" },
};

function Harness({ start, onChange }: { start: LatLng | null; onChange?: (p: LatLng) => void }) {
  const [value, setValue] = useState(start);
  return (
    <form data-testid="form">
      <LocationPicker
        value={value}
        onChange={(p) => {
          onChange?.(p);
          setValue(p);
        }}
        locale="en"
        labels={labels}
      />
    </form>
  );
}
const hidden = () => {
  const fd = new FormData(screen.getByTestId("form") as HTMLFormElement);
  return { lat: fd.get("lat"), lng: fd.get("lng") };
};
const ready = async () => {
  await screen.findByText(labels.hint);
  return fake.maps.at(-1)!;
};
const SAKHNIN = { lat: 32.858, lng: 35.181 };

beforeEach(() => {
  fake.refuse = false;
  fake.maps = [];
  fake.markers = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        version: 8,
        glyphs: "/map/glyphs/{fontstack}/{range}.pbf",
        sources: { protomaps: { type: "vector", url: "pmtiles:///x" } },
        layers: [],
      }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

it("carries the point in hidden lat and lng fields, empty until the pin is placed", async () => {
  const { unmount } = render(<Harness start={null} />);
  expect(hidden()).toEqual({ lat: "", lng: "" });
  await ready();
  unmount();
  render(<Harness start={SAKHNIN} />);
  expect(hidden()).toEqual({ lat: "32.858", lng: "35.181" });
  expect(screen.getByText("32.858000, 35.181000")).toBeTruthy();
});

it("a click on the map moves the pin, rounded to six decimals", async () => {
  const onChange = vi.fn();
  render(<Harness start={null} onChange={onChange} />);
  const map = await ready();
  expect(map.options.cooperativeGestures).toBe(true);
  act(() => map.fire("click", { lngLat: { lat: 32.70000049, lng: 35.3 } }));
  expect(onChange).toHaveBeenCalledWith({ lat: 32.7, lng: 35.3 });
  expect(hidden()).toEqual({ lat: "32.7", lng: "35.3" });
  expect(fake.markers[0]!.at).toEqual([35.3, 32.7]);
});

it("refuses a point outside Israel: says so, and the pin goes back", async () => {
  const onChange = vi.fn();
  render(<Harness start={SAKHNIN} onChange={onChange} />);
  const map = await ready();
  const marker = fake.markers[0]!;
  marker.setLngLat([36.5, 33.9]);
  act(() => marker.handlers.dragend!());
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText(labels.outside)).toBeTruthy();
  expect(marker.at).toEqual([35.181, 32.858]);
  act(() => map.fire("click", { lngLat: { lat: 34, lng: 35 } }));
  expect(hidden()).toEqual({ lat: "32.858", lng: "35.181" });
});

it("the arrow keys nudge the focused pin, Shift five times as far", async () => {
  render(<Harness start={SAKHNIN} />);
  await ready();
  const pin = screen.getByRole("button", { name: labels.pin });
  expect(pin.getAttribute("aria-describedby")).toBe(screen.getByText("32.858000, 35.181000").id);
  fireEvent.keyDown(pin, { key: "ArrowRight" });
  expect(hidden()).toEqual({ lat: "32.858", lng: "35.191" });
  fireEvent.keyDown(pin, { key: "ArrowUp", shiftKey: true });
  expect(hidden()).toEqual({ lat: "32.908", lng: "35.191" });
});

it("keeps the numbers one disclosure away; typing them moves the pin", async () => {
  render(<Harness start={SAKHNIN} />);
  const map = await ready();
  const details = screen.getByText(labels.editNumbers).closest("details")!;
  expect(details.open).toBe(false);
  fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "32.9" } });
  expect(hidden()).toEqual({ lat: "32.9", lng: "35.181" });
  expect(map.easeTo).toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "37" } });
  expect(screen.getByText(labels.outside)).toBeTruthy();
  expect(hidden()).toEqual({ lat: "32.9", lng: "35.181" });
});

it("without a map (no WebGL, no tiles) the numbers stand in, required", async () => {
  fake.refuse = true;
  const onChange = vi.fn();
  render(<Harness start={null} onChange={onChange} />);
  await screen.findByText(labels.noMap);
  expect(document.querySelector("details")).toBeNull();
  const lat = screen.getByLabelText("Latitude") as HTMLInputElement;
  expect(lat.required).toBe(true);
  fireEvent.change(lat, { target: { value: "32.858" } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "35.181" } });
  expect(onChange).toHaveBeenCalledWith(SAKHNIN);
  expect(hidden()).toEqual({ lat: "32.858", lng: "35.181" });
});

it("uses the device's location only when asked, and only inside Israel", async () => {
  const getCurrentPosition = vi.fn();
  vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
  render(<Harness start={null} />);
  await ready();
  expect(getCurrentPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: labels.locate }));
  act(() => getCurrentPosition.mock.calls[0]![0]({ coords: { latitude: 51.5, longitude: 0 } }));
  expect(screen.getByText(labels.outside)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: labels.locate }));
  act(() =>
    getCurrentPosition.mock.calls[1]![0]({ coords: { latitude: 32.858, longitude: 35.181 } }),
  );
  expect(hidden()).toEqual({ lat: "32.858", lng: "35.181" });
  fireEvent.click(screen.getByRole("button", { name: labels.locate }));
  act(() => getCurrentPosition.mock.calls[2]![1]({ code: 1 }));
  expect(screen.getByText(labels.noLocation)).toBeTruthy();
});
