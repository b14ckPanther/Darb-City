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
