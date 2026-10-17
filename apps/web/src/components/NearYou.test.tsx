import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BusinessRowData } from "@/lib/rows";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/near" }));
const setPins = vi.fn();
const setHere = vi.fn();
const fit = vi.fn();
vi.mock("@/stage/near-map", () => ({
  NearMap: {
    create: vi.fn(async () => ({ setPins, setHere, fit, destroy: vi.fn(), resize: vi.fn() })),
  },
}));
const { NearYou } = await import("./NearYou");
const { positionGranted } = await import("@/lib/live-position");

const labels = {
  nearYou: "Near you",
  nearYouAt: "Near you · {place}",
  lead: "Businesses around where you are standing, the closest first.",
  ask: "Share your location once.",
  useMyLocation: "Use my location",
  locating: "Finding you…",
  denied: "Location is off.",
  browsePlaces: "Browse places",
  empty: "No businesses near you on Darb yet.",
  unreachable: "Darb can't be reached right now.",
  retry: "Try again",
  showMore: "Show more",
  businesses: "Businesses",
  hereMarker: "You are here",
  map: "Map of businesses near you",
  mapData: "Map data",
  rows: {
    example: "Example",
    openNow: "Open now",
    closed: "Closed",
    glutenFree: "Gluten-free",
    byAppointment: "By appointment",
    distanceKm: "{km} km",
    distanceM: "{m} m",
    locale: "en-IL",
  },
};

const row = (key: string, distance: string): BusinessRowData => ({
  key,
  name: key.split("/")[1]!,
  tagline: "",
  href: `/en/sakhnin/beauty/barbershops/${key.split("/")[1]}`,
  example: false,
  openNow: null,
  hours: null,
  placeName: "Sakhnin",
  lat: 32.86,
  lng: 35.3,
  distance,
  glutenFree: false,
  byAppointment: false,
  accent: "#d9a54c",
  logoUrl: null,
});

const ARRABA = { lat: 32.8486259, lng: 35.3358268 };
const getCurrentPosition = vi.fn();
const watchPosition = vi.fn(() => 1);

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition, watchPosition, clearWatch: vi.fn() },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const keep = (at = Date.now()) =>
  sessionStorage.setItem("darb.here", JSON.stringify({ ...ARRABA, accuracy: 20, at }));

function stubList(pages: { rows: BusinessRowData[]; nextCursor: string | null; place?: string }[]) {
  const fetchMock = vi.fn();
  for (const page of pages) fetchMock.mockResolvedValueOnce(Response.json(page));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const show = () => render(<NearYou locale="en" placesHref="/en/israel" labels={labels} />);

it("with no kept point, asks on a button and never prompts by itself", async () => {
  vi.stubGlobal("fetch", vi.fn());
  show();
  const button = await screen.findByRole("button", { name: "Use my location" });
  expect(getCurrentPosition).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(button).toBeTruthy();
});

it("treats a point older than ten minutes as missing", async () => {
  vi.stubGlobal("fetch", vi.fn());
  keep(Date.now() - 11 * 60 * 1000);
  show();
  expect(await screen.findByRole("button", { name: "Use my location" })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

it("says so plainly when location is denied, with a way to browse places", async () => {
  vi.stubGlobal("fetch", vi.fn());
  getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) =>
    fail({ code: 1 } as GeolocationPositionError),
  );
  show();
  fireEvent.click(await screen.findByRole("button", { name: "Use my location" }));
  expect(await screen.findByText(labels.denied)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Browse places" }).getAttribute("href")).toBe(
    "/en/israel",
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("lists the businesses around a kept point, names the place and pins them", async () => {
  keep();
  const fetchMock = stubList([
    { rows: [row("sakhnin/samers", "1.3 km"), row("sakhnin/nour", "2 km")], nextCursor: "c2", place: "Arraba" },
    { rows: [row("sakhnin/third", "4 km")], nextCursor: null },
  ]);
  show();
  expect(await screen.findByRole("heading", { level: 1, name: "Near you · Arraba" })).toBeTruthy();
  expect(screen.getByText("samers")).toBeTruthy();
  expect(screen.getByText("1.3 km")).toBeTruthy();
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/near/businesses");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({ locale: "en", ...ARRABA });
  await waitFor(() => expect(setPins).toHaveBeenCalled());
  expect(setPins.mock.calls.at(-1)![0]).toHaveLength(2);
  expect(fit).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  expect(await screen.findByText("third")).toBeTruthy();
  expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({
    locale: "en",
    ...ARRABA,
    cursor: "c2",
  });
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

it("asks, then lists around the new precise fix", async () => {
  getCurrentPosition.mockImplementation((ok: PositionCallback) =>
    ok({ coords: { latitude: 32.85, longitude: 35.34, accuracy: 15 } } as GeolocationPosition),
  );
  stubList([{ rows: [row("sakhnin/samers", "1 km")], nextCursor: null, place: "Arraba" }]);
  show();
  fireEvent.click(await screen.findByRole("button", { name: "Use my location" }));
  expect(await screen.findByText("samers")).toBeTruthy();
  expect(getCurrentPosition.mock.calls[0]![2]).toMatchObject({ enableHighAccuracy: true });
  expect(JSON.parse(sessionStorage.getItem("darb.here")!)).toMatchObject({
    lat: 32.85,
    lng: 35.34,
  });
});

it("says plainly when nothing is near", async () => {
  keep();
  stubList([{ rows: [], nextCursor: null }]);
  show();
  expect(await screen.findByText(labels.empty)).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1, name: "Near you" })).toBeTruthy();
});

it("offers a retry when Darb can't be reached", async () => {
  keep();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  show();
  expect(await screen.findByText(labels.unreachable)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

it("re-sorts only once the visitor has moved more than 300 m", async () => {
  // The live position is shared by the whole page: it starts where the kept point is.
  positionGranted(ARRABA);
  keep();
  const fetchMock = stubList([
    { rows: [row("sakhnin/samers", "1 km")], nextCursor: null, place: "Arraba" },
    { rows: [row("sakhnin/nour", "1 km")], nextCursor: null, place: "Sakhnin" },
  ]);
  show();
  expect(await screen.findByText("samers")).toBeTruthy();
  // About 110 m north: the same list.
  act(() => positionGranted({ lat: ARRABA.lat + 0.001, lng: ARRABA.lng }));
  await act(async () => {});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getCurrentPosition).not.toHaveBeenCalled();
  // About 1 km north: a precise fix confirms it, and the list follows the new spot.
  getCurrentPosition.mockImplementation((ok: PositionCallback) =>
    ok({
      coords: { latitude: ARRABA.lat + 0.009, longitude: ARRABA.lng, accuracy: 10 },
    } as GeolocationPosition),
  );
  act(() => positionGranted({ lat: ARRABA.lat + 0.009, lng: ARRABA.lng }));
  expect(await screen.findByText("nour")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[1]![1].body).lat).toBeCloseTo(ARRABA.lat + 0.009);
  expect(getCurrentPosition.mock.calls[0]![2]).toMatchObject({ enableHighAccuracy: true });
});

it("keeps the precise point when the coarse watch only drifts", async () => {
  positionGranted(ARRABA);
  keep();
  const fetchMock = stubList([{ rows: [row("sakhnin/samers", "1 km")], nextCursor: null }]);
  // The precise fix says the visitor never left.
  getCurrentPosition.mockImplementation((ok: PositionCallback) =>
    ok({ coords: { latitude: ARRABA.lat, longitude: ARRABA.lng, accuracy: 8 } } as GeolocationPosition),
  );
  show();
  expect(await screen.findByText("samers")).toBeTruthy();
  act(() => positionGranted({ lat: ARRABA.lat + 0.006, lng: ARRABA.lng }));
  act(() => positionGranted({ lat: ARRABA.lat + 0.0062, lng: ARRABA.lng }));
  await act(async () => {});
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
