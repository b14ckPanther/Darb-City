// @vitest-environment node
import { EMPTY_INTENT, type IntentDto, type SearchResponseDto } from "@darb/contracts";
import { afterEach, expect, it, vi } from "vitest";

const postSearch = vi.fn();
const postResults = vi.fn();
class ApiUnavailableError extends Error {}
vi.mock("@/lib/api", () => ({ postSearch, postResults, ApiUnavailableError }));
vi.mock("@/lib/search-context", () => ({ viewContext: vi.fn(async () => ctx) }));
const ctx = {
  locale: "en",
  index: { kindBySlug: new Map(), kindById: new Map(), sectorById: new Map() },
  names: new Map(),
  place: null,
  labels: { openNow: "", delivers: "", nearMe: "", kindInPlace: "", kindNationwide: "" },
  kmLabel: String,
};
const { runSearch } = await import("./search-run");

afterEach(() => vi.resetAllMocks());

const intent: IntentDto = { ...EMPTY_INTENT, kinds: ["bakeries"], place: "haifa" };
const body = (i = intent): SearchResponseDto => ({
  status: "ok",
  lane: "instant",
  queryId: null,
  intent: i,
  needsLocation: false,
  items: [],
  nearest: [],
  fallback: null,
  searched: null,
  suggestions: [],
  refining: false,
});

it("runs the full search for a fresh query", async () => {
  postSearch.mockResolvedValue({ status: 200, body: body() });
  const view = await runSearch({ locale: "en", q: "bakery haifa", edited: null, ip: "1.2.3.4" });
  expect(postSearch).toHaveBeenCalledWith({ q: "bakery haifa", locale: "en" }, "1.2.3.4");
  expect(postResults).not.toHaveBeenCalled();
  expect(view?.intent).toEqual(intent);
});

it("re-runs retrieval for an edited query from the URL, never the model", async () => {
  const edited = { ...intent, place: null };
  postResults.mockResolvedValue({ status: 200, body: body(edited) });
  const view = await runSearch({ locale: "en", q: "bakery haifa", edited, ip: "1.2.3.4" });
  expect(postResults).toHaveBeenCalledWith(
    { q: "bakery haifa", locale: "en", intent: edited },
    "1.2.3.4",
  );
  expect(postSearch).not.toHaveBeenCalled();
  expect(view?.intent).toEqual(edited);
});

it("falls back to the full search when the edited URL names a kind or place that is gone", async () => {
  postResults.mockResolvedValue({ status: 400 });
  postSearch.mockResolvedValue({ status: 200, body: body() });
  const view = await runSearch({ locale: "en", q: "bakery haifa", edited: intent, ip: "x" });
  expect(postSearch).toHaveBeenCalledTimes(1);
  expect(view?.intent).toEqual(intent);
});

it("is null when smart search cannot answer (down or rate-limited)", async () => {
  postSearch.mockResolvedValue({ status: 429, retryAfter: 5 });
  expect(await runSearch({ locale: "en", q: "x", edited: null, ip: "x" })).toBeNull();
  postResults.mockRejectedValue(new ApiUnavailableError("down"));
  expect(await runSearch({ locale: "en", q: "x", edited: intent, ip: "x" })).toBeNull();
  postSearch.mockRejectedValue(new Error("bug"));
  await expect(runSearch({ locale: "en", q: "x", edited: null, ip: "x" })).rejects.toThrow("bug");
});

it("asks for the quick answer when told to, and says whether more is coming", async () => {
  postSearch.mockResolvedValue({ status: 200, body: { ...body(), refining: true } });
  const view = await runSearch({ locale: "en", q: "x", edited: null, ip: "i", instant: true });
  expect(postSearch).toHaveBeenCalledWith({ q: "x", locale: "en", instant: true }, "i");
  expect(view?.refining).toBe(true);
});
