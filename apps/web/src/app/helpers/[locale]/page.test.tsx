import { render, screen } from "@testing-library/react";
import type { HelperMeDto } from "@darb/contracts";
import { afterEach, expect, it, vi } from "vitest";

const session = vi.fn();
const fieldStatus = vi.fn(async () => ({
  status: 200,
  body: { reading: true, uploads: true },
}));
const fieldMine = vi.fn(async () => ({
  status: 200,
  body: { today: 3, total: 3, live: 0, items: [] },
}));
vi.mock("@/helpers/api", () => ({
  helperOrSignIn: session,
  helperApi: async () => ({ field: { status: fieldStatus, mine: fieldMine } }),
  canAdd: (me: HelperMeDto) => me.isAdmin || me.status === "approved",
}));
vi.mock("@/helpers/actions", () => ({
  applyHelper: vi.fn(),
  locateForHelper: vi.fn(),
  fakeHelperSignOut: vi.fn(),
}));
vi.mock("@/admin/mode", () => ({ adminAuthMode: () => "fake" }));
vi.mock("@/lib/api", () => ({
  getTaxonomy: async () => ({
    sectors: [{ kinds: [{ slug: "barbershops", name: { en: "Barbershops" } }] }],
  }),
  getPlaces: async () => [
    {
      id: "0190a000-0000-7000-8000-000000000001",
      slug: "sakhnin",
      type: "city",
      name: { en: "Sakhnin" },
    },
  ],
}));
/** The capture form itself is the admin's (tested there); here only what it is given matters. */
const capture = vi.fn((props: Record<string, unknown>) => (
  <p data-capture={String(props.base)}>capture</p>
));
vi.mock("@/admin/street/StreetCapture", () => ({ StreetCapture: capture }));

const { default: HelperHome } = await import("./page");

afterEach(() => vi.clearAllMocks());

const me = (patch: Partial<HelperMeDto> = {}): HelperMeDto => ({
  status: "none",
  name: null,
  phone: null,
  placeId: null,
  placeName: null,
  note: null,
  credit: false,
  isAdmin: false,
  appliedAt: null,
  ...patch,
});

async function open(m: HelperMeDto | null, status = "ok", locale = "en") {
  session.mockResolvedValue(m ? { status, me: m } : { status });
  render(await HelperHome({ params: Promise.resolve({ locale }) }));
}

it("asks someone who never applied for the one-screen form", async () => {
  await open(me());
  expect(screen.getByRole("heading", { name: "Become a Darb helper" })).toBeTruthy();
  expect(screen.getByLabelText("Your name, as Darb shows it")).toBeTruthy();
  expect(screen.getByLabelText("Your phone")).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Your home town" })).toBeTruthy();
  expect(capture).not.toHaveBeenCalled();
});

it("tells a waiting helper they will hear back, with no tabs", async () => {
  await open(me({ status: "pending", name: "Rami" }));
  expect(screen.getByRole("heading", { name: "Thanks, we will let you know" })).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
});

it("tells a paused helper their access is paused, and keeps My additions in reach", async () => {
  await open(me({ status: "paused" }));
  expect(screen.getByRole("heading", { name: "Your access is paused" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "My additions" }).getAttribute("href")).toBe(
    "/en/helpers/mine",
  );
  expect(capture).not.toHaveBeenCalled();
});

it("opens an approved helper (and an admin) straight into the capture, on the helper routes", async () => {
  await open(me({ status: "approved" }), "ok", "ar");
  expect(capture).toHaveBeenCalledWith(
    expect.objectContaining({ base: "/ar/helpers/field-api", distinct: true, reading: true }),
    undefined,
  );
  expect(screen.getByText("ضفت اليوم: 3 من 40")).toBeTruthy();
  capture.mockClear();
  await open(me({ isAdmin: true }));
  expect(capture).toHaveBeenCalled();
});

it("says so when sign-in is off or Darb cannot be reached", async () => {
  await open(null, "off");
  expect(screen.getByText("Sign in is not set up on this deployment.")).toBeTruthy();
  await open(null, "unavailable");
  expect(screen.getByText("Darb cannot be reached right now. Try again in a moment.")).toBeTruthy();
});
