import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LocaleSwitch, PathBar } from "./CityBar";

const crumbs = [
  { label: "Israel", href: "/en" },
  { label: "Sakhnin", href: "/en/sakhnin" },
  { label: "Beauty & care", href: "/en/sakhnin/beauty" },
];

it("marks the current crumb and links up one level", () => {
  const { container } = render(<PathBar locale="en" crumbs={crumbs} />);
  expect(screen.getByText("Beauty & care").getAttribute("aria-current")).toBe("page");
  expect(container.querySelector("[data-up]")?.getAttribute("href")).toBe("/en/sakhnin");
  expect(screen.getByRole("navigation", { name: "You are here" })).toBeTruthy();
});

it("has no up link at the top level", () => {
  const { container } = render(<PathBar locale="en" crumbs={crumbs.slice(0, 1)} />);
  expect(container.querySelector("[data-up]")).toBeNull();
});

it("keeps the path when switching language", () => {
  const { container } = render(<LocaleSwitch locale="ar" segments={["sakhnin", "beauty"]} />);
  const links = [...container.querySelectorAll("a")].map((a) => [
    a.getAttribute("hreflang"),
    a.getAttribute("href"),
  ]);
  expect(links).toEqual([
    ["he", "/sakhnin/beauty"],
    ["ar", "/ar/sakhnin/beauty"],
    ["en", "/en/sakhnin/beauty"],
  ]);
  expect(container.querySelector('[hreflang="ar"]')?.getAttribute("aria-current")).toBe("true");
});
