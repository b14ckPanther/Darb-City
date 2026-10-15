import { buildInstantIndex, prepare } from "@darb/search-text";
import { expect, it, vi } from "vitest";
import { inGroups, instantOptions, searchOption } from "./engine";

const prepared = prepare(
  buildInstantIndex({
    places: [
      {
        slug: "haifa",
        type: "city",
        status: "live",
        parent: null,
        name: { he: "חיפה", ar: "حيفا", en: "Haifa" },
        aliases: [],
      },
      {
        slug: "eilat",
        type: "city",
        status: "soon",
        parent: null,
        name: { he: "אילת", ar: "إيلات", en: "Eilat" },
        aliases: [],
      },
    ],
    kinds: [
      {
        slug: "barbershops",
        sector: "beauty",
        parent: null,
        status: "active",
        name: { he: "מספרות", ar: "صالونات حلاقة", en: "Barbershops" },
        synonyms: { he: ["מספרה"], ar: ["حلاق"], en: ["barber"] },
      },
    ],
  }),
);
const labels = {
  search: "Search",
  placeholder: "",
  places: "Places",
  kinds: "Kinds",
  businesses: "Businesses",
  searchFor: "Search for “{q}”",
  suggestionCount: "Suggestions: {count}",
  noSuggestions: "None",
  nationwide: "Across Israel",
};

it("offers kind in place first, at its level-3 URL, then each on its own, then a full search", () => {
  const options = instantOptions(prepared, "barber haifa", "en", labels);
  expect(options.map((o) => [o.group, o.href])).toEqual([
    ["kinds", "/en/haifa/beauty/barbershops"],
    ["places", "/en/haifa"],
    ["kinds", "/en/k/barbershops"],
    ["search", "/en/search?q=barber+haifa"],
  ]);
  expect(options[0]!.label).toBe("Barbershops");
  expect(options[0]!.sublabel).toBe("Haifa");
  expect(options.at(-1)!.label).toBe("Search for “barber haifa”");
});

it("works in Hebrew with an attached prefix, and offers only the search for nothing found", () => {
  expect(instantOptions(prepared, "מספרה בחיפה", "he", labels)[0]!.href).toBe(
    "/haifa/beauty/barbershops",
  );
  expect(instantOptions(prepared, "zzzz", "en", labels).map((o) => o.group)).toEqual(["search"]);
  expect(instantOptions(prepared, "  ", "en", labels)).toEqual([]);
});

it("offers the full search on its own while the index loads", () => {
  expect(searchOption(" pizza ", "he", labels)).toMatchObject({
    group: "search",
    href: "/search?q=pizza",
  });
  expect(searchOption(" ", "he", labels)).toBeNull();
});

it("draws options in groups, each where its best option ranked, so the arrows follow the screen", () => {
  const o = (id: string, group: "places" | "kinds" | "businesses" | "search") => ({
    id,
    group,
    label: id,
    href: "/",
  });
  const ids = (list: ReturnType<typeof o>[]) => inGroups(list).map((x) => x.id);
  expect(
    ids([o("pair", "kinds"), o("haifa", "places"), o("barber", "kinds"), o("q", "search")]),
  ).toEqual(["pair", "barber", "haifa", "q"]);
  expect(
    ids([o("haifa", "places"), o("barber", "kinds"), o("samer", "businesses"), o("q", "search")]),
  ).toEqual(["haifa", "barber", "samer", "q"]);
});

it("sends a kind in a soon place to the place page, never to an empty kind list", () => {
  const options = instantOptions(prepared, "barber eilat", "en", labels);
  expect(options[0]!.id).toBe("pair:eilat/barbershops");
  expect(options[0]!.href).toBe("/en/eilat");
  expect(options.map((o) => o.href)).not.toContain("/en/eilat/beauty/barbershops");
  expect(options.find((o) => o.id === "place:eilat")!.href).toBe("/en/eilat");
});

it("says a kind on its own is nationwide", () => {
  const national = instantOptions(prepared, "barber", "en", labels).find(
    (o) => o.id === "kind:barbershops",
  );
  expect(national?.sublabel).toBe("Across Israel");
});

it("puts the typed text into the label as it is, $& and all", () => {
  expect(searchOption("$& $1", "en", labels)?.label).toBe("Search for “$& $1”");
});

it("falls back to the next index URL", async () => {
  const { loadPrepared, resetPreparedForTests } = await import("./engine");
  resetPreparedForTests();
  const fetchMock = vi.fn(async (url: string) =>
    url === "/a"
      ? new Response("", { status: 503 })
      : Response.json({ v: 1, places: [], kinds: [] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await expect(loadPrepared(["/a", "/b"])).resolves.toBeDefined();
  expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/a", "/b"]);
  vi.unstubAllGlobals();
});

it("falls back when a 2xx answer is not an index", async () => {
  const { loadPrepared, resetPreparedForTests } = await import("./engine");
  resetPreparedForTests();
  const fetchMock = vi.fn(async (url: string) =>
    url === "/a"
      ? new Response("<html>proxy</html>", { status: 200 })
      : Response.json({ v: 1, places: [], kinds: [] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await expect(loadPrepared(["/a", "/b"])).resolves.toBeDefined();
  expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/a", "/b"]);
  vi.unstubAllGlobals();
});
