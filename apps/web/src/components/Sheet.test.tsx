import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const { cycleSnap, nextSnap, Sheet, snapFromDrag } = await import("./Sheet");

beforeEach(() => {
  document.body.innerHTML = `
    <a class="skip-link" href="#main">Skip</a>
    <header id="site-header"><a href="/">home</a></header>
    <div id="city-bar"></div>
    <div id="city-list"><h1 id="main-heading" tabindex="-1">List</h1>
      <a href="/x" data-business-link="sakhnin/samers-barbershop">Samer's</a></div>`;
});
afterEach(() => push.mockReset());

const sheet = () => (
  <Sheet
    closeHref="/sakhnin/beauty/barbershops"
    labelledBy="sheet-title"
    returnFocusTo="sakhnin/samers-barbershop"
    labels={{
      close: "Close",
      resize: { peek: "Resize, small", half: "Resize, half", full: "Resize, full" },
    }}
  >
    <h2 id="sheet-title">Samer's</h2>
    <a href="https://wa.me/1">WhatsApp</a>
    <button type="button">Share</button>
  </Sheet>
);

const renderSheet = () =>
  render(sheet(), { container: document.body.appendChild(document.createElement("div")) });

describe("Sheet", () => {
  it("opens as a labelled modal dialog with focus on close and the city inert", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("sheet-title");
    expect(document.activeElement?.getAttribute("data-sheet-close")).toBe("");
    for (const id of ["site-header", "city-bar", "city-list"])
      expect(document.getElementById(id)?.hasAttribute("inert")).toBe(true);
    expect(document.querySelector(".skip-link")?.hasAttribute("inert")).toBe(true);
    expect(dialog.getAttribute("tabindex")).toBe("-1");
  });

  it("lives at the end of <body>, outside the city, so it stacks above the site header", () => {
    renderSheet();
    expect(document.querySelector("[data-sheet]")?.parentElement).toBe(document.body);
    expect(document.body.lastElementChild?.hasAttribute("data-sheet")).toBe(true);
  });

  it("hydrates where the server rendered it, then moves to <body> with focus and the city inert", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");
    const city = document.body.appendChild(document.createElement("div"));
    city.id = "city";
    city.innerHTML = renderToString(sheet());
    expect(city.querySelector("[data-sheet]")).not.toBeNull();
    const errors: unknown[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((e) => errors.push(e));
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(city, sheet(), { onRecoverableError: (e) => errors.push(e) });
    });
    consoleError.mockRestore();
    expect(errors).toEqual([]);
    expect(city.querySelector("[data-sheet]")).toBeNull();
    expect(document.querySelectorAll("[data-sheet]")).toHaveLength(1);
    expect(document.querySelector("[data-sheet]")?.parentElement).toBe(document.body);
    expect(document.activeElement?.getAttribute("data-sheet-close")).toBe("");
    for (const id of ["site-header", "city-list", "city"])
      expect(document.getElementById(id)?.hasAttribute("inert")).toBe(true);
    act(() => root?.unmount());
    expect(document.querySelector("[data-sheet]")).toBeNull();
    expect(document.getElementById("city")?.hasAttribute("inert")).toBe(false);
  });

  it("makes every sibling of the sheet and its ancestors inert, and restores them", () => {
    const already = document.createElement("div");
    already.setAttribute("inert", "");
    document.body.appendChild(already);
    const { unmount } = renderSheet();
    const sheet = document.querySelector("[data-sheet]")!;
    for (
      let node: Element | null = sheet;
      node && node !== document.body;
      node = node.parentElement
    )
      for (const sibling of node.parentElement?.children ?? [])
        if (sibling !== node) expect(sibling.hasAttribute("inert")).toBe(true);
    expect(sheet.hasAttribute("inert")).toBe(false);
    unmount();
    expect(document.querySelector(".skip-link")?.hasAttribute("inert")).toBe(false);
    expect(already.hasAttribute("inert")).toBe(true);
  });

  it("closes on Escape pressed anywhere in the document", () => {
    renderSheet();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(push).toHaveBeenCalledWith("/sakhnin/beauty/barbershops", { scroll: false });
  });

  it("closes on Escape by going to the kind level without scrolling", () => {
    renderSheet();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(push).toHaveBeenCalledWith("/sakhnin/beauty/barbershops", { scroll: false });
  });

  it("closes from the close button", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(push).toHaveBeenCalledWith("/sakhnin/beauty/barbershops", { scroll: false });
  });

  it("traps Tab inside the dialog in both directions", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    const share = screen.getByRole("button", { name: "Share" });
    share.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement?.getAttribute("data-sheet-handle")).toBe("");
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(share);
  });

  it("gives focus back to the row that opened it and lifts inert when it closes", () => {
    const { unmount } = renderSheet();
    unmount();
    expect(document.activeElement?.getAttribute("data-business-link")).toBe(
      "sakhnin/samers-barbershop",
    );
    expect(document.getElementById("city-list")?.hasAttribute("inert")).toBe(false);
  });

  it("falls back to the page heading when the row is not on the page", () => {
    document.querySelector("[data-business-link]")?.remove();
    const { unmount } = renderSheet();
    unmount();
    expect(document.activeElement?.id).toBe("main-heading");
  });

  it("moves between snap points from the keyboard", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    const handle = screen.getByRole("button", { name: "Resize, half" });
    expect(dialog.getAttribute("data-snap")).toBe("half");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(dialog.getAttribute("data-snap")).toBe("full");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(dialog.getAttribute("data-snap")).toBe("peek");
    expect(handle.getAttribute("aria-label")).toBe("Resize, small");
  });

  it("cycles the snap points with Enter and Space and names the current one", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    const handle = screen.getByRole("button", { name: "Resize, half" });
    fireEvent.keyDown(handle, { key: "Enter" });
    expect(dialog.getAttribute("data-snap")).toBe("full");
    expect(handle.getAttribute("aria-label")).toBe("Resize, full");
    fireEvent.keyDown(handle, { key: " " });
    expect(dialog.getAttribute("data-snap")).toBe("peek");
    fireEvent.keyDown(handle, { key: "Enter" });
    expect(dialog.getAttribute("data-snap")).toBe("half");
  });
});

describe("snap rules", () => {
  it("cycles peek, half, full and round again", () => {
    expect(cycleSnap("peek")).toBe("half");
    expect(cycleSnap("half")).toBe("full");
    expect(cycleSnap("full")).toBe("peek");
  });
  it("steps and clamps", () => {
    expect(nextSnap("half", 1)).toBe("full");
    expect(nextSnap("full", 1)).toBe("full");
    expect(nextSnap("peek", -1)).toBe("peek");
  });
  it("follows a drag past 60 px", () => {
    expect(snapFromDrag("half", -80)).toBe("full");
    expect(snapFromDrag("half", 80)).toBe("peek");
    expect(snapFromDrag("half", 30)).toBe("half");
  });
});

function stubDesktop() {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: media === "(min-width: 900px)",
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("Sheet on desktop", () => {
  beforeEach(stubDesktop);
  afterEach(() => vi.unstubAllGlobals());

  it("is a non-modal side panel: no scrim, nothing inert", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    expect(dialog.hasAttribute("aria-modal")).toBe(false);
    expect(document.querySelector("[data-sheet] > [aria-hidden='true']")).toBeNull();
    for (const id of ["site-header", "city-bar", "city-list"])
      expect(document.getElementById(id)?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement?.getAttribute("data-sheet-close")).toBe("");
  });

  it("still loops Tab inside the panel", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    screen.getByRole("button", { name: "Share" }).focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement?.getAttribute("data-sheet-handle")).toBe("");
  });

  it("gives focus back to its row on close", () => {
    const { unmount } = renderSheet();
    unmount();
    expect(document.activeElement?.getAttribute("data-business-link")).toBe(
      "sakhnin/samers-barbershop",
    );
  });
});

it("ignores an Escape that something else already handled", () => {
  renderSheet();
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  event.preventDefault();
  document.body.dispatchEvent(event);
  expect(push).not.toHaveBeenCalled();
});
