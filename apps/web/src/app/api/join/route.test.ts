// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const postJoin = vi.fn();
const postJoinLookup = vi.fn();
const postJoinPhoto = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  postJoin,
  postJoinLookup,
  postJoinPhoto,
}));
const { POST: join } = await import("./route");
const { POST: lookup } = await import("./lookup/route");
const { POST: photos } = await import("./photos/route");
const { ApiUnavailableError } = await import("@/lib/api");

afterEach(() => vi.clearAllMocks());

const headers = { "x-forwarded-for": "9.9.9.9, 10.0.0.1" };
const req = (url: string, b: unknown) =>
  new Request(`http://x${url}`, { method: "POST", headers, body: JSON.stringify(b) });

const form = {
  name: { he: "מספרת שלום" },
  kindSlug: "barbershops",
  placeSlug: "sakhnin",
  lat: 32.86,
  lng: 35.3,
  owner: { name: "Shalom", phone: "050-123-4567" },
  source: "manual",
  locale: "he",
};

describe("/api/join", () => {
  it("forwards a good form with the visitor's IP, parsed, never cached", async () => {
    postJoin.mockResolvedValue({ status: 201 });
    const res = await join(req("/api/join", form));
    expect([res.status, res.headers.get("cache-control")]).toEqual([201, "no-store"]);
    expect(postJoin.mock.calls[0]![1]).toBe("9.9.9.9");
    expect(postJoin.mock.calls[0]![0]).toMatchObject({ ...form, photos: [], links: {} });
  });

  it("refuses a bad form without calling the API, and passes on limits and outages", async () => {
    expect((await join(req("/api/join", { ...form, lat: 50 }))).status).toBe(400);
    expect(postJoin).not.toHaveBeenCalled();
    postJoin.mockResolvedValueOnce({ status: 429, retryAfter: 60 });
    const limited = await join(req("/api/join", form));
    expect([limited.status, limited.headers.get("retry-after")]).toEqual([429, "60"]);
    postJoin.mockRejectedValueOnce(new ApiUnavailableError(new Error("down")));
    expect((await join(req("/api/join", form))).status).toBe(503);
  });
});

describe("/api/join/lookup", () => {
  it("answers what the API found", async () => {
    postJoinLookup.mockResolvedValue({ status: 200, body: { found: false, reason: "off" } });
    const res = await lookup(req("/api/join/lookup", { query: "Shalom", locale: "he" }));
    expect(await res.json()).toEqual({ found: false, reason: "off" });
    expect(postJoinLookup).toHaveBeenCalledWith({ query: "Shalom", locale: "he" }, "9.9.9.9");
    expect((await lookup(req("/api/join/lookup", { locale: "he" }))).status).toBe(400);
  });
});

describe("/api/join/photos", () => {
  const upload = (blob: Blob | string, variant = "") => {
    const fd = new FormData();
    fd.set("file", blob);
    return photos(
      new Request(`http://x/api/join/photos${variant}`, { method: "POST", headers, body: fd }),
    );
  };

  it("forwards the bytes alone, with the variant", async () => {
    postJoinPhoto.mockResolvedValue({ status: 201, body: { key: "k", url: "u" } });
    const res = await upload(
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
      "?variant=logo",
    );
    expect([res.status, await res.json()]).toEqual([201, { key: "k", url: "u" }]);
    const [bytes, variant, ip] = postJoinPhoto.mock.calls[0]!;
    expect([(bytes as ArrayBuffer).byteLength, variant, ip]).toEqual([3, "logo", "9.9.9.9"]);
  });

  it("refuses a missing file, a huge one, and says when uploads are off", async () => {
    expect((await upload("text")).status).toBe(400);
    expect((await upload(new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]))).status).toBe(413);
    expect(postJoinPhoto).not.toHaveBeenCalled();
    postJoinPhoto.mockResolvedValueOnce({ status: 503, reason: "uploads-off" });
    const off = await upload(new Blob([new Uint8Array(4)]));
    expect([off.status, await off.json()]).toEqual([503, { reason: "uploads-off" }]);
  });
});
