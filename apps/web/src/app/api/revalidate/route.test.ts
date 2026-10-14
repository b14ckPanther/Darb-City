// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));
const { POST } = await import("./route");

beforeEach(() => vi.stubEnv("REVALIDATE_SECRET", "s3cret"));
afterEach(() => {
  vi.unstubAllEnvs();
  revalidateTag.mockReset();
});

const post = (body: unknown, secret?: string) =>
  POST(
    new Request("http://web.test/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-revalidate-secret": secret } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

it("revalidates each tag with the max profile", async () => {
  const res = await post({ tags: ["places", "place:haifa"] }, "s3cret");
  expect(res.status).toBe(200);
  expect(revalidateTag.mock.calls).toEqual([
    ["places", "max"],
    ["place:haifa", "max"],
  ]);
});

it("refuses a wrong secret and a bad body", async () => {
  expect((await post({ tags: ["places"] }, "wrong")).status).toBe(401);
  expect((await post({ nope: true }, "s3cret")).status).toBe(400);
  expect(revalidateTag).not.toHaveBeenCalled();
});

it("expires tags at once for takedowns", async () => {
  const res = await post({ tags: ["businesses"], immediate: true }, "s3cret");
  expect(res.status).toBe(200);
  expect(revalidateTag.mock.calls).toEqual([["businesses", { expire: 0 }]]);
});

it("accepts the API revalidator's exact request shape", async () => {
  // apps/api/src/admin/revalidator.ts always sends `immediate` as a boolean.
  const res = await post({ tags: ["places", "places"], immediate: false }, "s3cret");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ revalidated: ["places", "places"], immediate: false });
  expect(revalidateTag.mock.calls).toEqual([
    ["places", "max"],
    ["places", "max"],
  ]);
});

it("refuses a secret of another length without throwing", async () => {
  expect((await post({ tags: ["places"] }, "s3cret-and-more")).status).toBe(401);
});
