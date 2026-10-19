import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { MomentsView } from "./moment-view";

const seen = vi.fn(async (_: { asOf: string; milestone?: number }) => undefined);
vi.mock("./actions", () => ({
  markHelperSeen: (i: { asOf: string; milestone?: number }) => seen(i),
}));
const { Moments } = await import("./Moments");

afterEach(() => seen.mockClear());

const COPY = { label: "A milestone", go: "Keep adding", see: "See them", close: "Close" };
const ASOF = "2026-10-19T09:00:00.000Z";
const MILESTONE = {
  count: 100,
  unit: "businesses you added",
  lines: ["The most in Sakhnin.", "72 of them are on the map because of you."],
};
const show = (view: Partial<MomentsView> = {}) =>
  render(
    <Moments
      view={{ asOf: ASOF, note: null, milestone: null, ...view }}
      seeHref="/en/helpers/mine"
      copy={COPY}
    />,
  );

it("marks the visit seen once as it opens, and shows nothing with nothing to say", () => {
  const { container } = show();
  expect(container.textContent).toBe("");
  expect(seen).toHaveBeenCalledTimes(1);
  expect(seen).toHaveBeenCalledWith({ asOf: ASOF });
});

it("shows the went-live note with a link to the list, gone with its close button", () => {
  show({ note: "3 of yours went live since yesterday." });
  const note = screen.getByRole("status");
  expect(note.textContent).toContain("3 of yours went live since yesterday.");
  expect(screen.getByRole("link", { name: "See them" }).getAttribute("href")).toBe(
    "/en/helpers/mine",
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("status")).toBeNull();
});

it("celebrates a milestone once: marked seen at once, the button focused, one tap away", () => {
  show({ milestone: MILESTONE });
  const dialog = screen.getByRole("dialog", { name: "A milestone" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  // The number is in the page (counting up is drawn over it), with the truthful lines.
  expect(dialog.querySelector("[data-count]")!.textContent).toBe("100");
  expect(dialog.textContent).toContain("The most in Sakhnin.");
  expect(seen).toHaveBeenCalledWith({ asOf: ASOF, milestone: 100 });
  const go = screen.getByRole("button", { name: "Keep adding" });
  expect(document.activeElement).toBe(go);
  fireEvent.click(go);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("closes the milestone with a tap outside the card or Escape", () => {
  show({ milestone: MILESTONE });
  fireEvent.click(screen.getByRole("dialog"));
  expect(screen.queryByRole("dialog")).toBeNull();
  show({ milestone: MILESTONE });
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("a refresh after sending brings a new milestone, never the same one again", () => {
  const { rerender } = show();
  const again = (view: Partial<MomentsView>) =>
    rerender(
      <Moments
        view={{ asOf: ASOF, note: null, milestone: null, ...view }}
        seeHref="/en/helpers/mine"
        copy={COPY}
      />,
    );
  vi.useFakeTimers();
  act(() => again({ milestone: { ...MILESTONE, count: 10 } }));
  // Not over the send stamp: it waits for it to finish.
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => vi.advanceTimersByTime(800));
  vi.useRealTimers();
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Keep adding" }));
  // The same milestone again (the seen mark not landed yet) stays closed.
  act(() => again({ milestone: { ...MILESTONE, count: 10 } }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(seen).toHaveBeenCalledWith({ asOf: ASOF, milestone: 10 });
});
