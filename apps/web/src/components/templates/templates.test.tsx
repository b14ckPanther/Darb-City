import { render } from "@testing-library/react";
import { TEMPLATES } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
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
    for (const text of [
      "Samer's Barbershop",
      "A chair in two taps",
      "Haircut",
      "Cut and beard",
      "₪60 · 30 min",
      "16:00",
    ])
      expect(container.textContent).toContain(text);
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
