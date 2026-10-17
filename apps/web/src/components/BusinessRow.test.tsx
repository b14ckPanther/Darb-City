import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import type { BusinessRowData } from "@/lib/rows";
import { BusinessRow } from "./BusinessRow";

const labels = {
  example: "Example",
  openNow: "Open now",
  closed: "Closed",
  glutenFree: "Gluten-free",
  byAppointment: "By appointment",
  distanceKm: "{km} km",
  distanceM: "{m} m",
  locale: "en",
};
const row: BusinessRowData = {
  key: "akko/caramel",
  name: "Caramel",
  tagline: "",
  href: "/en/akko/food/restaurants/caramel",
  example: false,
  openNow: null,
  hours: null,
  placeName: "Akko",
  lat: 32.92,
  lng: 35.07,
  distance: null,
  glutenFree: false,
  byAppointment: false,
  accent: "#5fb3a8",
  logoUrl: null,
};

it("wears the card's accent and the name's first letter", () => {
  const { container } = render(<BusinessRow row={row} labels={labels} />);
  const link = container.querySelector<HTMLElement>("[data-business-link]")!;
  expect(link.style.getPropertyValue("--row-accent")).toBe("#5fb3a8");
  expect(link.querySelector("[aria-hidden]")?.textContent).toBe("C");
  // The link reads as the business, not its letter.
  expect(link.textContent).toContain("Caramel");
});

it("shows the logo small, from a resized source, loaded lazily", () => {
  const logoUrl = "https://media.darb.co.il/pending/0b3c6b1e-6f0e-4d36-9b0e-2f7f8c1d2a10.webp";
  const { container } = render(<BusinessRow row={{ ...row, logoUrl }} labels={labels} />);
  const img = container.querySelector("img")!;
  expect([img.getAttribute("width"), img.getAttribute("loading"), img.getAttribute("alt")]).toEqual(
    ["40", "lazy", ""],
  );
  // 1x and 2x sources, never the 512 px upload.
  const widths = [...img.getAttribute("srcset")!.matchAll(/w=(\d+)/g)].map((m) => Number(m[1]));
  expect(Math.max(...widths)).toBeLessThanOrEqual(128);
});
