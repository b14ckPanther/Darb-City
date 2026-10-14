import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ShowMore } from "./ShowMore";

afterEach(() => vi.unstubAllGlobals());

const row = (key: string) => ({
  key,
  name: key,
  tagline: "",
  href: `/x/${key}`,
  example: true,
  openNow: null,
  placeName: null,
});
const props = {
  locale: "en" as const,
  place: "israel",
  kind: "barbershops",
  cursor: "c1",
  labels: { showMore: "Show more", unreachable: "Darb can't be reached right now." },
  rowLabels: {
    example: "Example",
    openNow: "Open now",
    closed: "Closed",
    glutenFree: "Gluten-free",
    byAppointment: "By appointment",
  },
};

it("appends the next page and stops at the last one", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ rows: [row("a"), row("b")], nextCursor: "c2" }))
    .mockResolvedValueOnce(Response.json({ rows: [row("c")], nextCursor: null }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ShowMore {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  await waitFor(() => expect(screen.getByText("b")).toBeTruthy());
  expect(String(fetchMock.mock.calls[0]![0])).toBe(
    "/api/businesses?locale=en&place=israel&kind=barbershops&cursor=c1",
  );
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  await waitFor(() => expect(screen.getByText("c")).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

it("says quietly when the API cannot be reached", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
  render(<ShowMore {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  await waitFor(() => expect(screen.getByText("Darb can't be reached right now.")).toBeTruthy());
  expect(screen.getByRole("button", { name: "Show more" })).toBeTruthy();
});
