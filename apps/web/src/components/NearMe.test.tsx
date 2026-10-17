import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/" }));
const { NearMe } = await import("./NearMe");

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

const labels = {
  nearMe: "Near me",
  locating: "Finding you…",
  denied: "Location is off. Pick a place from the list instead.",
};

const getCurrentPosition = vi.fn();

function stubLocation(result: "granted" | "denied") {
  getCurrentPosition.mockImplementation((ok: PositionCallback, fail: PositionErrorCallback) =>
    result === "granted"
      ? ok({
          coords: { latitude: 32.8486259, longitude: 35.3358268, accuracy: 12 },
        } as GeolocationPosition)
      : fail({ code: 1 } as GeolocationPositionError),
  );
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
}

beforeEach(() => {
  sessionStorage.clear();
  getCurrentPosition.mockReset();
});

it("asks for a precise fix only when tapped, keeps it in this tab and opens /near", async () => {
  stubLocation("granted");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ href: "/arraba" })));
  render(<NearMe locale="ar" homeHref="/ar" labels={labels} />);
  expect(fetch).not.toHaveBeenCalled();
  expect(getCurrentPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Near me" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/ar/near"));
  expect(getCurrentPosition.mock.calls[0]![2]).toEqual({
    enableHighAccuracy: true,
    maximumAge: 15_000,
    timeout: 15_000,
  });
  // The exact point stays in this tab, never in the URL it goes to.
  const kept = JSON.parse(sessionStorage.getItem("darb.here")!);
  expect(kept).toMatchObject({ lat: 32.8486259, lng: 35.3358268, accuracy: 12 });
  expect(typeof kept.at).toBe("number");
  // The place name for the label still comes from /api/near, in a POST body.
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith("/api/near", expect.objectContaining({ method: "POST" })),
  );
  const [url, init] = vi.mocked(fetch).mock.calls[0]!;
  expect(String(url)).not.toContain("lat=");
  expect(JSON.parse(String(init?.body))).toEqual({
    locale: "ar",
    lat: 32.8486259,
    lng: 35.3358268,
  });
});

it("still opens /near when the place name cannot be found", async () => {
  stubLocation("granted");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  render(<NearMe locale="he" homeHref="/" labels={labels} />);
  fireEvent.click(screen.getByRole("button", { name: "Near me" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/near"));
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(screen.queryByText(labels.denied)).toBeNull();
});

it("on a national kind page, still goes to the nearest place that has the kind", async () => {
  stubLocation("granted");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ href: "/sakhnin/beauty/nails", name: "x" })),
  );
  render(<NearMe locale="he" kind="nails" homeHref="/" labels={labels} />);
  fireEvent.click(screen.getByRole("button", { name: "Near me" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/sakhnin/beauty/nails"));
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]?.body))).toMatchObject({
    kind: "nails",
  });
  expect(sessionStorage.getItem("darb.here")).toBeNull();
});

it("explains in one line when location is denied", async () => {
  stubLocation("denied");
  render(<NearMe locale="en" homeHref="/en" labels={labels} />);
  fireEvent.click(screen.getByRole("button", { name: "Near me" }));
  await waitFor(() => expect(screen.getByText(labels.denied)).toBeTruthy());
  expect(push).not.toHaveBeenCalled();
});

it("names the place it found and remembers it on this device", async () => {
  stubLocation("granted");
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ href: "/haifa", name: "חיפה" })),
  );
  const { unmount } = render(<NearMe locale="he" homeHref="/" labels={labels} />);
  fireEvent.click(screen.getByRole("button", { name: "Near me" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Near me: חיפה" })).toBeTruthy());
  expect(push).toHaveBeenCalledWith("/near");
  unmount();
  render(<NearMe locale="he" homeHref="/" labels={labels} />);
  await waitFor(() => expect(screen.getByText("חיפה")).toBeTruthy());
});
