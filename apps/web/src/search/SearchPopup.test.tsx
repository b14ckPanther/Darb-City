import { act, render, screen } from "@testing-library/react";
import { buildInstantIndex } from "@darb/search-text";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchOption } from "./types";

const index = buildInstantIndex({
  places: [
    {
      slug: "haifa",
      type: "city",
      status: "live",
      parent: null,
      name: { he: "חיפה", ar: "حيفا", en: "Haifa" },
      aliases: [],
    },
  ],
  kinds: [],
});
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
const business = (q: string): SearchOption => ({
  id: `business:haifa/${q}`,
  group: "businesses",
  label: `Business for ${q}`,
  href: `/en/haifa/food/x/${q}`,
});

type Reply = { ok: boolean; body?: unknown };
let suggest: Map<string, Reply>;
let indexReplies: Reply[];
const fetchMock = vi.fn(async (url: string) => {
  const reply = url.startsWith("/api/search/suggest")
    ? (suggest.get(new URL(url, "http://x").searchParams.get("q")!) ?? {
        ok: true,
        body: { options: [] },
      })
    : (indexReplies.shift() ?? { ok: true, body: index });
  if (!reply.ok) throw new TypeError("network");
  return Response.json(reply.body);
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  suggest = new Map();
  indexReplies = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
  fetchMock.mockClear();
});

async function mount() {
  const { SearchPopup } = await import("./SearchPopup");
  const seen: { options: SearchOption[]; settled: boolean }[] = [];
  const props = (query: string, attempt = 0) => ({
    locale: "en" as const,
    query,
    place: null,
    labels,
    listboxId: "lb",
    activeId: null,
    attempt,
    onOptions: (options: SearchOption[], settled: boolean) => seen.push({ options, settled }),
    onPick: () => undefined,
  });
  const view = render(<SearchPopup {...props("")} />);
  const show = async (query: string, attempt = 0, wait = 200) => {
    view.rerender(<SearchPopup {...props(query, attempt)} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(wait);
    });
  };
  const ids = () => seen.at(-1)!.options.map((o) => o.id);
  return { show, ids, seen };
}

describe("SearchPopup", () => {
  it("never shows business names that belong to an older query", async () => {
    suggest.set("abu", { ok: true, body: { options: [business("abu")] } });
    const { show, ids } = await mount();
    await show("abu");
    expect(ids()).toContain("business:haifa/abu");
    // While the new text's names are still on their way, the old ones are gone already.
    await show("abu s", 0, 0);
    expect(ids()).not.toContain("business:haifa/abu");
    // A failed fetch for the new text must not bring them back either.
    suggest.set("abx", { ok: false });
    await show("abx");
    expect(ids()).not.toContain("business:haifa/abu");
    expect(screen.queryByText("Business for abu")).toBeNull();
  });

  it("tries the index again on the next focus after it failed", async () => {
    indexReplies = [{ ok: false }];
    const { show, ids, seen } = await mount();
    await show("haifa");
    expect(ids()).toEqual(["search"]);
    expect(seen.at(-1)!.settled).toBe(true); // failed: the box may say so
    await show("haifa", 1);
    expect(ids()).toEqual(["place:haifa", "search"]);
  });
});
