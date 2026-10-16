import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EMPTY_INTENT } from "@darb/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stageStore } from "@/lib/stage-store";
import type { SearchView } from "@/lib/search-view";
import { SearchResults } from "./SearchResults";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/search",
}));
afterEach(() => {
  vi.unstubAllGlobals();
  stageStore.set(null);
});

const row = (key: string) => ({
  key,
  name: key,
  tagline: "",
  href: `/en/${key}`,
  example: true,
  openNow: true,
  hours: null,
  placeName: null,
  lat: 32.9,
  lng: 35.1,
  distance: null,
  glutenFree: false,
  byAppointment: false,
  accent: "#d6a473",
  logoUrl: null,
});
const view: SearchView = {
  status: "ok",
  q: "knafeh akko open now",
  queryId: "q1",
  intent: { ...EMPTY_INTENT, kinds: ["sweets"], place: "akko", openNow: true },
  needsLocation: false,
  chips: [
    { id: "place:akko", type: "place", label: "Akko" },
    { id: "kind:sweets", type: "kind", label: "Sweets" },
    { id: "openNow", type: "openNow", label: "Open now" },
  ],
  rows: [row("akko/a"), row("akko/b")],
  stage: { depth: 3, place: { slug: "akko", name: "Akko", lat: 32.9, lng: 35.1 }, pins: [] },
  nearest: [],
  narrowest: null,
  withoutOpenNow: null,
};
const labels = {
  removeChip: "Remove {chip}",
  resultCount: "Results: {count}",
  noResults: "Try removing “{chip}”.",
  blocked: "We don't list this kind of business.",
  places: "Places",
  placesHref: "/en#places",
  nearMe: "Near me",
  locating: "Finding you…",
  locationDenied: "Location is off.",
  unreachable: "Can't reach Darb.",
  nearestPlaces: "Nearest places",
  nothingOpen: "Nothing is open right now.",
  rows: {
    example: "Example",
    openNow: "Open now",
    closed: "Closed",
    glutenFree: "Gluten-free",
    byAppointment: "By appointment",
  },
};

describe("SearchResults", () => {
  it("shows chips with named remove buttons, and publishes its pins to the stage", () => {
    render(<SearchResults locale="en" initial={view} labels={labels} />);
    expect(screen.getByRole("button", { name: "Remove Open now" })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(stageStore.get()).toEqual(view.stage);
  });
  it("re-runs retrieval without the removed chip, never the model", async () => {
    const next = {
      ...view,
      intent: { ...view.intent, openNow: false },
      chips: view.chips.slice(0, 2),
      rows: [row("akko/c")],
    };
    const fetchMock = vi.fn(async () => Response.json(next));
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchResults locale="en" initial={view} labels={labels} />);
    window.history.replaceState(null, "", "/en/search?q=knafeh+akko+open+now");
    const historyBefore = window.history.length;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remove Open now" })));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/search/results");
    expect(JSON.parse(String(init.body))).toEqual({
      q: view.q,
      locale: "en",
      intent: { ...view.intent, openNow: false },
    });
    await waitFor(() => expect(screen.getByText("akko/c")).toBeTruthy());
    // The edit is in the URL, replacing this search's entry: Back leaves the search.
    expect(window.location.pathname + window.location.search).toBe(
      "/en/search?q=knafeh+akko+open+now&chips=place:akko,kind:sweets",
    );
    expect(window.history.length).toBe(historyBefore);
    // Focus moves to the results heading, so keyboard users are not left on a removed button.
    expect(document.activeElement?.id).toBe("search-results-title");
  });
  it("shows the blocked state as one calm sentence with a link to the places", () => {
    render(
      <SearchResults
        locale="en"
        initial={{ ...view, status: "blocked", chips: [], rows: [] }}
        labels={labels}
      />,
    );
    const blocked = screen.getByText("We don't list this kind of business.");
    expect(blocked.closest("[data-search-blocked]")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Places" }).getAttribute("href")).toBe("/en#places");
    expect(document.body.textContent).not.toMatch(/halal/i);
  });
  it("suggests removing the narrowest chip when nothing matches", () => {
    render(
      <SearchResults
        locale="en"
        initial={{ ...view, rows: [], narrowest: view.chips[2]! }}
        labels={labels}
      />,
    );
    expect(screen.getByText("Try removing “Open now”.")).toBeTruthy();
  });
  it("quotes free text once when it suggests removing it", () => {
    const text = { id: "text", type: "text" as const, label: "“pistachio”" };
    render(
      <SearchResults
        locale="en"
        initial={{ ...view, rows: [], narrowest: text }}
        labels={labels}
      />,
    );
    expect(screen.getByText("Try removing “pistachio”.")).toBeTruthy();
  });
  it("says nothing is open right now and links the same kind without open now", () => {
    render(
      <SearchResults
        locale="en"
        initial={{
          ...view,
          rows: [],
          narrowest: view.chips[2]!,
          withoutOpenNow: { label: "Sweets in Akko", href: "/en/akko/food/sweets" },
          nearest: [
            { key: "haifa", name: "Haifa", href: "/en/haifa/food/sweets", distance: "30 km" },
          ],
        }}
        labels={labels}
      />,
    );
    expect(screen.getByText("Nothing is open right now.")).toBeTruthy();
    expect(screen.queryByText("Try removing “Open now”.")).toBeNull();
    expect(screen.getByRole("link", { name: "Sweets in Akko" }).getAttribute("href")).toBe(
      "/en/akko/food/sweets",
    );
    expect(screen.getByRole("link", { name: /Haifa/ })).toBeTruthy();
  });
});
