import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { AppointmentBadge, ExampleBadge, GlutenFreeBadge, OpenState } from "./Badges";

it("marks a gluten-free kitchen with a leaf the screen reader skips", () => {
  const { container } = render(<GlutenFreeBadge label="Gluten-free" />);
  // The leaf is a CSS mask (no markup, no JS in long lists): the name is the word alone.
  expect(container.querySelector("[data-gluten-free]")?.textContent).toBe("Gluten-free");
});

it("says example and by appointment in words", () => {
  const { container } = render(
    <>
      <ExampleBadge label="Example" />
      <AppointmentBadge label="By appointment" />
    </>,
  );
  expect(container.querySelector("[data-example-badge]")?.textContent).toBe("Example");
  expect(container.querySelector("[data-appointment]")?.textContent).toBe("By appointment");
});

it("says open or closed, and nothing without hours", () => {
  const labels = { open: "Open now", closed: "Closed" };
  const { container, rerender } = render(<OpenState openNow labels={labels} />);
  expect(container.querySelector("[data-open]")?.textContent).toBe("Open now");
  rerender(<OpenState openNow={false} labels={labels} />);
  expect(container.querySelector("[data-open]")?.getAttribute("data-open")).toBe("false");
  rerender(<OpenState openNow={null} labels={labels} />);
  expect(container.textContent).toBe("");
});
