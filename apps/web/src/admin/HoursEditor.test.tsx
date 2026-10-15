import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { HoursEditor } from "./HoursEditor";

const labels = {
  days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  closed: "Closed",
  add: "Add hours",
  remove: "Remove",
  open: "Opens",
  close: "Closes",
};

it("edits intervals and writes the weekly JSON into the form", () => {
  const { container } = render(
    <HoursEditor weekly={{ "0": [{ open: "09:00", close: "18:00" }] }} labels={labels} />,
  );
  const hidden = () =>
    JSON.parse((container.querySelector('input[name="hours.weekly"]') as HTMLInputElement).value);
  expect(hidden()["0"]).toEqual([{ open: "09:00", close: "18:00" }]);
  fireEvent.click(screen.getAllByRole("button", { name: "Add hours" })[1]!); // Monday
  expect(hidden()["1"]).toEqual([{ open: "09:00", close: "17:00" }]);
  fireEvent.change(screen.getByLabelText("Mon · Closes 1"), { target: { value: "23:00" } });
  expect(hidden()["1"]).toEqual([{ open: "09:00", close: "23:00" }]);
  fireEvent.click(screen.getByRole("button", { name: "Sun · Remove 1" }));
  expect(hidden()["0"]).toEqual([]);
});

it("keeps times left to right, so 17:30 does not read as 30:17 in Hebrew and Arabic", () => {
  render(<HoursEditor weekly={{ "0": [{ open: "09:00", close: "17:30" }] }} labels={labels} />);
  expect(screen.getByLabelText("Sun · Opens 1").getAttribute("dir")).toBe("ltr");
  expect(screen.getByLabelText("Sun · Closes 1").getAttribute("dir")).toBe("ltr");
});
