// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const postInquiry = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  postInquiry,
}));
const { POST } = await import("./route");
const { ApiUnavailableError } = await import("@/lib/api");

afterEach(() => postInquiry.mockReset());

const body = {
  name: "Lina",
  contact: "lina@example.com",
  topic: "general",
  message: "Do you build apps for clinics?",
  locale: "en",
};
const req = (b: unknown) =>
  new Request("http://x/api/contact", {
    method: "POST",
    headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" },
    body: JSON.stringify(b),
  });

it("forwards a good message with the visitor's IP, never cached", async () => {
  postInquiry.mockResolvedValue({ status: 201 });
  const res = await POST(req(body));
  expect(res.status).toBe(201);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(postInquiry).toHaveBeenCalledWith(body, "9.9.9.9");
});

it("refuses what the API would refuse, without calling it", async () => {
  expect((await POST(req({ ...body, message: "hi" }))).status).toBe(400);
  expect((await POST(new Request("http://x", { method: "POST", body: "{" }))).status).toBe(400);
  expect(postInquiry).not.toHaveBeenCalled();
});

it("passes on the limit with its wait, and says when the API is down", async () => {
  postInquiry.mockResolvedValueOnce({ status: 429, retryAfter: 120 });
  const limited = await POST(req(body));
  expect([limited.status, limited.headers.get("retry-after")]).toEqual([429, "120"]);
  postInquiry.mockRejectedValueOnce(new ApiUnavailableError(new Error("down")));
  expect((await POST(req(body))).status).toBe(503);
});
