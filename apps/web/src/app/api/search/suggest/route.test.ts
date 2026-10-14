// @vitest-environment node
import { expect, it, vi } from "vitest";

const getSuggestions = vi.fn(async () => []);
vi.mock("@/lib/api", () => ({ ApiUnavailableError: class extends Error {}, getSuggestions }));
const { GET } = await import("./route");

const suggest = (ip: string) =>
  GET(
    new Request("http://web.test/api/search/suggest?q=ba&locale=en", {
      headers: { "x-forwarded-for": ip },
    }),
  );

it("limits one visitor to 120 suggestions a minute, others unaffected", async () => {
  for (let i = 0; i < 120; i++) expect((await suggest("1.2.3.4")).status).toBe(200);
  const limited = await suggest("1.2.3.4");
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  expect(await limited.json()).toEqual({ options: [] });
  expect((await suggest("5.6.7.8")).status).toBe(200);
  expect(getSuggestions).toHaveBeenCalledTimes(121);
});
