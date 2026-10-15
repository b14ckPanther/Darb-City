import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { buildPlaza } from "@darb/stage";
import { PlazaView } from "./PlazaView";

beforeAll(() => {
  // jsdom may lack PointerEvent; React reads pointerType and pointerId from the native event.
  if (!("PointerEvent" in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "";
      }
    }
    vi.stubGlobal("PointerEvent", PointerEventPolyfill);
  }
});

const doors = [
  { slug: "beauty", href: "/sakhnin/beauty", label: "יופי", count: 3, accent: "#d9aaa2" },
  { slug: "food", href: "/sakhnin/food", label: "אוכל", count: 0, accent: "#c9a36b" },
];
const scene = buildPlaza(doors, { width: 390, height: 780, dir: "rtl" });

const view = (onPinchOut = vi.fn()) =>
  render(
    <PlazaView
      scene={scene}
      caption="סח'נין"
      label="סח'נין: קטגוריות"
      countText={String}
      countLabel={(n) => `עסקים: ${n}`}
      parallax={false}
      onPinchOut={onPinchOut}
    />,
  );

it("is a labelled navigation of real links, in the list's order", () => {
  view();
  const nav = screen.getByRole("navigation", { name: "סח'נין: קטגוריות" });
  const links = within(nav).getAllByRole("link");
  expect(links.map((l) => l.getAttribute("href"))).toEqual(["/sakhnin/beauty", "/sakhnin/food"]);
  expect(links[0]!.textContent).toBe("יופיעסקים: 3");
  expect(links[1]!.hasAttribute("data-empty")).toBe(true);
});

it("places each link over its drawn door, in scene coordinates", () => {
  view();
  const item = screen.getAllByRole("link")[0]!.parentElement!;
  expect(item.parentElement!.getAttribute("dir")).toBe("ltr");
  expect(item.style.insetInlineStart).toBe(`${scene.doors[0]!.hit.x}px`);
  expect(item.style.insetBlockStart).toBe(`${scene.doors[0]!.hit.y}px`);
  expect(item.style.inlineSize).toBe(`${scene.doors[0]!.hit.w}px`);
});

it("draws the gate, the streets and the doors as decoration", () => {
  const { container } = view();
  const svg = container.querySelector("svg")!;
  expect(svg.getAttribute("aria-hidden")).toBe("true");
  expect(svg.querySelectorAll("[data-plaza-gate]")).toHaveLength(1);
  expect(svg.querySelectorAll("[data-plaza-street]")).toHaveLength(2);
  expect(svg.querySelectorAll("[data-plaza-frame]")).toHaveLength(2);
});

it("goes up a level when two fingers pinch together", () => {
  const onPinchOut = vi.fn();
  view(onPinchOut);
  const nav = screen.getByRole("navigation");
  fireEvent.pointerDown(nav, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 400 });
  fireEvent.pointerDown(nav, { pointerId: 2, pointerType: "touch", clientX: 300, clientY: 400 });
  fireEvent.pointerMove(nav, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 400 });
  expect(onPinchOut).toHaveBeenCalledTimes(1);
  fireEvent.pointerMove(nav, { pointerId: 2, pointerType: "touch", clientX: 150, clientY: 400 });
  expect(onPinchOut).toHaveBeenCalledTimes(1);
});
