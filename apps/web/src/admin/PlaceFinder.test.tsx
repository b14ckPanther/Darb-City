import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocateAnswer } from "./locate-actions";

const locatePlace =
  vi.fn<(input: { query: string; locale: string; placeSlug?: string }) => Promise<LocateAnswer>>();
vi.mock("./locate-actions", () => ({
  locatePlace: (input: { query: string; locale: string; placeSlug?: string }) => locatePlace(input),
}));
const { PlaceFinder, scriptOf } = await import("./PlaceFinder");

const street = (lat: number, lng: number, near: string) => ({
  point: { lat, lng },
  precision: "street" as const,
  label: "שדרות המגינים, חיפה",
  near,
});

beforeEach(() => locatePlace.mockReset());

const type = (text: string) =>
  fireEvent.change(screen.getByLabelText("Find the place"), { target: { value: text } });

describe("PlaceFinder", () => {
  it("advertises map links, finds on Enter without submitting the form, and says how exact", async () => {
    locatePlace.mockResolvedValueOnce({
      found: {
        point: { lat: 32.8209, lng: 34.9934 },
        precision: "exact",
        label: "שדרות המגינים 68, חיפה",
      },
      alternatives: [],
      address: "שדרות המגינים 68",
      googleLink: null,
    });
    const onFound = vi.fn();
    const submit = vi.fn((e: Event) => e.preventDefault());
    render(
      <form onSubmit={(e) => submit(e.nativeEvent)}>
        <PlaceFinder locale="en" onFound={onFound} placeSlug={() => "haifa"} />
      </form>,
    );
    const field = screen.getByLabelText("Find the place");
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Address, or paste a map link")).toBeTruthy();
    type("שדרות המגינים 68");
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(onFound).toHaveBeenCalledWith({ lat: 32.8209, lng: 34.9934 }));
    expect(locatePlace).toHaveBeenCalledWith({
      query: "שדרות המגינים 68",
      locale: "en",
      placeSlug: "haifa",
    });
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toMatch(/Exact address found/);
  });

  it("lists the parts of a street as buttons, and moves the pin to the one picked", async () => {
    locatePlace.mockResolvedValueOnce({
      found: street(32.8206, 34.9929, "78"),
      alternatives: [street(32.8222, 34.9896, "100")],
      address: "שדרות המגינים 68",
      googleLink: null,
    });
    const onFound = vi.fn();
    render(<PlaceFinder locale="en" onFound={onFound} />);
    type("שדרות המגינים 68 חיפה");
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    await screen.findByText(/Only the street was found\. Drag the pin to the door\./);
    const parts = screen.getAllByRole("button", { pressed: false });
    const first = screen.getByRole("button", { name: /near number 78/, pressed: true });
    expect(first).toBeTruthy();
    expect(parts.map((b) => b.textContent)).toContain("שדרות המגינים, חיפה, near number 100");
    fireEvent.click(screen.getByRole("button", { name: /near number 100/ }));
    expect(onFound).toHaveBeenLastCalledWith({ lat: 32.8222, lng: 34.9896 });
    expect(screen.getByRole("button", { name: /near number 100/, pressed: true })).toBeTruthy();
  });

  it("offers to fill an empty address in the query's language, and keeps a Google link", async () => {
    locatePlace.mockResolvedValueOnce({
      found: {
        point: { lat: 32.8, lng: 35.0 },
        precision: "between",
        label: "עין דור 11, חיפה",
        between: ["9", "13"],
      },
      alternatives: [],
      address: "עין דור 11",
      googleLink: "https://www.google.com/maps/place/x",
    });
    const fill = vi.fn();
    const keep = vi.fn(() => true);
    render(
      <PlaceFinder
        locale="he"
        onFound={vi.fn()}
        canFillAddress={(lang) => lang === "he"}
        onFillAddress={fill}
        onGoogleLink={keep}
      />,
    );
    fireEvent.change(screen.getByLabelText("חיפוש המקום"), { target: { value: "עין דור 11" } });
    fireEvent.click(screen.getByRole("button", { name: "חיפוש" }));
    await screen.findByText(/בין מספר 9 למספר 13/);
    expect(keep).toHaveBeenCalledWith("https://www.google.com/maps/place/x");
    expect(screen.getByText(/הקישור לגוגל מפות נשמר/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /להשתמש ב"עין דור 11" ככתובת/ }));
    expect(fill).toHaveBeenCalledWith("he", "עין דור 11");
    expect(screen.getByText("הכתובת מולאה.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /ככתובת/ })).toBeNull();
  });

  it("says plainly when nothing was found, or the search failed", async () => {
    locatePlace.mockResolvedValueOnce({
      found: null,
      alternatives: [],
      reason: "not-found",
      address: "x 1",
      googleLink: null,
    });
    locatePlace.mockRejectedValueOnce(new Error("down"));
    const onFound = vi.fn();
    render(<PlaceFinder locale="ar" onFound={onFound} />);
    fireEvent.change(screen.getByLabelText("لاقي المكان"), { target: { value: "شارع الجبل 5" } });
    fireEvent.click(screen.getByRole("button", { name: "دوّر" }));
    await screen.findByText(/ما لقينا إشي/);
    fireEvent.click(screen.getByRole("button", { name: "دوّر" }));
    await screen.findByText(/البحث ما زبط/);
    expect(onFound).not.toHaveBeenCalled();
  });
});

it("tells an address's language by its letters", () => {
  expect(scriptOf("שדרות המגינים 68")).toBe("he");
  expect(scriptOf("شارع الجبل 5")).toBe("ar");
  expect(scriptOf("Herzl 5")).toBe("en");
});
