import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { LocationPickerProps } from "@/components/LocationPicker";

const placePoint = vi.fn(async (slug: string) =>
  slug === "sakhnin" ? { lat: 32.86, lng: 35.3 } : null,
);
vi.mock("./business-actions", () => ({ placePoint: (slug: string) => placePoint(slug) }));
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
