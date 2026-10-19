import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon, type IconName } from "./Icon";

const NAMES: IconName[] = [
  "phone",
  "whatsapp",
  "waze",
  "maps",
  "globe",
  "instagram",
  "facebook",
  "tiktok",
  "share",
  "clock",
  "pin",
  "calendar",
  "app",
  "leaf",
  "chevron",
  "close",
  "linkedin",
  "youtube",
  "x",
  "telegram",
  "mail",
  "bag",
  "delivery",
  "more",
];

describe("the card icons", () => {
  it.each(NAMES)(
    "%s draws on the 24 px grid in both styles, hidden from screen readers",
    (name) => {
      for (const variant of ["line", "solid"] as const) {
        const { container, unmount } = render(<Icon name={name} variant={variant} />);
        const svg = container.querySelector("svg")!;
        expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        expect(svg.querySelectorAll("path").length).toBeGreaterThan(0);
        unmount();
      }
    },
  );

  it("cuts the inner strokes out of a solid icon, each icon with its own mask", () => {
    const { container } = render(
      <>
        <Icon name="clock" variant="solid" />
        <Icon name="clock" variant="solid" />
      </>,
    );
    const masks = [...container.querySelectorAll("mask")].map((m) => m.id);
    expect(masks).toHaveLength(2);
    expect(new Set(masks).size).toBe(2);
    const fill = container.querySelector("svg path[mask]")!;
    expect(fill.getAttribute("mask")).toBe(`url(#${masks[0]})`);
    expect(fill.getAttribute("fill")).toBe("currentColor");
  });

  it("draws a line icon with no fill on its outline", () => {
    const { container } = render(<Icon name="pin" />);
    expect(container.querySelector("mask")).toBeNull();
    expect(container.querySelector("path")!.getAttribute("fill")).toBe("none");
  });

  it("mirrors only icons that point a way", () => {
    const { container } = render(
      <>
        <Icon name="chevron" />
        <Icon name="whatsapp" />
      </>,
    );
    const [chevron, brand] = container.querySelectorAll("svg");
    expect(chevron!.getAttribute("class")).toBeTruthy();
    expect(brand!.getAttribute("class")).toBeNull();
  });
});
