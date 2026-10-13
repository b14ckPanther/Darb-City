import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
// The map never starts here: the pill is all this test is about.
vi.mock("./city-map", () => ({ CityMap: { create: () => new Promise(() => {}) } }));
const { Stage } = await import("./Stage");
const { stageStore } = await import("@/lib/stage-store");

const labels = {
  map: "Map of Israel",
  plaza: "{place}",
  showMap: "Map",
  showList: "List",
  mapData: "Map data",
  businessCount: "Businesses: {count}",
};

it("the phone's Map/List pill says what it opens and whether it is open", () => {
  render(
    <div id="stage">
      <Stage locale="en" labels={labels} onFail={vi.fn()} />
    </div>,
  );
  const pill = screen.getByRole("button", { name: "Map" });
  expect(pill.getAttribute("aria-controls")).toBe("stage");
  expect(pill.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(pill);
  expect(pill.getAttribute("aria-expanded")).toBe("true");
  expect(pill.textContent).toBe("List");
});

it("the open phone stage puts the city and the header's top bar behind it, not the search bar", () => {
  document.body.innerHTML = `
    <header id="site-header" data-site-header=""><div class="frame">
      <a href="/" data-brand="">Darb</a>
      <div data-search-bar=""><input id="q" /></div>
      <a href="/for-business" data-for-business="">For business</a>
    </div></header>
    <div data-city=""><a href="/sakhnin">Sakhnin</a></div>`;
  const { unmount } = render(<Stage locale="en" labels={labels} onFail={vi.fn()} />, {
    container: document.body.appendChild(document.createElement("div")),
  });
  fireEvent.click(screen.getByRole("button", { name: "Map" }));
  const inert = (selector: string) => document.querySelector(selector)!.hasAttribute("inert");
  expect(document.documentElement.hasAttribute("data-stage-open")).toBe(true);
  expect(inert("[data-city]")).toBe(true);
  expect(inert("[data-brand]")).toBe(true);
  expect(inert("[data-for-business]")).toBe(true);
  expect(inert("[data-search-bar]")).toBe(false);
  expect(inert("#site-header")).toBe(false);
  unmount();
  for (const selector of ["[data-city]", "[data-brand]", "[data-for-business]"])
    expect(inert(selector)).toBe(false);
});

it("offers the pill on search results, so a phone can see their pins, but not on a kind list", () => {
  const place = { slug: "haifa", name: "Haifa", lat: 32.8, lng: 35 };
  stageStore.set({ depth: 3, place, pins: [] });
  try {
    for (const [path, pill] of [
      ["/en/search", 1],
      ["/search", 1],
      ["/haifa/food/bakeries", 0],
    ] as const) {
      pathname = path;
      const { unmount } = render(<Stage locale="en" labels={labels} onFail={vi.fn()} />);
      expect(screen.queryAllByRole("button", { name: "Map" }), path).toHaveLength(pill);
      unmount();
    }
  } finally {
    pathname = "/";
    stageStore.set(null);
  }
});
