import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AdminBusinessDto } from "@darb/contracts";
import { at } from "./copy";

vi.mock("./actions", () => ({ retryTakedown: vi.fn() }));
vi.mock("./business-actions", () => ({ setBusinessStatus: vi.fn(), deleteBusiness: vi.fn() }));
const { StatusActions } = await import("./StatusActions");

const business = {
  id: "b1",
  status: "suspended",
  source: "seed",
} as AdminBusinessDto;

it("shows no warning after a confirmed takedown", () => {
  render(<StatusActions locale="en" business={business} />);
  expect(screen.queryByRole("alert")).toBeNull();
});

it.each(["he", "ar", "en"] as const)(
  "warns in %s, with Retry, when the web did not confirm",
  (locale) => {
    const { unmount } = render(<StatusActions locale={locale} business={business} stale />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(at(locale, "takedownStale"));
    const retry = screen.getByRole("button", { name: at(locale, "retry") });
    const fields = Object.fromEntries(new FormData(retry.closest("form")!));
    expect(fields).toEqual({ locale, entity: "business", id: "b1", back: "page" });
    unmount();
  },
);
