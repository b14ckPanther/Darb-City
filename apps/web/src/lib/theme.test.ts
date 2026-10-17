import { afterEach, expect, it, vi } from "vitest";
import { applyTheme, currentTheme, THEME_KEY, themeBootScript, themeCopy } from "./theme";

const html = document.documentElement;
const boot = () => new Function(themeBootScript())();

afterEach(() => {
  html.removeAttribute("data-theme");
  localStorage.clear();
  vi.restoreAllMocks();
});

it("applies a remembered pick before the first paint, and nothing without one", () => {
  boot();
  expect(html.hasAttribute("data-theme")).toBe(false);
  localStorage.setItem(THEME_KEY, "dark");
  boot();
  expect(html.getAttribute("data-theme")).toBe("dark");
  localStorage.setItem(THEME_KEY, "<script>");
  html.removeAttribute("data-theme");
  boot();
  expect(html.hasAttribute("data-theme")).toBe(false);
});

it("survives blocked storage", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(boot).not.toThrow();
  applyTheme("dark");
  expect(html.getAttribute("data-theme")).toBe("dark");
});

it("remembers a pick and reads it back", () => {
  applyTheme("dark");
  expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  expect(currentTheme()).toBe("dark");
  applyTheme("light");
  expect(currentTheme()).toBe("light");
});

it("names the toggle in every language", () => {
  for (const copy of Object.values(themeCopy)) {
    expect(copy.toDark.length).toBeGreaterThan(3);
    expect(copy.toLight.length).toBeGreaterThan(3);
  }
});
