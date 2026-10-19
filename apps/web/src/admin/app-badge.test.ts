import { render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AppBadge } from "./AppBadge";
import { syncAppBadge } from "./app-badge";

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { setAppBadge?: unknown }).setAppBadge;
  delete (navigator as { clearAppBadge?: unknown }).clearAppBadge;
});

it("sets the number waiting, and clears it at zero", async () => {
  const nav = { setAppBadge: vi.fn(async () => {}), clearAppBadge: vi.fn(async () => {}) };
  await syncAppBadge(nav, 7);
  expect(nav.setAppBadge).toHaveBeenCalledWith(7);
  await syncAppBadge(nav, 0);
  expect(nav.clearAppBadge).toHaveBeenCalledTimes(1);
  await syncAppBadge(nav, -3);
  expect(nav.clearAppBadge).toHaveBeenCalledTimes(2);
  expect(nav.setAppBadge).toHaveBeenCalledTimes(1);
});

it("does nothing where the browser has no badge, and never throws when it refuses", async () => {
  await expect(syncAppBadge(undefined, 3)).resolves.toBeUndefined();
  await expect(syncAppBadge({}, 3)).resolves.toBeUndefined();
  const refusing = { setAppBadge: vi.fn(async () => Promise.reject(new Error("NotAllowed"))) };
  await expect(syncAppBadge(refusing, 3)).resolves.toBeUndefined();
  // Without clearAppBadge, zero clears through setAppBadge(0).
  const setOnly = { setAppBadge: vi.fn(async () => {}) };
  await syncAppBadge(setOnly, 0);
  expect(setOnly.setAppBadge).toHaveBeenCalledWith(0);
});

it("follows the shell's count once mounted, feature detected", async () => {
  const set = vi.fn(async () => {});
  const clear = vi.fn(async () => {});
  Object.assign(navigator, { setAppBadge: set, clearAppBadge: clear });
  const { rerender } = render(createElement(AppBadge, { count: 4 }));
  await vi.waitFor(() => expect(set).toHaveBeenCalledWith(4));
  rerender(createElement(AppBadge, { count: 0 }));
  await vi.waitFor(() => expect(clear).toHaveBeenCalled());
  delete (navigator as { setAppBadge?: unknown }).setAppBadge;
  // No API at all: rendering is still fine.
  expect(() => render(createElement(AppBadge, { count: 2 }))).not.toThrow();
});
