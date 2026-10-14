import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { at } from "./copy";

const audit = vi.fn(async () => ({ status: 200, body: [] }));
vi.mock("./api", () => ({
  adminApi: async () => ({ misc: { audit } }),
  okOr: (res: { body: unknown }) => res.body,
}));
vi.mock("./actions", () => ({ releaseEntity: vi.fn() }));
const { EntityMeta } = await import("./EntityMeta");

const meta = async (editedAt: string | null, seedSource: boolean) =>
  render(await EntityMeta({ locale: "en", entity: "kind", id: "k1", editedAt, seedSource }));

it("offers Return to seed data for an edited row with seed data behind it", async () => {
  await meta("2026-10-13T10:00:00.000Z", true);
  expect(screen.getByRole("button", { name: at("en", "release") })).toBeTruthy();
});

it("hides it for a row created in admin, and for a row the seed still owns", async () => {
  const { unmount } = await meta("2026-10-13T10:00:00.000Z", false);
  expect(screen.queryByRole("button", { name: at("en", "release") })).toBeNull();
  unmount();
  await meta(null, true);
  expect(screen.queryByRole("button", { name: at("en", "release") })).toBeNull();
});
