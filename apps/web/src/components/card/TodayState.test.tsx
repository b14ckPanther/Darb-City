import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { TodayState } from "./TodayState";

afterEach(() => vi.useRealTimers());

const labels = {
  openUntil: "Open until {time}",
  opensAt: "Opens at {time}",
  opensTomorrow: "Opens tomorrow at {time}",
  closedToday: "Closed today",
  openAllDay: "Open 24 hours",
  today: "Today",
};
// Monday: two shifts. Tuesday: closed. Wednesday: a late opening.
const hours = {
  weekly: {
    1: [
      { open: "09:00", close: "13:00" },
      { open: "16:00", close: "24:00" },
    ],
    3: [{ open: "10:00", close: "14:00" }],
  },
  exceptions: [],
};
const at = (iso: string) => new Date(iso).getTime();

it("says until when it is open, and draws today's shifts on the dial", () => {
  vi.useFakeTimers({ now: at("2026-10-12T07:00:00Z") }); // Mon 10:00
  const { container } = render(
    <TodayState hours={hours} renderedAt={at("2026-10-12T07:00:00Z")} labels={labels} />,
  );
  expect(screen.getByText("Open until 13:00")).toBeTruthy();
  expect(container.querySelector("[data-open]")?.getAttribute("data-open")).toBe("true");
  const dial = container.querySelector<HTMLElement>("[aria-hidden]")!;
  // Two shifts on the ring (a minute is a quarter degree) and the hand at 10:00.
  expect(dial.style.getPropertyValue("--ring")).toBe(
    "conic-gradient(transparent 0 135deg, var(--card-accent) 0 195deg,transparent 0 240deg, var(--card-accent) 0 360deg, transparent 0)",
  );
  expect(dial.style.getPropertyValue("--now")).toBe("150deg");
  expect(screen.getByText("09:00–13:00, 16:00–00:00")).toBeTruthy();
});

it("says when it opens between shifts, and a midnight close as 00:00", async () => {
  vi.useFakeTimers({ now: at("2026-10-12T11:00:00Z") }); // Mon 14:00
  render(<TodayState hours={hours} renderedAt={at("2026-10-12T07:00:00Z")} labels={labels} />);
  expect(screen.getByText("Opens at 16:00")).toBeTruthy();
  vi.setSystemTime(at("2026-10-12T13:00:00Z")); // Mon 16:00
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  expect(screen.getByText("Open until 00:00")).toBeTruthy();
});

it("says a closed day is closed, and names tomorrow's opening", () => {
  vi.useFakeTimers({ now: at("2026-10-13T07:00:00Z") }); // Tue 10:00
  render(<TodayState hours={hours} renderedAt={at("2026-10-13T07:00:00Z")} labels={labels} />);
  expect(screen.getByText("Closed today · Opens tomorrow at 10:00")).toBeTruthy();
});

it("first paints the server's moment, so a cached page hydrates cleanly", () => {
  // No effects on the server: the first render uses renderedAt, not the browser's clock.
  vi.useFakeTimers({ now: at("2026-10-13T07:00:00Z") });
  const html = renderToString(
    <TodayState hours={hours} renderedAt={at("2026-10-12T07:00:00Z")} labels={labels} />,
  );
  expect(html).toContain("Open until 13:00");
});
