import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let pathname = "/sakhnin";
let failOnMount = false;
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (loader: () => Promise<ComponentType<Record<string, unknown>>>) => {
      const Lazy = React.lazy(async () => ({ default: await loader() }));
      return (props: Record<string, unknown>) =>
        React.createElement(React.Suspense, { fallback: null }, React.createElement(Lazy, props));
    },
  };
});
vi.mock("@/stage/Stage", async () => {
  const React = await import("react");
  return {
    Stage: ({ onFail }: { onFail: () => void }) => {
      React.useEffect(() => {
        if (failOnMount) onFail();
      }, [onFail]);
      return React.createElement("div", { "data-testid": "stage" });
    },
  };
});
const { StageMount } = await import("./StageMount");

const html = document.documentElement;
const labels = {
  map: "Map",
  plaza: "{place}",
  showMap: "Map",
  showList: "List",
  mapData: "Map data",
  businessCount: "Businesses: {count}",
  backToList: "Back to the list",
  openBusiness: "View",
  close: "Close",
  openNow: "Open now",
  closed: "Closed",
  byAppointment: "By appointment",
  distanceKm: "{km} km",
  distanceM: "{m} m",
  loadingPins: "Putting them on the map",
};
const mount = () => render(<StageMount locale="en" labels={labels} />);
const settle = () => new Promise((resolve) => setTimeout(resolve, 600));

beforeEach(() => {
  pathname = "/sakhnin";
  failOnMount = false;
  html.setAttribute("data-stage-capable", "");
  html.setAttribute("data-stage", "on");
});
afterEach(() => {
  html.removeAttribute("data-stage-capable");
  html.removeAttribute("data-stage");
});

it("loads the stage after the page loads and the browser is idle", async () => {
  mount();
  expect(screen.queryByTestId("stage")).toBeNull();
  expect(await screen.findByTestId("stage", {}, { timeout: 2000 })).toBeTruthy();
  expect(html.getAttribute("data-stage")).toBe("on");
  expect(document.getElementById("stage")?.hasAttribute("data-stage-root")).toBe(true);
});

it("never loads it on a device the boot script did not mark", async () => {
  html.removeAttribute("data-stage-capable");
  html.removeAttribute("data-stage");
  mount();
  await settle();
  expect(screen.queryByTestId("stage")).toBeNull();
  expect(html.hasAttribute("data-stage")).toBe(false);
});

it("keeps it off on the marketing page", async () => {
  pathname = "/en/for-business";
  mount();
  await settle();
  expect(screen.queryByTestId("stage")).toBeNull();
  expect(html.getAttribute("data-stage")).toBe("off");
});

it("hands the city back to the list when the stage fails", async () => {
  failOnMount = true;
  mount();
  await settle();
  await vi.waitFor(() => expect(html.getAttribute("data-stage")).toBe("off"));
  expect(screen.queryByTestId("stage")).toBeNull();
});
