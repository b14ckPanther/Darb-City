// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { forwardField, sameOrigin } from "./field-proxy";

const post = (path: string, init: RequestInit & { origin?: string } = {}) =>
  new Request(`http://localhost:3196${path}`, {
    method: "POST",
    ...init,
    headers: {
      host: "localhost:3196",
      ...(init.origin === undefined
        ? { origin: "http://localhost:3196" }
        : init.origin
          ? { origin: init.origin }
          : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

describe("sameOrigin", () => {
  it("accepts only the site's own origin", () => {
    expect(sameOrigin(post("/x"))).toBe(true);
    expect(sameOrigin(post("/x", { origin: "https://evil.example" }))).toBe(false);
    expect(sameOrigin(post("/x", { origin: "" }))).toBe(false);
  });
});

describe("forwardField", () => {
  const token = async () => "fake.token";

  it("forwards the image bytes alone, with the admin's token", async () => {
    process.env.API_URL = "http://api.test";
    const fetchImpl = vi.fn(async () => Response.json({ key: null }, { status: 201 }));
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1, 2, 3])]), "sign.jpg");
    const res = await forwardField(
      "photo",
      post("/admin/field-api/photo", { body: form }),
      fetchImpl,
      token,
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/admin/field/photo");
    expect(init.headers).toMatchObject({
      authorization: "Bearer fake.token",
      "content-type": "application/octet-stream",
    });
    expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("refuses another site's request, an unknown action and a signed-out admin", async () => {
    const fetchImpl = vi.fn();
    const evil = post("/admin/field-api/captures", { origin: "https://evil.example", body: "{}" });
    expect((await forwardField("captures", evil, fetchImpl, token)).status).toBe(403);
    expect((await forwardField("delete-all", post("/x"), fetchImpl, token)).status).toBe(404);
    const out = await forwardField(
      "captures",
      post("/x", { body: "{}" }),
      fetchImpl,
      async () => null,
    );
    expect(out.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers 503 when the API cannot be reached", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("connect ECONNREFUSED");
    });
    const res = await forwardField("duplicates", post("/x", { body: "{}" }), fetchImpl, token);
    expect(res.status).toBe(503);
  });
});
