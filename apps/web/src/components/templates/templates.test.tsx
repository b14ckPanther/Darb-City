import { render } from "@testing-library/react";
import { TEMPLATES } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import { describe, expect, it, vi } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import { parseScreen, TEMPLATE_BODIES } from "./index";
import { ScreenView } from "./ScreenView";

const screen: ScreenDto = {
  brand: { he: "המספרה של סאמר", en: "Samer's Barbershop" },
  title: { he: "תור בשתי לחיצות", en: "A chair in two taps" },
  subtitle: { he: "היום", en: "Today" },
  tags: [{ en: "16:00" }, { en: "16:30" }],
  items: [
    { label: { he: "תספורת", en: "Haircut" }, meta: { en: "₪60 · 30 min" } },
    { label: { he: "תספורת וזקן", en: "Cut and beard" } },
  ],
  cta: { en: "Book" },
  palette: { bg: "#efe3cf", surface: "#fbf5ea", ink: "#2b1d14", accent: "#b4542a" },
  font: "Suez One",
};

describe.each(TEMPLATES)("%s template", (template) => {
  it("renders every item and tag inside its own layout", () => {
    const { container } = render(<ScreenView screen={screen} template={template} locale="en" />);
    const root = container.querySelector(`[data-template="${template}"]`);
    expect(root).not.toBeNull();
    expect(container.querySelectorAll("[data-item]")).toHaveLength(2);
    // A price may be set apart from the rest of its meta (a menu line's price column).
    for (const text of [
      "Samer's Barbershop",
      "A chair in two taps",
      "Haircut",
      "Cut and beard",
      "₪60",
      "30 min",
      "16:00",
    ])
      expect(container.textContent).toContain(text);
  });
  it("draws no empty price column or leader for an item without a meta", () => {
    const bare: ScreenDto = {
      ...screen,
      items: [{ label: { en: "Coffee" } }, { label: { en: "Home food" } }],
    };
    const { container } = render(<ScreenView screen={bare} template={template} locale="en" />);
    for (const item of container.querySelectorAll("[data-item]")) {
      expect(item.querySelector("[data-facts]")).toBeNull();
      expect(item.textContent?.trim()).not.toBe("");
    }
  });
  it("hides every glyph from screen readers", () => {
    const { container } = render(<ScreenView screen={screen} template={template} locale="en" />);
    for (const svg of container.querySelectorAll("svg"))
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
  });
  it("falls back from Arabic to Hebrew, never to blank", () => {
    const { container } = render(<ScreenView screen={screen} template={template} locale="ar" />);
    expect(container.textContent).toContain("המספרה של סאמר");
    expect(container.textContent).toContain("תספורת וזקן");
  });
});

it("has a body for every template", () => {
  expect(Object.keys(TEMPLATE_BODIES).sort()).toEqual([...TEMPLATES].sort());
});

it("parses only valid screens", () => {
  expect(parseScreen(screen)).toEqual(screen);
  expect(parseScreen({ title: { en: "x" } })).toBeNull();
});

describe("palette guard", () => {
  const ink = (palette: ScreenDto["palette"]) => {
    const { container } = render(
      <ScreenView screen={{ ...screen, palette }} template="booking" locale="en" />,
    );
    return (container.firstElementChild as HTMLElement).style.getPropertyValue("--t-ink");
  };
  it("keeps a readable ink", () => {
    expect(ink(screen.palette)).toBe("#2b1d14");
  });
  it("swaps an unreadable ink for black or white", () => {
    expect(ink({ ...screen.palette, ink: "#d8cbb6" })).toBe("#000000");
    expect(ink({ ...screen.palette, bg: "#1a1a2e", ink: "#2b2b40" })).toBe("#ffffff");
  });
});

describe("the item a search matched", () => {
  const caramel: ScreenDto = {
    ...screen,
    items: [
      {
        label: { he: "ארוחות", en: "Meals" },
        meta: { he: "כריכים: שניצל, שווארמה", en: "Sandwiches: schnitzel, shawarma" },
      },
      { label: { he: "שטיפת רכב", en: "Car wash" } },
    ],
  };
  it.each(TEMPLATES)("%s: keys every item by its label and each listed thing", (template) => {
    const { container } = render(<ScreenView screen={caramel} template={template} locale="he" />);
    const keys = [...container.querySelectorAll("[data-item]")].map((el) =>
      el.getAttribute("data-match-keys"),
    );
    expect(keys.some((k) => k?.split(" ").includes("שווארמה"))).toBe(true);
    expect(keys.some((k) => k?.split(" ").includes("car-wash"))).toBe(true);
  });
  it("marks the item named in ?hl= when the screen opens, and nothing without it", () => {
    // jsdom lays nothing out, so it has no scrollIntoView.
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.history.replaceState(null, "", "/akko/food/restaurants/caramel?hl=shawarma");
    try {
      const { container } = render(<ScreenView screen={caramel} template="menu" locale="en" />);
      const marked = container.querySelectorAll("[data-highlight]");
      expect(marked).toHaveLength(1);
      expect(marked[0]?.textContent).toContain("Meals");
      expect(scroll).toHaveBeenCalledWith({ block: "center" });
    } finally {
      window.history.replaceState(null, "", "/");
    }
    const { container } = render(<ScreenView screen={caramel} template="menu" locale="en" />);
    expect(container.querySelectorAll("[data-highlight]")).toHaveLength(0);
  });
});

describe("theme", () => {
  const darb = { bg: "#0E1B15", surface: "#172A21", ink: "#F6EFE0", accent: "#9FB86A" };
  const style = (palette: ScreenDto["palette"]) => {
    const { container } = render(
      <ScreenView screen={{ ...screen, palette }} template="menu" locale="en" />,
    );
    return container.firstElementChild as HTMLElement;
  };
  it("lets a screen in Darb's own palette follow the site, by day and by night", () => {
    const el = style(darb);
    expect(el.getAttribute("data-palette")).toBe("darb");
    expect(el.style.getPropertyValue("--t-bg")).toBe("");
    expect(el.style.getPropertyValue("--night-bg")).toBe("#0E1B15");
    expect(el.style.getPropertyValue("--day-bg")).toBe("#fffdf8");
  });
  it("keeps a business's own palette, with an accent that reads as text on it", () => {
    const el = style(screen.palette);
    expect(el.getAttribute("data-palette")).toBe("own");
    expect(el.style.getPropertyValue("--t-bg")).toBe("#efe3cf");
    expect(
      contrastRatio(el.style.getPropertyValue("--t-accent-ink"), screen.palette.surface),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it("darkens a pale accent for text on paper, and keeps its hue", () => {
    const day = style(darb).style.getPropertyValue("--day-accent-ink");
    expect(contrastRatio(day, "#f5eddc")).toBeGreaterThanOrEqual(4.5);
    expect(day).not.toBe("#14281f");
  });
});
