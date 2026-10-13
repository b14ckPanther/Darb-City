// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
const runSearch = vi.fn();
vi.mock("@/lib/search-run", () => ({ runSearch }));
const page = await import("./page");

afterEach(() => vi.clearAllMocks());

const props = (query: Record<string, string>) => ({
  params: Promise.resolve({ locale: "en" }),
  searchParams: Promise.resolve(query),
});

it("renders on request, even with no query, and keeps the API reads cached", async () => {
  // revalidate 0: rendered on every request, while the taxonomy and place reads keep their own
  // revalidate (300 s, 3600 s). force-dynamic would make every one of them no-store.
  expect(page.revalidate).toBe(0);
  expect("dynamic" in page).toBe(false);
  expect("generateStaticParams" in page).toBe(false);
  await page.default(props({}));
  expect(runSearch).not.toHaveBeenCalled();
});

it("re-runs an edited search from its chips, and a fresh one in full", async () => {
  runSearch.mockResolvedValue(null);
  await page.default(props({ q: "bakery haifa", chips: "kind:bakeries" }));
  expect(runSearch).toHaveBeenLastCalledWith(
    expect.objectContaining({
      q: "bakery haifa",
      edited: expect.objectContaining({ kinds: ["bakeries"], place: null }),
    }),
  );
  await page.default(props({ q: "bakery haifa" }));
  expect(runSearch).toHaveBeenLastCalledWith(expect.objectContaining({ edited: null }));
});
