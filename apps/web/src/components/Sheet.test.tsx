import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const { nextSnap, Sheet, snapFromDrag } = await import("./Sheet");

beforeEach(() => {
  document.body.innerHTML = `
    <header id="site-header"><a href="/">home</a></header>
    <div id="city-bar"></div>
    <div id="city-list"><h1 id="main-heading" tabindex="-1">List</h1>
      <a href="/x" data-business-link="sakhnin/samers-barbershop">Samer's</a></div>`;
});
afterEach(() => push.mockReset());

const renderSheet = () =>
  render(
    <Sheet
      closeHref="/sakhnin/beauty/barbershops"
      labelledBy="sheet-title"
      returnFocusTo="sakhnin/samers-barbershop"
      labels={{ close: "Close", resize: "Resize" }}
    >
      <h2 id="sheet-title">Samer's</h2>
      <a href="https://wa.me/1">WhatsApp</a>
      <button type="button">Share</button>
    </Sheet>,
    { container: document.body.appendChild(document.createElement("div")) },
  );

describe("Sheet", () => {
  it("opens as a labelled modal dialog with focus on close and the city inert", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("sheet-title");
    expect(document.activeElement?.getAttribute("data-sheet-close")).toBe("");
    for (const id of ["site-header", "city-bar", "city-list"])
      expect(document.getElementById(id)?.hasAttribute("inert")).toBe(true);
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
    const handle = screen.getByRole("button", { name: "Resize" });
    expect(dialog.getAttribute("data-snap")).toBe("half");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(dialog.getAttribute("data-snap")).toBe("full");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(dialog.getAttribute("data-snap")).toBe("peek");
  });
});

describe("snap rules", () => {
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
