import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Owner, Pager, relativeTime, Status } from "./ui";

it("names one status in the admin's language, with its colour as data", () => {
  render(<Status locale="ar" status="suspended" />);
  const s = screen.getByText("موقوف");
  expect(s.getAttribute("data-status")).toBe("suspended");
});

it("marks an admin edit quietly, and says nothing for a seed-owned row", () => {
  const { container, unmount } = render(<Owner locale="en" editedAt="2026-10-13T10:00:00.000Z" />);
  expect(screen.getByText("Edited in admin")).toBeTruthy();
  unmount();
  const empty = render(<Owner locale="en" editedAt={null} />);
  expect(empty.container.textContent).toBe("");
  expect(container).toBeTruthy();
});

it("says which rows show and disables what leads nowhere", () => {
  render(<Pager locale="en" page={1} size={50} total={120} href={(p) => `/x?page=${p}`} />);
  expect(screen.getByText("1 to 50 of 120")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Previous/ }).getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByRole("link", { name: /Next/ }).getAttribute("href")).toBe("/x?page=2");
});

it("writes short relative times", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  expect(relativeTime("en", "2026-10-19T11:57:00Z", now)).toMatch(/3 min/);
  expect(relativeTime("en", "2026-10-18T12:00:00Z", now)).toMatch(/yesterday/);
});
