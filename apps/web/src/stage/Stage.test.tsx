import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));
// The map never starts here: the pill is all this test is about.
vi.mock("./city-map", () => ({ CityMap: { create: () => new Promise(() => {}) } }));
const { Stage } = await import("./Stage");

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
