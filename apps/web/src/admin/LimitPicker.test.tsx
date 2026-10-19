import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { limitChoice } from "./helper-view";
import { LimitPicker } from "./LimitPicker";

const labels = {
  group: "Additions a day",
  hint: "Sign readings follow the same limit.",
  none: "No limit",
  saved: "Daily limit saved.",
};

it("maps a helper's cap to its choice", () => {
  expect(limitChoice(150)).toBe("150");
  expect(limitChoice(500)).toBe("500");
  expect(limitChoice(null)).toBe("none");
});

it("marks the current cap and sends the one pressed, with the helper's id", async () => {
  const action = vi.fn(async (_s: unknown, _fd: FormData) => ({
    ok: true,
    message: null,
    errors: [],
  }));
  render(<LimitPicker action={action} id="h1" locale="en" current="150" labels={labels} />);
  const group = screen.getByRole("group", { name: "Additions a day" });
  expect(group).toBeTruthy();
  expect(screen.getByRole("button", { name: "150" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "No limit" }).getAttribute("aria-pressed")).toBe(
    "false",
  );
  // Pressing the current one sends nothing.
  fireEvent.click(screen.getByRole("button", { name: "150" }));
  fireEvent.click(screen.getByRole("button", { name: "No limit" }));
  await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(Object.fromEntries(action.mock.calls[0]![1])).toEqual({
    id: "h1",
    locale: "en",
    limit: "none",
  });
});

it("shows a refusal next to it", async () => {
  const action = vi.fn(async () => ({
    ok: false,
    message: "The limit was not saved.",
    errors: [],
  }));
  render(<LimitPicker action={action} id="h1" locale="en" current="500" labels={labels} />);
  fireEvent.click(screen.getByRole("button", { name: "150" }));
  expect((await screen.findByRole("alert")).textContent).toContain("The limit was not saved.");
});
