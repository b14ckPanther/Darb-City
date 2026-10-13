import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LiveOpenState } from "./LiveOpenState";

afterEach(() => vi.useRealTimers());
const labels = { open: "Open", closed: "Closed" };
// Tuesday (2), 09:00–19:00 Asia/Jerusalem.
const hours = { weekly: { "2": [{ open: "09:00", close: "19:00" }] }, exceptions: [] };

it("corrects a stale cached Open to Closed in the browser and keeps ticking", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T16:30:00Z")); // 19:30 in Jerusalem: closed
  render(<LiveOpenState openNow={true} hours={hours} labels={labels} />);
  // render() runs effects inside act, so the browser value is already there (findBy* polls on
  // timers, which are fake here).
  expect(screen.getByText("Closed")).toBeTruthy();
  vi.setSystemTime(new Date("2026-10-20T06:59:30Z")); // next Tuesday 09:59:30
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  expect(screen.getByText("Open")).toBeTruthy();
});

it("renders nothing for a business without hours", () => {
  const { container } = render(<LiveOpenState openNow={null} hours={null} labels={labels} />);
  expect(container.textContent).toBe("");
});
