import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ActionButton } from "./ActionButton";

it("posts its hidden fields and shows a refusal in an alert", async () => {
  const action = vi.fn(async (_s: unknown, _fd: FormData) => ({
    ok: false,
    message: "The status did not change.",
    errors: ["No such business"],
  }));
  render(
    <ActionButton action={action} fields={{ id: "b1", status: "suspended" }} label="Suspend now" />,
  );
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Suspend now" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The status did not change.");
  expect(alert.textContent).toContain("No such business");
  const fd = action.mock.calls[0]![1];
  expect(Object.fromEntries(fd)).toEqual({ id: "b1", status: "suspended" });
});

it("shows no alert when the action succeeds", async () => {
  const action = vi.fn(async () => ({ ok: true, message: null, errors: [] }));
  render(<ActionButton action={action} fields={{}} label="Publish" />);
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await vi.waitFor(() => expect(action).toHaveBeenCalled());
  expect(screen.queryByRole("alert")).toBeNull();
});

it("celebrates an approval with the gold seal toast, even once the button is gone", async () => {
  const { TOAST_EVENT } = await import("./toast");
  const seen: unknown[] = [];
  const listen = (e: Event) => seen.push((e as CustomEvent).detail);
  window.addEventListener(TOAST_EVENT, listen);
  let finish: (s: { ok: boolean; message: null; errors: string[] }) => void = () => undefined;
  const action = vi.fn(
    () => new Promise<{ ok: boolean; message: null; errors: string[] }>((r) => (finish = r)),
  );
  const { unmount } = render(
    <ActionButton action={action} fields={{}} label="Approve" done="Published." celebrate />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await vi.waitFor(() => expect(action).toHaveBeenCalled());
  // The page's new state (approved) has no Approve button any more.
  unmount();
  finish({ ok: true, message: null, errors: [] });
  await vi.waitFor(() => expect(seen).toEqual([{ message: "Published.", tone: "ok", seal: true }]));
  window.removeEventListener(TOAST_EVENT, listen);
});
