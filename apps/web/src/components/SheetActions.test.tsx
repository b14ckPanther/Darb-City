import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SheetActions, type SheetActionsProps } from "./SheetActions";

afterEach(() => vi.unstubAllGlobals());

const base: SheetActionsProps = {
  primary: { kind: "example" },
  ctaLabel: "Book a chair",
  secondary: {
    call: null,
    whatsapp: null,
    directions: "https://www.google.com/maps/dir/?api=1&destination=1,2",
    website: null,
    apps: [],
  },
  share: { url: "https://darb.co.il/sakhnin", title: "Samer's" },
  labels: {
    call: "Call",
    whatsapp: "WhatsApp",
    directions: "Directions",
    share: "Share",
    website: "Website",
    exampleNotice: "This is an example — this is what your customers would see",
    linkCopied: "Link copied",
    linkCopyFailed: "Couldn't copy the link",
  },
};

it("explains an example instead of contacting anyone", () => {
  render(<SheetActions {...base} />);
  fireEvent.click(screen.getByRole("button", { name: "Book a chair" }));
  expect(screen.getByRole("status").textContent).toBe(base.labels.exampleNotice);
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

it("shows only the secondary actions that exist", () => {
  render(<SheetActions {...base} secondary={{ ...base.secondary, call: "tel:+97246012345" }} />);
  expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+97246012345");
  expect(screen.queryByRole("link", { name: "WhatsApp" })).toBeNull();
  expect(screen.getByRole("link", { name: "Directions" })).toBeTruthy();
});

it("copies the link when the device cannot share", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<SheetActions {...base} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Link copied"));
  expect(writeText).toHaveBeenCalledWith("https://darb.co.il/sakhnin");
});

it("says the copy failed when the clipboard rejects", async () => {
  const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<SheetActions {...base} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("Couldn't copy the link"),
  );
});

it("never claims a copy when there is no clipboard", async () => {
  vi.stubGlobal("navigator", {});
  render(<SheetActions {...base} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("Couldn't copy the link"),
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
    <SheetActions
      {...base}
      primary={{ kind: "directions", href: base.secondary.directions! }}
      secondary={{ ...base.secondary, directions: null }}
    />,
  );
  expect(screen.getByRole("link", { name: "Book a chair" }).getAttribute("target")).toBe("_blank");
  expect(screen.queryByRole("link", { name: "Directions" })).toBeNull();
});
