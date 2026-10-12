import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchOption } from "@/search/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/en/haifa" }));
const OPTIONS: SearchOption[] = [
  { id: "place:haifa", group: "places", label: "Haifa", href: "/en/haifa" },
  { id: "kind:barbershops", group: "kinds", label: "Barbershops", href: "/en/k/barbershops" },
  { id: "search", group: "search", label: "Search for “ha”", href: "/en/search?q=ha" },
];
// The lazy popup, replaced by a synchronous stand-in that reports fixed options.
vi.mock("next/dynamic", async () => {
  const { useEffect } = await import("react");
  return {
    default: () =>
      function Popup(props: {
        listboxId: string;
        onOptions(o: SearchOption[]): void;
        activeId: string | null;
      }) {
        const { onOptions } = props;
        useEffect(() => onOptions(OPTIONS), [onOptions]);
        return (
          <ul role="listbox" id={props.listboxId}>
            {OPTIONS.map((o) => (
              <li
                key={o.id}
                id={`${props.listboxId}-${o.id}`}
                role="option"
                aria-selected={props.activeId === `${props.listboxId}-${o.id}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        );
      },
  };
});
const { SearchBox } = await import("./SearchBox");
const { Sheet } = await import("./Sheet");

const labels = {
  search: "Search",
  placeholder: "What and where?",
  places: "Places",
  kinds: "Kinds",
  businesses: "Businesses",
  searchFor: "Search for “{q}”",
  suggestionCount: "Suggestions: {count}",
  noSuggestions: "None",
};

let sheetSaw: boolean[] = [];
const sheet = (e: KeyboardEvent) => {
  if (e.key === "Escape") sheetSaw.push(e.defaultPrevented);
};
beforeEach(() => {
  sheetSaw = [];
  document.addEventListener("keydown", sheet);
});
afterEach(() => {
  document.removeEventListener("keydown", sheet);
  push.mockReset();
});

const box = () => screen.getByRole("combobox");

describe("SearchBox", () => {
  it("is a labelled combobox that opens a listbox as you type", async () => {
    render(<SearchBox locale="en" labels={labels} />);
    expect(box().getAttribute("aria-expanded")).toBe("false");
    expect(box().getAttribute("aria-autocomplete")).toBe("list");
    fireEvent.focus(box());
    await act(async () => fireEvent.change(box(), { target: { value: "ha" } }));
    expect(box().getAttribute("aria-expanded")).toBe("true");
    expect(box().getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id);
    expect(document.documentElement.hasAttribute("data-search-open")).toBe(true);
  });

  it("moves through options with the arrows, wrapping, and opens the active one on Enter", async () => {
    render(<SearchBox locale="en" labels={labels} />);
    fireEvent.focus(box());
    await act(async () => fireEvent.change(box(), { target: { value: "ha" } }));
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(box().getAttribute("aria-activedescendant")).toContain("place:haifa");
    fireEvent.keyDown(box(), { key: "ArrowUp" });
    expect(box().getAttribute("aria-activedescendant")).toContain("search");
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/en/k/barbershops");
  });

  it("Escape closes, then clears, and only then reaches the sheet (M5)", async () => {
    render(<SearchBox locale="en" labels={labels} />);
    fireEvent.focus(box());
    await act(async () => fireEvent.change(box(), { target: { value: "ha" } }));
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(box().getAttribute("aria-expanded")).toBe("false");
    expect((box() as HTMLInputElement).value).toBe("ha");
    fireEvent.keyDown(box(), { key: "Escape" });
    expect((box() as HTMLInputElement).value).toBe("");
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(sheetSaw).toEqual([true, true, false]);
    expect(document.documentElement.hasAttribute("data-search-open")).toBe(false);
  });

  it("focuses on Ctrl+K or Cmd+K", () => {
    render(<SearchBox locale="en" labels={labels} />);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(box());
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(box());
  });
});

it("keeps an open business sheet open while Escape closes and clears the search (M5)", async () => {
  render(
    <>
      <SearchBox locale="en" labels={labels} />
      <Sheet
        closeHref="/en/haifa/beauty/barbershops"
        labelledBy="sheet-title"
        returnFocusTo="haifa/samers"
        labels={{ close: "Close", resize: { peek: "Peek", half: "Half", full: "Full" } }}
      >
        <h2 id="sheet-title">Samer&apos;s</h2>
      </Sheet>
    </>,
  );
  box().focus();
  fireEvent.focus(box());
  await act(async () => fireEvent.change(box(), { target: { value: "ha" } }));
  fireEvent.keyDown(box(), { key: "Escape" });
  expect(box().getAttribute("aria-expanded")).toBe("false");
  fireEvent.keyDown(box(), { key: "Escape" });
  expect((box() as HTMLInputElement).value).toBe("");
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
  // Only now, with the box empty and closed, does Escape reach the sheet.
  fireEvent.keyDown(box(), { key: "Escape" });
  expect(push).toHaveBeenCalledWith("/en/haifa/beauty/barbershops", { scroll: false });
});
