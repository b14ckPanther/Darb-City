import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HoursTable, weekSpans } from "./HoursTable";

// Sunday 10:00 in Israel.
const SUNDAY = new Date("2026-10-18T07:00:00Z");
const hours = {
  weekly: {
    "0": [
      { open: "09:00", close: "13:00" },
      { open: "16:00", close: "22:00" },
    ],
    "1": [{ open: "09:00", close: "18:00" }],
    "5": [{ open: "20:00", close: "02:00" }],
  },
  exceptions: [],
};

describe("the visual week", () => {
  it("is a table screen readers read day by day, the bars hidden", () => {
    render(<HoursTable locale="en" todayLabel="Today" hours={hours} at={SUNDAY} />);
    const table = screen.getByRole("table", { name: "Opening hours" });
    const days = within(table).getAllByRole("rowheader");
    expect(days.map((d) => d.textContent)).toEqual([
      "Sunday (Today)",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);
    for (const bar of table.querySelectorAll("tbody td > span > span:first-child"))
      expect(bar.getAttribute("aria-hidden")).toBe("true");
  });

  it("lights today, quiets closed days and shows both shifts of a split day", () => {
    const { container } = render(
      <HoursTable locale="en" todayLabel="Today" hours={hours} at={SUNDAY} />,
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0]!.hasAttribute("data-today")).toBe(true);
    expect(rows[2]!.hasAttribute("data-closed")).toBe(true);
    expect(rows[2]!.textContent).toContain("Closed");
    const sunday = [...rows[0]!.querySelectorAll("[dir=ltr]")].map((s) => s.textContent);
    expect(sunday).toEqual(["09:00-13:00", "16:00-22:00"]);
    expect(rows[0]!.querySelectorAll("[style]")).toHaveLength(2);
  });

  it("draws a shift past midnight on its own day and the next morning", () => {
    expect(weekSpans(hours)[5]).toEqual([[1200, 1440]]);
    expect(weekSpans(hours)[6]).toEqual([[0, 120]]);
    expect(weekSpans(hours)[0]).toEqual([
      [540, 780],
      [960, 1320],
    ]);
  });

  it("says by appointment, or that hours are not listed, instead of a table", () => {
    const { container, unmount } = render(
      <HoursTable
        locale="en"
        todayLabel="Today"
        hours={{ weekly: {}, exceptions: [], byAppointment: true }}
      />,
    );
    expect(container.querySelector("[data-appointment-hours]")?.textContent).toBe("By appointment");
    expect(screen.queryByRole("table")).toBeNull();
    unmount();
    render(<HoursTable locale="he" todayLabel="היום" hours={{ weekly: {}, exceptions: [] }} />);
    expect(screen.getByText("שעות הפתיחה לא צוינו")).toBeTruthy();
  });
});
