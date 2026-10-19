import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminEdit } from "./AdminEdit";

const clearCookies = () =>
  document.cookie.split(";").forEach((c) => {
    document.cookie = `${c.split("=")[0]!.trim()}=; max-age=0; path=/`;
  });
afterEach(clearCookies);

it("shows nothing and loads no editor code without the admin marker", () => {
  const load = vi.fn();
  const { container } = render(<AdminEdit locale="en" id="b1" load={load} />);
  expect(container.innerHTML).toBe("");
  expect(load).not.toHaveBeenCalled();
});

it("ignores a marker that is not exactly set", () => {
  document.cookie = "darb_admin_hint=0; path=/";
  const load = vi.fn();
  const { container } = render(<AdminEdit locale="en" id="b1" load={load} />);
  expect(container.innerHTML).toBe("");
});

it("with the marker, offers Edit and loads the editor only when pressed", async () => {
  document.cookie = "darb_admin_hint=1; path=/";
  const Editor = ({ id }: { id: string }) => <p>editing {id}</p>;
  const load = vi.fn(async () => ({ default: Editor }));
  render(<AdminEdit locale="he" id="b1" load={load} />);
  const button = screen.getByRole("button", { name: "עריכה" });
  expect(load).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByText("editing b1")).toBeTruthy());
  expect(load).toHaveBeenCalledTimes(1);
});
