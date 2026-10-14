// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  businesses: { status: vi.fn(), remove: vi.fn() },
  misc: { release: vi.fn(), revalidate: vi.fn() },
  kinds: { get: vi.fn(), update: vi.fn() },
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
const { releaseEntity, retryTakedown, saveKind } = await import("./actions");
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

describe("a takedown the web did not confirm (revalidated: false)", () => {
  it("a suspend goes to the business page with the warning, not a plain success", async () => {
    api.businesses.status.mockResolvedValue({ status: 200, body: { revalidated: false } });
    await expect(
      setBusinessStatus(idle, form({ id: "b1", status: "suspended", locale: "ar" })),
    ).rejects.toThrow("NEXT_REDIRECT /ar/admin/businesses/b1?stale=1");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/[locale]", "layout");
  });
  it("a confirmed suspend stays a plain success", async () => {
    api.businesses.status.mockResolvedValue({ status: 200, body: { revalidated: true } });
    expect(
      await setBusinessStatus(idle, form({ id: "b1", status: "suspended", locale: "he" })),
    ).toEqual({ ok: true, message: null, errors: [] });
  });
  it("a delete opens the list with the warning for that business", async () => {
    api.businesses.remove.mockResolvedValue({
      status: 200,
      body: { deleted: true, revalidated: false },
    });
    await expect(deleteBusiness(idle, form({ id: "b1", locale: "he" }))).rejects.toThrow(
      "NEXT_REDIRECT /admin/businesses?stale=b1",
    );
  });
  it("hiding a kind reloads its page with the warning", async () => {
    const kind = {
      id: "k1",
      slug: "nails",
      sectorId: "s1",
      parentKindId: null,
      name: { he: "ציפורניים" },
      synonyms: { he: [], ar: [], en: [] },
      template: "booking",
      attributes: [],
      icon: null,
      order: 1,
      status: "active",
      businessCount: 0,
      editedAt: null,
    };
    api.kinds.get.mockResolvedValue({ status: 200, body: kind });
    api.kinds.update.mockResolvedValue({
      status: 200,
      body: { ...kind, status: "hidden", revalidated: false },
    });
    const fd = form({
      id: "k1",
      locale: "en",
      sectorId: "s1",
      parentKindId: "",
      "name.he": "ציפורניים",
      "synonyms.he": "",
      "synonyms.ar": "",
      "synonyms.en": "",
      template: "booking",
      attributes: "",
      icon: "",
      order: "1",
      status: "hidden",
    });
    await expect(saveKind(idle, fd)).rejects.toThrow("NEXT_REDIRECT /en/admin/kinds/k1?stale=1");
    expect(api.kinds.update).toHaveBeenCalledWith({
      params: { id: "k1" },
      body: { status: "hidden" },
    });
  });
});

describe("Retry", () => {
  const fd = (locale: string, back = "page") =>
    form({ entity: "business", id: "b1", locale, back });
  it("a confirmed retry returns to the clean page or list", async () => {
    api.misc.revalidate.mockResolvedValue({ status: 200, body: { revalidated: true } });
    await expect(retryTakedown(idle, fd("en"))).rejects.toThrow(
      "NEXT_REDIRECT /en/admin/businesses/b1",
    );
    expect(api.misc.revalidate).toHaveBeenCalledWith({
      params: { entity: "business", id: "b1" },
      body: {},
    });
    await expect(retryTakedown(idle, fd("he", "list"))).rejects.toThrow(
      /NEXT_REDIRECT \/admin\/businesses$/,
    );
  });
  it("a failed retry says so in the admin's language", async () => {
    for (const locale of ["he", "ar", "en"] as const) {
      api.misc.revalidate.mockResolvedValue({ status: 200, body: { revalidated: false } });
      expect(await retryTakedown(idle, fd(locale))).toEqual({
        ok: false,
        message: at(locale, "errNotRevalidated"),
        errors: [],
      });
      api.misc.revalidate.mockRejectedValue(new Error("fetch failed"));
      expect((await retryTakedown(idle, fd(locale))).message).toBe(at(locale, "errNotRevalidated"));
    }
    api.misc.revalidate.mockResolvedValue({ status: 401, body: {} });
    await expect(retryTakedown(idle, fd("ar"))).rejects.toThrow("NEXT_REDIRECT /ar/admin/sign-in");
  });
  it("refuses an unknown entity without calling the API", async () => {
    const state = await retryTakedown(idle, form({ entity: "user", id: "u1", locale: "en" }));
    expect(state.ok).toBe(false);
    expect(api.misc.revalidate).not.toHaveBeenCalled();
  });
});

it("a return-to-seed on an admin-created row says why, in the admin's language", async () => {
  for (const locale of ["he", "ar", "en"] as const) {
    api.misc.release.mockResolvedValue({
      status: 409,
      body: { message: "This was created in admin", code: "no_seed_source" },
    });
    expect(await releaseEntity(idle, form({ entity: "kind", id: "k1", locale }))).toEqual({
      ok: false,
      message: at(locale, "errNotReleased"),
      errors: [at(locale, "errNoSeedSource")],
    });
  }
});
