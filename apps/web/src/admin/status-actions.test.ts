// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  businesses: { status: vi.fn(), remove: vi.fn() },
  misc: { release: vi.fn() },
}));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { digest: "NEXT_REDIRECT" });
  }),
  notFound: vi.fn(),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("./api", () => ({ adminApi: async () => api }));
vi.mock("next/navigation", () => nav);
vi.mock("next/cache", () => cache);

const { setBusinessStatus, deleteBusiness } = await import("./business-actions");
const { releaseEntity } = await import("./actions");
import { idle } from "./action-state";
import { at } from "./copy";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const refused = { status: 409, body: { message: "Only drafts can be deleted" } };

beforeEach(() => vi.clearAllMocks());

it("a refused suspend says so in the admin's language, with the API's reason", async () => {
  api.businesses.status.mockResolvedValue({ status: 404, body: { message: "No such business" } });
  for (const locale of ["he", "ar", "en"] as const) {
    const state = await setBusinessStatus(idle, form({ id: "b1", status: "suspended", locale }));
    expect(state.ok).toBe(false);
    expect(state.message).toBe(at(locale, "errStatusNotChanged"));
    expect(state.errors).toEqual(["No such business"]);
  }
  expect(cache.revalidatePath).not.toHaveBeenCalled();
});

it("a suspend the API never answered (down, 5xx) is an alert, not a silent no-op", async () => {
  api.businesses.status.mockRejectedValue(new Error("fetch failed"));
  const state = await setBusinessStatus(
    idle,
    form({ id: "b1", status: "suspended", locale: "he" }),
  );
  expect(state).toEqual({ ok: false, message: at("he", "errStatusNotChanged"), errors: [] });
});

it("a suspend with an ended session goes to sign-in", async () => {
  api.businesses.status.mockResolvedValue({ status: 401, body: { message: "Sign in" } });
  await expect(
    setBusinessStatus(idle, form({ id: "b1", status: "suspended", locale: "ar" })),
  ).rejects.toThrow("NEXT_REDIRECT /ar/admin/sign-in");
});

it("a done suspend refreshes the admin and clears any earlier alert", async () => {
  api.businesses.status.mockResolvedValue({ status: 200, body: {} });
  const state = await setBusinessStatus(
    { ok: false, message: "old", errors: [] },
    form({ id: "b1", status: "suspended", locale: "en" }),
  );
  expect(api.businesses.status).toHaveBeenCalledWith({
    params: { id: "b1" },
    body: { status: "suspended" },
  });
  expect(state).toEqual({ ok: true, message: null, errors: [] });
  expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/[locale]", "layout");
});

it("an unknown status is refused without calling the API", async () => {
  const state = await setBusinessStatus(idle, form({ id: "b1", status: "gone", locale: "en" }));
  expect(state.ok).toBe(false);
  expect(api.businesses.status).not.toHaveBeenCalled();
});

it("a refused delete is an alert; a 401 goes to sign-in; a done one opens the list", async () => {
  api.businesses.remove.mockResolvedValue(refused);
  expect(await deleteBusiness(idle, form({ id: "b1", locale: "en" }))).toEqual({
    ok: false,
    message: at("en", "errNotDeleted"),
    errors: ["Only drafts can be deleted"],
  });
  api.businesses.remove.mockResolvedValue({ status: 401, body: {} });
  await expect(deleteBusiness(idle, form({ id: "b1", locale: "he" }))).rejects.toThrow(
    "NEXT_REDIRECT /admin/sign-in",
  );
  api.businesses.remove.mockResolvedValue({ status: 200, body: { deleted: true } });
  await expect(deleteBusiness(idle, form({ id: "b1", locale: "en" }))).rejects.toThrow(
    "NEXT_REDIRECT /en/admin/businesses",
  );
});

it("a refused return-to-seed is an alert; a 401 goes to sign-in", async () => {
  const fd = (locale: string) => form({ entity: "place", id: "p1", locale });
  api.misc.release.mockResolvedValue({ status: 404, body: { message: "No such place" } });
  expect(await releaseEntity(idle, fd("ar"))).toEqual({
    ok: false,
    message: at("ar", "errNotReleased"),
    errors: ["No such place"],
  });
  api.misc.release.mockRejectedValue(new Error("fetch failed"));
  expect((await releaseEntity(idle, fd("en"))).message).toBe(at("en", "errNotReleased"));
  api.misc.release.mockResolvedValue({ status: 401, body: {} });
  await expect(releaseEntity(idle, fd("en"))).rejects.toThrow("NEXT_REDIRECT /en/admin/sign-in");
  api.misc.release.mockResolvedValue({ status: 200, body: { released: true } });
  expect(await releaseEntity(idle, fd("en"))).toEqual({ ok: true, message: null, errors: [] });
  expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/[locale]", "layout");
});
