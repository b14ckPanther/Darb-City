import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const token = vi.fn(async () => "t" as string | null);
vi.mock("./auth", () => ({ adminToken: () => token() }));
const update = vi.fn();
const revalidate = vi.fn(async () => ({ status: 200, body: { revalidated: true } }));
const get = vi.fn(async () => ({
  status: 200,
  body: {
    name: { en: "Samer" },
    tagline: {},
    address: {},
    primaryKindId: "k1",
    phone: null,
    whatsapp: null,
    website: null,
    links: {},
    hours: { weekly: {}, exceptions: [] },
    lat: 32.8,
    lng: 35.1,
  },
}));
vi.mock("./api", () => ({
  adminApi: async () => ({
    businesses: { get, update },
    misc: { revalidate },
  }),
}));
const { quickApi } = await import("./quick-proxy");

const ID = "0190a000-0000-7000-8000-00000000abcd";
const post = (action: string, body: object, origin = "http://localhost:3201") =>
  quickApi(
    action,
    new Request(`http://localhost:3201/admin/quick-api/${action}`, {
      method: "POST",
      headers: { origin, host: "localhost:3201", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  token.mockResolvedValue("t");
  update.mockReset();
  revalidate.mockClear();
});

it("answers only its own actions, and writes only from the same site", async () => {
  expect((await post("nope", {})).status).toBe(404);
  expect((await post("save", { id: ID }, "https://evil.test")).status).toBe(403);
});

it("refuses a browser that is not signed in to the admin, whatever its marker says", async () => {
  token.mockResolvedValue(null);
  expect((await post("save", { id: ID, input: {} })).status).toBe(401);
  expect(update).not.toHaveBeenCalled();
});

it("saves only the change, then drops the public page's cached copy", async () => {
  update.mockResolvedValue({ status: 200, body: {} });
  const res = await post("save", {
    id: ID,
    input: {
      name: { en: "Samer" },
      tagline: {},
      address: {},
      primaryKindId: "k1",
      phone: "050-1234567",
      whatsapp: "",
      website: "",
      links: {},
      weekly: {},
      lat: 32.8,
      lng: 35.1,
    },
  });
  expect(res.status).toBe(200);
  expect(update).toHaveBeenCalledWith({ params: { id: ID }, body: { phone: "050-1234567" } });
  expect(revalidate).toHaveBeenCalledWith({
    params: { entity: "business", id: ID },
    body: {},
  });
  expect(await res.json()).toMatchObject({ ok: true, changed: true, revalidated: true });
});
