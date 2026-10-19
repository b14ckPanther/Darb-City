import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Icon } from "./icons/Icon";
import { SheetActions, type SheetActionsProps } from "./SheetActions";

afterEach(() => vi.unstubAllGlobals());

const DIRECTIONS = "https://www.google.com/maps/dir/?api=1&destination=1,2";
const base: SheetActionsProps = {
  primary: { kind: "example" },
  ctaLabel: "Book a chair",
  actions: [{ key: "maps", icon: "maps", label: "Maps", href: DIRECTIONS }],
  share: { url: "https://darb.co.il/sakhnin", title: "Samer's" },
  glyphs: { primary: null, actions: [<Icon key="maps" name="maps" />], share: null },
  labels: {
    share: "Share",
    contactWays: "Ways to reach them",
    exampleNotice: "This is an example. This is what your customers would see",
    linkCopied: "Link copied",
    linkCopyFailed: "Couldn't copy the link",
  },
};

it("explains an example instead of contacting anyone, with no code to run", () => {
  const { container } = render(<SheetActions {...base} />);
  const main = container.querySelector("[data-primary-action]")!;
  expect([main.tagName, main.textContent]).toEqual(["SUMMARY", "Book a chair"]);
  const details = main.closest("details")!;
  expect(details.open).toBe(false);
  fireEvent.click(main);
  expect(details.open).toBe(true);
  expect(container.querySelector("[data-sheet-status]")?.textContent).toBe(
    base.labels.exampleNotice,
  );
});

it("opens WhatsApp in a new tab for a real business", () => {
  render(
    <SheetActions
      {...base}
      primary={{ kind: "whatsapp", href: "https://wa.me/972501234567?text=Hi" }}
    />,
  );
  const link = screen.getByRole("link", { name: "Book a chair" });
  expect(link.getAttribute("href")).toBe("https://wa.me/972501234567?text=Hi");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});

it("shows each action as a round icon named by its word; only a call stays in the tab", () => {
  render(
    <SheetActions
      {...base}
      actions={[
        { key: "call", icon: "phone", label: "Call", href: "tel:+97246012345" },
        ...base.actions,
      ]}
      glyphs={{
        ...base.glyphs,
        actions: [<Icon key="call" name="phone" variant="solid" />, ...base.glyphs.actions],
      }}
    />,
  );
  const call = screen.getByRole("link", { name: "Call" });
  expect(call.getAttribute("href")).toBe("tel:+97246012345");
  expect(call.getAttribute("target")).toBeNull();
  expect(screen.getByRole("link", { name: "Maps" }).getAttribute("target")).toBe("_blank");
  expect(screen.queryByRole("link", { name: "WhatsApp" })).toBeNull();
  const icon = call.querySelector("svg")!;
  expect([icon.getAttribute("data-icon"), icon.getAttribute("aria-hidden")]).toEqual([
    "phone",
    "true",
  ]);
  // Solid icons: the outline filled, its inner strokes cut out.
  expect(icon.querySelector("mask")).toBeTruthy();
});

it("draws pictures of buttons in the /join preview: nothing to press or follow", () => {
  render(
    <SheetActions {...base} primary={{ kind: "whatsapp", href: "https://wa.me/1" }} preview />,
  );
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(screen.getByRole("list", { name: "Ways to reach them" }).textContent).toBe("MapsShare");
});

it("copies the link when the device cannot share", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<SheetActions {...base} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() =>
    expect(document.querySelector("[data-share-status]")?.textContent).toBe("Link copied"),
  );
  // The word under the icon says it too.
  expect(screen.getByRole("button", { name: "Link copied" })).toBeTruthy();
  expect(writeText).toHaveBeenCalledWith("https://darb.co.il/sakhnin");
});

it("says the copy failed when the clipboard rejects", async () => {
  const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<SheetActions {...base} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() =>
    expect(document.querySelector("[data-share-status]")?.textContent).toBe(
      "Couldn't copy the link",
    ),
  );
});

it("never claims a copy when there is no clipboard", async () => {
  vi.stubGlobal("navigator", {});
  render(<SheetActions {...base} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() =>
    expect(document.querySelector("[data-share-status]")?.textContent).toBe(
      "Couldn't copy the link",
    ),
  );
});

it("opens an app or directions as the primary link, in a new tab (Task 28)", () => {
  const { unmount } = render(
    <SheetActions {...base} primary={{ kind: "app", href: "https://caramel.darb.co.il/" }} />,
  );
  const app = screen.getByRole("link", { name: "Book a chair" });
  expect([app.getAttribute("href"), app.getAttribute("target")]).toEqual([
    "https://caramel.darb.co.il/",
    "_blank",
  ]);
  unmount();
  render(
    <SheetActions {...base} primary={{ kind: "directions", href: DIRECTIONS }} actions={[]} />,
  );
  expect(screen.getByRole("link", { name: "Book a chair" }).getAttribute("target")).toBe("_blank");
  expect(screen.queryByRole("link", { name: "Maps" })).toBeNull();
});

it("keeps the row tidy: past six ways, the rest fold under More", () => {
  const keys = [
    "call",
    "whatsapp",
    "waze",
    "maps",
    "website",
    "booking",
    "order",
    "email",
  ] as const;
  const actions = keys.map((key, i) => ({
    key,
    icon: "phone" as const,
    label: key,
    href: key === "email" ? "mailto:a@b.co" : `https://x.test/${i}`,
  }));
  const { container } = render(
    <SheetActions
      {...base}
      primary={{ kind: "none" }}
      actions={actions}
      glyphs={{ ...base.glyphs, actions: actions.map(() => null), more: <span /> }}
      labels={{ ...base.labels, more: "More", moreWays: "More ways" }}
    />,
  );
  const more = container.querySelector("[data-more-actions]")!;
  expect(more.querySelector("summary")?.textContent).toBe("More");
  const folded = [...more.querySelectorAll("[data-action]")].map((a) =>
    a.getAttribute("data-action"),
  );
  expect(folded).toEqual(["booking", "order", "email"]);
  // An email opens the mail app in place, never a new tab.
  expect(more.querySelector('[data-action="email"]')?.getAttribute("target")).toBeNull();
});

it("shows every way in the row when there are few", () => {
  const { container } = render(<SheetActions {...base} />);
  expect(container.querySelector("[data-more-actions]")).toBeNull();
});
