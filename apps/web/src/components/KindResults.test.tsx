import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StageLevel } from "@darb/stage";
import { stageStore } from "@/lib/stage-store";

// The layout stays mounted under the business sheet: the path changes, the list does not.
let pathname = "/en/sakhnin/food/restaurants";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
const { KindResults } = await import("./KindResults");

const row = (key: string, extra: object = {}) => ({
  key,
  name: key,
  tagline: "",
  href: `/en/sakhnin/food/restaurants/${key}`,
  example: true,
  openNow: true,
  hours: null,
  placeName: null,
  lat: 32.86,
  lng: 35.3,
  distance: null,
  ...extra,
});
const labels = {
  businesses: "Businesses",
  filters: "Filters",
  openNow: "Open now",
  delivers: "Delivers",
  nearMe: "Near me",
  locating: "Finding you…",
  locationDenied: "Location is off.",
  showMore: "Show more",
  unreachable: "Can't reach Darb.",
  filterNoResults: "Nothing here matches these filters yet.",
  nothingOpen: "Nothing is open right now.",
  includeClosed: "Show them all, open or closed",
  rows: { example: "Example", openNow: "Open now", closed: "Closed" },
};
const props = {
  locale: "en" as const,
  place: "sakhnin",
  kind: "restaurants",
  stagePlace: { slug: "sakhnin", name: "Sakhnin", lat: 32.86, lng: 35.3 },
  initialRows: [row("a"), row("b")],
  initialCursor: "c1",
  deliversAvailable: true,
  labels,
};
const pins = () =>
  ((stageStore.get() as Extract<StageLevel, { depth: 3 }>).pins ?? []).map((p) => p.key);
const sent = (fetchMock: ReturnType<typeof vi.fn>, i: number) =>
  JSON.parse(String((fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].body));

beforeEach(() => {
  pathname = "/en/sakhnin/food/restaurants";
  window.history.replaceState(null, "", pathname);
});
afterEach(() => {
  vi.unstubAllGlobals();
  stageStore.set(null);
});

describe("KindResults", () => {
  it("publishes a pin per row", () => {
    render(<KindResults {...props} />);
    expect(pins()).toEqual(["a", "b"]);
  });
  it("filters open now in place, writes it to the URL, and moves the pins (M6)", async () => {
    const fetchMock = vi.fn(async () => Response.json({ rows: [row("b")], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(<KindResults {...props} />);
    const open = screen.getByRole("button", { name: "Open now" });
    expect(open.getAttribute("aria-pressed")).toBe("false");
    await act(async () => fireEvent.click(open));
    expect(open.getAttribute("aria-pressed")).toBe("true");
    expect(sent(fetchMock, 0)).toEqual({
      locale: "en",
      place: "sakhnin",
      kind: "restaurants",
      open: true,
      delivers: false,
    });
    expect(window.location.search).toBe("?open=1");
    await waitFor(() => expect(pins()).toEqual(["b"]));
  });
  it("adds Show more rows to the list and to the map", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ rows: [row("c")], nextCursor: null })),
    );
    render(<KindResults {...props} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Show more" })));
    await waitFor(() => expect(pins()).toEqual(["a", "b", "c"]));
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
  it("sorts by distance after Near me, with a rounded point that never enters the URL", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 32.86449, longitude: 35.30111 } } as GeolocationPosition),
      },
    });
    const fetchMock = vi.fn(async () =>
      Response.json({ rows: [row("b", { distance: "0.4 km" })], nextCursor: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<KindResults {...props} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Near me" })));
    expect(sent(fetchMock, 0).near).toEqual({ lat: 32.864, lng: 35.301 });
    expect(window.location.search).toBe("");
    await waitFor(() => expect(screen.getByText("0.4 km")).toBeTruthy());
  });
  it("offers Delivers only for kinds that have it, and reads filters from the URL", async () => {
    window.history.replaceState(null, "", "/en/sakhnin/beauty/barbershops?open=1");
    const fetchMock = vi.fn(async () => Response.json({ rows: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(<KindResults {...props} kind="barbershops" deliversAvailable={false} />);
    expect(screen.queryByRole("button", { name: "Delivers" })).toBeNull();
    await waitFor(() => expect(sent(fetchMock, 0).open).toBe(true));
    await waitFor(() => expect(screen.getByText("Nothing is open right now.")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Open now" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
  it("when nothing is open, offers the same kind open or closed, back in the URL and on the map", async () => {
    window.history.replaceState(null, "", "/en/sakhnin/food/restaurants?open=1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ rows: [], nextCursor: null })),
    );
    render(<KindResults {...props} />);
    await waitFor(() => expect(pins()).toEqual([]));
    await act(async () =>
      fireEvent.click(await screen.findByRole("button", { name: "Show them all, open or closed" })),
    );
    expect(window.location.search).toBe("");
    expect(pins()).toEqual(["a", "b"]);
    expect(screen.getByRole("button", { name: "Show more" })).toBeTruthy();
  });
  it("says nothing matches when other filters emptied the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ rows: [], nextCursor: null })),
    );
    render(<KindResults {...props} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delivers" })));
    expect(window.location.search).toBe("?delivers=1");
    await waitFor(() =>
      expect(screen.getByText("Nothing here matches these filters yet.")).toBeTruthy(),
    );
    expect(screen.queryByText("Nothing is open right now.")).toBeNull();
  });
  it("puts its filters back in the URL after a business opens and closes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ rows: [row("b")], nextCursor: null })),
    );
    const { rerender } = render(<KindResults {...props} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open now" })));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delivers" })));
    expect(window.location.search).toBe("?open=1&delivers=1");
    // Opening a row (or a pin) navigates to a URL with no query; so does closing the sheet.
    pathname = "/en/sakhnin/food/restaurants/b";
    window.history.pushState(null, "", pathname);
    rerender(<KindResults {...props} />);
    expect(window.location.pathname).toBe("/en/sakhnin/food/restaurants/b");
    expect(window.location.search).toBe("?open=1&delivers=1");
    pathname = "/en/sakhnin/food/restaurants";
    window.history.pushState(null, "", pathname);
    rerender(<KindResults {...props} />);
    expect(window.location.search).toBe("?open=1&delivers=1");
    expect(screen.getByRole("button", { name: "Open now" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
  it("applies Near me with the filters as they are when the position arrives", async () => {
    let answer: PositionCallback = () => {};
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition: (ok: PositionCallback) => void (answer = ok) },
    });
    const fetchMock = vi.fn(async () => Response.json({ rows: [row("b")], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(<KindResults {...props} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Near me" })));
    // Open now is turned on while the browser is still finding the person.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open now" })));
    await act(async () =>
      answer({ coords: { latitude: 32.86, longitude: 35.3 } } as GeolocationPosition),
    );
    const last = sent(fetchMock, fetchMock.mock.calls.length - 1);
    expect(last.open).toBe(true);
    expect(last.near).toEqual({ lat: 32.86, lng: 35.3 });
  });
});
