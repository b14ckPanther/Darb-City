import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { LocationPickerProps } from "@/components/LocationPicker";

const placePoint = vi.fn(async (slug: string) =>
  slug === "sakhnin" ? { lat: 32.86, lng: 35.3 } : null,
);
vi.mock("./business-actions", () => ({ placePoint: (slug: string) => placePoint(slug) }));
const locatePlace = vi.fn(async (_input: { placeSlug?: string }) => ({
  found: { point: { lat: 32.8206, lng: 34.9929 }, precision: "street" as const, label: "x" },
  alternatives: [],
  address: "שדרות המגינים 68",
  googleLink: "https://www.google.com/maps/place/x",
}));
vi.mock("./locate-actions", () => ({
  locatePlace: (input: { placeSlug?: string }) => locatePlace(input),
}));
// The picker itself has its own tests: here only what the form hands it matters.
const seen: LocationPickerProps[] = [];
vi.mock("@/components/LocationPicker", () => ({
  LocationPicker: (props: LocationPickerProps) => {
    seen.push(props);
    return <input type="hidden" name="lat" value={props.value?.lat ?? ""} />;
  },
}));
const { BusinessLocation } = await import("./BusinessLocation");

const labels = {} as LocationPickerProps["labels"];

it("an existing business opens on its saved point", () => {
  render(
    <form>
      <BusinessLocation
        locale="en"
        legend="Location on the map"
        value={{ lat: 32.92, lng: 35.08 }}
        followPlace={false}
        labels={labels}
      />
    </form>,
  );
  expect(screen.getByRole("group", { name: "Location on the map" })).toBeTruthy();
  expect(seen.at(-1)!.value).toEqual({ lat: 32.92, lng: 35.08 });
});

it("a new business's map opens over the place typed into the form", async () => {
  render(
    <form>
      <input name="place" aria-label="Place" />
      <BusinessLocation
        locale="en"
        legend="Location on the map"
        value={null}
        followPlace
        labels={labels}
      />
    </form>,
  );
  const place = screen.getByLabelText("Place");
  fireEvent.change(place, { target: { value: "nowhere" } });
  await waitFor(() => expect(placePoint).toHaveBeenCalledWith("nowhere"));
  expect(seen.at(-1)!.near).toBeNull();
  fireEvent.change(place, { target: { value: "sakhnin" } });
  await waitFor(() => expect(seen.at(-1)!.near).toEqual({ lat: 32.86, lng: 35.3 }));
  expect(seen.at(-1)!.value).toBeNull();
});

it("finding the place moves the pin, flies there, and fills the empty address and the Google link", async () => {
  render(
    <form>
      <input name="place" aria-label="Place" defaultValue="haifa" />
      <input name="address.he" aria-label="Address he" defaultValue="" />
      <input name="address.ar" aria-label="Address ar" defaultValue="موجود" />
      <input name="links.google" aria-label="Google" defaultValue="" />
      <BusinessLocation
        locale="en"
        legend="Location on the map"
        value={null}
        followPlace
        labels={labels}
      />
    </form>,
  );
  fireEvent.change(screen.getByLabelText("Find the place"), {
    target: { value: "https://maps.app.goo.gl/x" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find" }));
  await waitFor(() => expect(seen.at(-1)!.value).toEqual({ lat: 32.8206, lng: 34.9929 }));
  expect(locatePlace).toHaveBeenLastCalledWith(expect.objectContaining({ placeSlug: "haifa" }));
  expect(seen.at(-1)!.flyTo).toEqual({ point: { lat: 32.8206, lng: 34.9929 }, key: 1 });
  expect((screen.getByLabelText("Google") as HTMLInputElement).value).toBe(
    "https://www.google.com/maps/place/x",
  );
  fireEvent.click(screen.getByRole("button", { name: /as the street address/ }));
  expect((screen.getByLabelText("Address he") as HTMLInputElement).value).toBe("שדרות המגינים 68");
  expect((screen.getByLabelText("Address ar") as HTMLInputElement).value).toBe("موجود");
});
