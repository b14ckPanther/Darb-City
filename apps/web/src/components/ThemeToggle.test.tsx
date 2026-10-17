import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { THEME_KEY } from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

const html = document.documentElement;
afterEach(() => {
  html.removeAttribute("data-theme");
  localStorage.clear();
});

it("switches day to night and back, names what it does and remembers the pick", () => {
  render(<ThemeToggle toDark="Night" toLight="Day" />);
  const button = screen.getByRole("button", { name: "Night" });
  fireEvent.click(button);
  expect(html.getAttribute("data-theme")).toBe("dark");
  expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  expect(screen.getByRole("button", { name: "Day" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Day" }));
  expect(html.getAttribute("data-theme")).toBe("light");
  expect(localStorage.getItem(THEME_KEY)).toBe("light");
});
