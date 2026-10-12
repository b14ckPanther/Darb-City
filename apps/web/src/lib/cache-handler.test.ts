// @vitest-environment node
import { expect, it } from "vitest";
import Handler, { isUnavailable, UNAVAILABLE_TAG as HANDLER_TAG } from "../../cache-handler.mjs";
import { UNAVAILABLE_TAG } from "./unavailable";

/** The handler extends Next's untyped file-system cache. */
type Cache = {
  get(key: string, ctx: object): Promise<unknown>;
  set(key: string, data: object, ctx: object): Promise<void>;
};
const DarbCacheHandler = Handler as unknown as new (ctx: object) => Cache;

it("shares the tag with the render side", () => {
  expect(HANDLER_TAG).toBe(UNAVAILABLE_TAG);
});

it("spots a page rendered while the API was down by its cache-tags header", () => {
  const page = (tags: string) => ({ kind: "APP_PAGE", headers: { "x-next-cache-tags": tags } });
  expect(isUnavailable(page(`_N_T_/en/arraba,places,${UNAVAILABLE_TAG}`), {})).toBe(true);
  expect(isUnavailable(page("_N_T_/en/arraba,places,place:arraba"), {})).toBe(false);
  expect(isUnavailable({ kind: "FETCH" }, { tags: [UNAVAILABLE_TAG] })).toBe(true);
  expect(isUnavailable({ kind: "FETCH" }, { tags: ["places"] })).toBe(false);
});

it("never stores an unavailable entry", async () => {
  const handler = new DarbCacheHandler({ flushToDisk: false, maxMemoryCacheSize: 1024 * 1024 });
  const ctx = { tags: [UNAVAILABLE_TAG] };
  await handler.set("down", { kind: "FETCH", data: {}, revalidate: 1 }, ctx);
  expect(await handler.get("down", { kind: "FETCH", tags: [], softTags: [] })).toBeNull();
  await handler.set("up", { kind: "FETCH", data: {}, revalidate: 300 }, { tags: ["places"] });
  expect(await handler.get("up", { kind: "FETCH", tags: [], softTags: [] })).not.toBeNull();
});
