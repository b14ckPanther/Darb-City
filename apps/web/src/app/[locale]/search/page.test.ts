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
  // revalidate (a day, refreshed by tag). force-dynamic would make every one of them no-store.
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
  expect(runSearch).toHaveBeenLastCalledWith(
    expect.objectContaining({ edited: null, instant: true }),
  );
});

/** The React elements of a rendered tree, depth first. */
function* walk(node: unknown): Generator<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(node)) for (const n of node) yield* walk(n);
  else if (node && typeof node === "object" && "props" in node) {
    const el = node as { type: unknown; props: Record<string, unknown> };
    yield el;
    yield* walk(el.props["children"]);
    yield* walk(el.props["fallback"]);
  }
}
const view = (refining: boolean) => ({ status: "ok", rows: [], refining, intent: {} });

it("shows the quick answer at once and streams the full search over it", async () => {
  runSearch.mockResolvedValue(view(true));
  const tree = await page.default(props({ q: "wen fi 7ala2 bi 7aifa" }));
  const els = [...walk(tree)];
  const suspense = els.find((e) => "fallback" in e.props);
  expect(suspense).toBeTruthy();
  const quick = [...walk(suspense!.props["fallback"])].find((e) => "refining" in e.props);
  expect(quick?.props["refining"]).toBe(true);
  // The streamed part runs the full search (never instant) and marks itself refined.
  const refined = [...walk(suspense!.props["children"])][0]!;
  const full = view(false);
  runSearch.mockResolvedValue(full);
  const streamed = await (refined.type as (p: unknown) => Promise<unknown>)(refined.props);
  expect(runSearch).toHaveBeenLastCalledWith(expect.objectContaining({ edited: null }));
  expect(runSearch.mock.lastCall![0].instant).toBeUndefined();
  expect((streamed as { props: Record<string, unknown> }).props).toMatchObject({
    initial: full,
    refined: true,
  });
});

it("keeps the quick answer when the full search cannot answer", async () => {
  runSearch.mockResolvedValue(view(true));
  const tree = await page.default(props({ q: "something" }));
  const suspense = [...walk(tree)].find((e) => "fallback" in e.props)!;
  const refined = [...walk(suspense.props["children"])][0]!;
  runSearch.mockResolvedValue(null);
  const streamed = await (refined.type as (p: unknown) => Promise<unknown>)(refined.props);
  expect((streamed as { props: Record<string, unknown> }).props).toMatchObject({ refined: false });
});

it("streams nothing when the quick answer is already the whole answer", async () => {
  runSearch.mockResolvedValue(view(false));
  const tree = await page.default(props({ q: "barber in haifa" }));
  expect([...walk(tree)].some((e) => "fallback" in e.props)).toBe(false);
  expect(runSearch).toHaveBeenCalledTimes(1);
});
