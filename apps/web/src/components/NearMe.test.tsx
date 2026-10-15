import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

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

function stubLocation(result: "granted" | "denied") {
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) =>
        result === "granted"
          ? ok({ coords: { latitude: 32.85, longitude: 35.34 } } as GeolocationPosition)
          : fail({ code: 1 } as GeolocationPositionError),
    },
  });
}

it("asks for location only when tapped, then goes to the nearest place", async () => {
  stubLocation("granted");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ href: "/arraba" })));
  render(<NearMe locale="he" homeHref="/" labels={labels} />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Near me" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/arraba"));
  expect(fetch).toHaveBeenCalledWith("/api/near", expect.objectContaining({ method: "POST" }));
  const [url, init] = vi.mocked(fetch).mock.calls[0]!;
  // The position travels in the body: URLs land in access logs, bodies do not.
  expect(String(url)).not.toContain("lat=");
  expect(JSON.parse(String(init?.body))).toEqual({ locale: "he", lat: 32.85, lng: 35.34 });
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
  unmount();
  render(<NearMe locale="he" homeHref="/" labels={labels} />);
  await waitFor(() => expect(screen.getByText("חיפה")).toBeTruthy());
});
