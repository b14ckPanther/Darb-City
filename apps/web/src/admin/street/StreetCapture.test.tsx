import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { LocationPickerProps } from "@/components/LocationPicker";
import { memoryStore, type QueueStore } from "./queue";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/LocationPicker", () => ({
  LocationPicker: (props: LocationPickerProps) => (
    <button type="button" onClick={() => props.onChange({ lat: 32.8641, lng: 35.3031 })}>
      {props.value ? `pin ${props.value.lat},${props.value.lng}` : "no pin"}
    </button>
  ),
}));
vi.mock("./photo", () => ({ downscale: async (f: Blob) => f }));
let store: QueueStore;
vi.mock("./queue", async (real) => ({
  ...(await real<typeof import("./queue")>()),
  openQueue: async () => store,
}));
const { StreetCapture } = await import("./StreetCapture");

const KINDS = [
  { slug: "bakeries", label: "Bakeries" },
  { slug: "barbershops", label: "Barbershops" },
];
const reply = (status: number, body: object = {}) => Response.json(body, { status });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = memoryStore();
  refresh.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = () => "blob:sign";
  URL.revokeObjectURL = () => undefined;
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback) =>
        ok({
          coords: { latitude: 32.864, longitude: 35.303, accuracy: 12 },
        } as GeolocationPosition),
    },
  });
});

const view = (reading = true) =>
  render(<StreetCapture locale="en" kinds={KINDS} reading={reading} uploads />);
const shoot = () =>
  fireEvent.change(screen.getByLabelText("Photograph the sign"), {
    target: { files: [new File(["jpeg"], "sign.jpg", { type: "image/jpeg" })] },
  });

it("shows the phone's accuracy and fills the form from the sign, never over what was typed", async () => {
  fetchMock.mockResolvedValueOnce(
    reply(200, {
      reading: {
        name: { he: null, ar: "صالون أبو سمير", en: "Abu Samir Salon" },
        phone: "04-674-1234",
        kindSlug: "barbershops",
        confidence: 0.82,
      },
    }),
  );
  view();
  expect(await screen.findByText("Accurate to about 12 m")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Name in A B C letters"), {
    target: { value: "Samir" },
  });
  shoot();
  expect(await screen.findByText(/Filled in from the sign/)).toBeTruthy();
  expect(screen.getByText("How sure the reading is: 82%")).toBeTruthy();
  expect((screen.getByLabelText("Name in A B C letters") as HTMLInputElement).value).toBe("Samir");
  expect((screen.getByLabelText("Name in أ ب ت letters") as HTMLInputElement).value).toBe(
    "صالون أبو سمير",
  );
  expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe("04-674-1234");
  expect((screen.getByLabelText("Kind") as HTMLSelectElement).value).toBe("barbershops");
  expect(fetchMock.mock.calls[0]![0]).toBe("/en/admin/field-api/read");
  expect(screen.getByAltText("The photo of the sign")).toBeTruthy();
});

it("says why the sign was not read and leaves the form to the admin", async () => {
  fetchMock.mockResolvedValueOnce(reply(200, { reading: null, reason: "budget" }));
  view();
  shoot();
  expect(await screen.findByText(/sign readings are used up/)).toBeTruthy();
});

it("never calls the model when reading is off", async () => {
  view(false);
  shoot();
  expect(await screen.findByText(/Reading signs is off/)).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("asks for what is missing before saving", async () => {
  view(false);
  fireEvent.click(screen.getByRole("button", { name: "Save and next shop" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Write the name");
  expect(alert.textContent).toContain("Choose a kind");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("warns about a likely duplicate, then saves as new on a second press", async () => {
  fetchMock.mockResolvedValueOnce(
    reply(200, {
      matches: [
        {
          id: "0190a000-0000-7000-8000-00000000000a",
          name: { en: "Abu Salim" },
          placeSlug: "sakhnin",
          status: "published",
          reason: "name",
          metres: 14,
        },
      ],
    }),
  );
  view(false);
  await screen.findByText("Accurate to about 12 m");
  fireEvent.change(screen.getByLabelText("Name in A B C letters"), {
    target: { value: "Abu Salim" },
  });
  fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "barbershops" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and next shop" }));
  expect(await screen.findByRole("heading", { name: "Maybe already on Darb" })).toBeTruthy();
  const link = screen.getByRole("link", { name: "Abu Salim" });
  expect(link.getAttribute("href")).toBe(
    "/en/admin/businesses/0190a000-0000-7000-8000-00000000000a",
  );
  expect(screen.getByText(/Similar name, 14 m away/)).toBeTruthy();

  fetchMock.mockResolvedValueOnce(reply(201, { id: "x" }));
  fireEvent.click(screen.getByRole("button", { name: "Save as a new shop anyway" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
  expect(url).toBe("/en/admin/field-api/captures");
  expect(JSON.parse(init.body as string)).toMatchObject({
    name: { en: "Abu Salim" },
    kindSlug: "barbershops",
    lat: 32.864,
    lng: 35.303,
    accuracy: 12,
    photo: null,
    locale: "en",
  });
  expect(await screen.findByText("Saved. Ready for the next shop.")).toBeTruthy();
  expect((screen.getByLabelText("Name in A B C letters") as HTMLInputElement).value).toBe("");
  expect(refresh).toHaveBeenCalled();
});

it("keeps a capture in the visible queue while offline, and retries it", async () => {
  view(false);
  await screen.findByText("Accurate to about 12 m");
  fireEvent.change(screen.getByLabelText("Name in א ב ג letters"), {
    target: { value: "מאפיית הכפר" },
  });
  fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "bakeries" } });
  // No answer to the duplicate check and none to the capture: no connection.
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  fireEvent.click(screen.getByRole("button", { name: "Save and next shop" }));
  expect(await screen.findByRole("heading", { name: "Waiting to send" })).toBeTruthy();
  expect(await screen.findByText("Waiting for a connection")).toBeTruthy();
  expect(screen.getByText("מאפיית הכפר")).toBeTruthy();
  expect(await store.all()).toHaveLength(1);

  fetchMock.mockReset();
  fetchMock.mockResolvedValue(reply(201, { id: "x" }));
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(async () => expect(await store.all()).toHaveLength(0));
  await waitFor(() => expect(screen.queryByText("Waiting to send")).toBeNull());
});
