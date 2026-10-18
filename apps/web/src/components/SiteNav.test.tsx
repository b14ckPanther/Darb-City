import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

// jsdom has no ResizeObserver; the gold pill's measuring is not under test here.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
const { SiteNav } = await import("./SiteNav");

const tabs = [
  { href: "/", label: "Home", match: "home" },
  { href: "/israel", label: "Map", match: "city" },
  { href: "/showroom", label: "Showroom", match: "/showroom" },
];

const current = () =>
  screen
    .getAllByRole("link", { hidden: true })
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent?.replace(/^\d+/, ""));

it.each([
  // The server renders Hebrew pages at their internal /he path (the proxy rewrites them).
  ["/he/showroom", "Showroom"],
  ["/showroom", "Showroom"],
  ["/ar/showroom", "Showroom"],
  ["/he", "Home"],
  ["/he/haifa", "Map"],
  ["/en/haifa", "Map"],
])("%s marks only %s", (path, label) => {
  pathname = path;
  render(<SiteNav tabs={tabs} label="Site" menu="Menu" close="Close" />);
  // Each tab appears twice: the rail and the (closed) phone menu.
  expect(current()).toEqual([label, label]);
});
