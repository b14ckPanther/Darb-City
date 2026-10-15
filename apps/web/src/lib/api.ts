import "server-only";
import {
  contract,
  type BusinessDetailDto,
  type BusinessPageDto,
  type DensityDto,
  type InstantIndexDto,
  type KindCountsDto,
  type NearestPlaceDto,
  type PlaceCountsDto,
  type PlaceDetailDto,
  type PlaceDto,
  type ResultsRequestDto,
  type SearchRequestDto,
  type SearchResponseDto,
  type SitemapBusinessDto,
  type SuggestionDto,
  type TaxonomyDto,
} from "@darb/contracts";
import { isSlug, type Dietary } from "@darb/core";
import { initClient, type ApiFetcher } from "@ts-rest/core";

/** The API could not be reached or answered with an error it should never give. */
export class ApiUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The Darb API is unavailable", { cause });
    this.name = "ApiUnavailableError";
  }
}

/** The API rejected the query itself (e.g. a malformed or stale cursor). */
export class ApiBadRequestError extends Error {
  constructor(cause: unknown) {
    super("The Darb API rejected the request", { cause });
    this.name = "ApiBadRequestError";
  }
}

/** Admin writes revalidate by tag; open-now is computed in the browser (Task 19), so a day is safe. */
export const REVALIDATE = { lists: 86400, taxonomy: 86400 } as const;

export const tags = {
  taxonomy: "taxonomy",
  places: "places",
  place: (slug: string) => `place:${slug}`,
  businesses: "businesses",
  business: (place: string, slug: string) => `business:${place}/${slug}`,
};

type Cache = "no-store" | { revalidate: number; tags: string[] };
const cached = (revalidate: number, ...list: string[]): Cache => ({ revalidate, tags: list });
const fetchOptions = (cache: Cache) =>
  cache === "no-store"
    ? { cache: "no-store" as const }
    : { next: { revalidate: cache.revalidate, tags: cache.tags } };

/** Passes Next's `next` and `cache` options straight to fetch. */
const fetcher: ApiFetcher = async ({ path, method, headers, body, fetchOptions: options }) => {
  const res = await fetch(path, { ...options, method, headers, body });
  const type = res.headers.get("content-type") ?? "";
  return {
    status: res.status,
    body: type.includes("json") ? await res.json() : await res.text(),
    headers: res.headers,
  };
};

function apiBaseUrl(): string {
  const url = process.env.API_URL;
  if (!url)
    throw new ApiUnavailableError(new Error("API_URL is not set (see apps/web/.env.example)"));
  return url.replace(/\/+$/, "");
}

const client = () =>
  initClient(contract, { baseUrl: apiBaseUrl(), api: fetcher, throwOnUnknownStatus: true });

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw error instanceof ApiUnavailableError ? error : new ApiUnavailableError(error);
  }
}

/**
 * Route params arrive decoded and ts-rest puts path params into the URL as they are, so `a/../b`
 * or `a?b` would reach another endpoint. Anything that is not a slug is simply not found.
 */
const slugs = (...values: string[]) => values.every(isSlug);

export async function getTaxonomy(): Promise<TaxonomyDto> {
  const res = await call(() =>
    client().taxonomy.get({
      fetchOptions: fetchOptions(cached(REVALIDATE.taxonomy, tags.taxonomy)),
    }),
  );
  if (res.status === 200) return res.body;
  throw new ApiUnavailableError(res);
}

export async function getPlace(slug: string): Promise<PlaceDetailDto | null> {
  if (!slugs(slug)) return null;
  const res = await call(() =>
    client().places.get({
      params: { slug },
      fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.places, tags.place(slug))),
    }),
  );
  return res.status === 200 ? res.body : null;
}

export async function getPlaces(status?: "live" | "soon"): Promise<PlaceDto[]> {
  const res = await call(() =>
    client().places.list({
      query: status ? { status } : {},
      fetchOptions: fetchOptions(cached(REVALIDATE.taxonomy, tags.places)),
    }),
  );
  if (res.status === 200) return res.body;
  throw new ApiUnavailableError(res);
}

export async function getKindCounts(placeSlug: string): Promise<KindCountsDto | null> {
  if (!slugs(placeSlug)) return null;
  const res = await call(() =>
    client().businesses.kindCounts({
      params: { placeSlug },
      fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.businesses, tags.place(placeSlug))),
    }),
  );
  return res.status === 200 ? res.body : null;
}

export async function getBusinesses(
  placeSlug: string,
  options: {
    kind?: string;
    cursor?: string;
    limit?: number;
    open?: boolean;
    delivers?: boolean;
    /** A whole-business dietary fact every result must have (Task 27b). */
    dietary?: Dietary;
    /** A person's position: fetched no-store, never cached. */
    near?: { lat: number; lng: number };
  } = {},
): Promise<BusinessPageDto | null> {
  if (!slugs(placeSlug) || (options.kind !== undefined && !slugs(options.kind))) return null;
  const query = {
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.cursor ? { cursor: options.cursor } : {}),
    ...(options.limit ? { limit: options.limit } : {}),
    ...(options.open ? { openNow: "true" as const } : {}),
    ...(options.delivers ? { delivers: "true" as const } : {}),
    ...(options.dietary ? { dietary: options.dietary } : {}),
  };
  const near = options.near;
  // A person's position goes in a POST body, never in the URL (spec §5.4), and is never cached.
  const res = await call(() =>
    near
      ? client().businesses.listNear({
          params: { placeSlug },
          query,
          body: { lat: near.lat, lng: near.lng },
          fetchOptions: { cache: "no-store" },
        })
      : client().businesses.list({
          params: { placeSlug },
          query,
          fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.businesses)),
        }),
  );
  if (res.status === 400) throw new ApiBadRequestError(res.body);
  return res.status === 200 ? res.body : null;
}

export async function getBusiness(
  placeSlug: string,
  slug: string,
): Promise<BusinessDetailDto | null> {
  if (!slugs(placeSlug, slug)) return null;
  const res = await call(() =>
    client().businesses.get({
      params: { placeSlug, slug },
      fetchOptions: fetchOptions(
        cached(REVALIDATE.lists, tags.businesses, tags.business(placeSlug, slug)),
      ),
    }),
  );
  return res.status === 200 ? res.body : null;
}

export async function getNearestPlacesWithKind(
  kindSlug: string,
  lat: number,
  lng: number,
  limit: number,
  cache: "cached" | "no-store" = "cached",
): Promise<NearestPlaceDto[] | null> {
  if (!slugs(kindSlug)) return null;
  const res = await call(() =>
    client().businesses.nearestPlaces({
      params: { kindSlug },
      // POST: the point stays out of the URL. "cached" is only ever a place's own public point;
      // Next's data cache keys a POST on a hash of its body, so nothing logs the coordinates.
      body: { lat, lng, limit },
      fetchOptions: fetchOptions(
        cache === "no-store" ? "no-store" : cached(REVALIDATE.lists, tags.businesses),
      ),
    }),
  );
  return res.status === 200 ? res.body : null;
}

/**
 * "no-store" for a person's live position (never cached); "cached" for a place's own public point.
 * Either way the point travels in a POST body, never in the URL (spec §5.4).
 */
export async function getNearestPlace(
  lat: number,
  lng: number,
  cache: "cached" | "no-store",
): Promise<PlaceDto | null> {
  const res = await call(() =>
    client().places.nearest({
      body: { lat, lng },
      fetchOptions: fetchOptions(
        cache === "no-store" ? "no-store" : cached(REVALIDATE.taxonomy, tags.places),
      ),
    }),
  );
  return res.status === 200 ? res.body : null;
}

/** Business counts per live settlement (the map's glow). Throws when the API is down. */
export async function getDensity(): Promise<DensityDto> {
  const res = await call(() =>
    client().businesses.density({
      fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.businesses, tags.places)),
    }),
  );
  if (res.status === 200) return res.body;
  throw new ApiUnavailableError(res);
}

export async function getPlaceCounts(): Promise<PlaceCountsDto> {
  const res = await call(() =>
    client().businesses.placeCounts({
      fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.businesses, tags.places)),
    }),
  );
  if (res.status === 200) return res.body;
  throw new ApiUnavailableError(res);
}

/** Decision 5: the API rate-limits the visitor's IP only when this server vouches for it. */
const proxyHeaders = (ip: string) => ({
  "x-darb-proxy-key": process.env.SEARCH_PROXY_KEY ?? "",
  "x-darb-client-ip": ip,
});

export type SearchCall =
  { status: 200; body: SearchResponseDto } | { status: 429; retryAfter: number } | { status: 400 };

export async function postSearch(body: SearchRequestDto, ip: string): Promise<SearchCall> {
  const res = await call(() =>
    client().search.search({
      body,
      extraHeaders: proxyHeaders(ip),
      fetchOptions: { cache: "no-store" },
    }),
  );
  if (res.status === 200) return { status: 200, body: res.body };
  if (res.status === 429) return { status: 429, retryAfter: res.body.retryAfter };
  return { status: 400 };
}

export async function postResults(body: ResultsRequestDto, ip: string): Promise<SearchCall> {
  const res = await call(() =>
    client().search.results({
      body,
      extraHeaders: proxyHeaders(ip),
      fetchOptions: { cache: "no-store" },
    }),
  );
  if (res.status === 200) return { status: 200, body: res.body };
  if (res.status === 429) return { status: 429, retryAfter: res.body.retryAfter };
  return { status: 400 };
}

let warnedSuggestLimit = false;

/**
 * The key marks this server as the trusted proxy, so the API does not count every visitor against
 * one bucket. Production refuses to start without it (lib/env.ts); development sends none and the
 * API limits the dev server as one caller.
 */
export async function getSuggestions(q: string, place?: string): Promise<SuggestionDto[]> {
  const key = process.env.SEARCH_PROXY_KEY?.trim();
  const res = await call(() =>
    client().search.suggest({
      query: { q, limit: 5, ...(place && isSlug(place) ? { place } : {}) },
      extraHeaders: key ? { "x-darb-proxy-key": key } : {},
      fetchOptions: { next: { revalidate: 300, tags: [tags.businesses] } },
    }),
  );
  if (res.status === 429 && !warnedSuggestLimit) {
    warnedSuggestLimit = true;
    console.warn(
      "The API rate-limited this server's suggest calls: SEARCH_PROXY_KEY must equal the API's",
    );
  }
  return res.status === 200 ? res.body : [];
}

/** The API rate-limits clicks per visitor too, so this server vouches for the visitor's IP. */
export async function postClick(queryId: string, key: string, ip: string): Promise<void> {
  await call(() =>
    client().search.click({
      body: { queryId, key },
      extraHeaders: proxyHeaders(ip),
      fetchOptions: { cache: "no-store" },
    }),
  );
}

/** The live lane-1 index; refreshed when an admin write revalidates places or taxonomy. */
export async function getInstantIndex(): Promise<InstantIndexDto> {
  const res = await call(() =>
    client().search.instantIndex({
      fetchOptions: fetchOptions(cached(REVALIDATE.taxonomy, tags.taxonomy, tags.places)),
    }),
  );
  if (res.status !== 200) throw new ApiUnavailableError(res);
  return res.body;
}

/**
 * Real businesses for the sitemap. An unreachable API throws ApiUnavailableError (the sitemap
 * fails rather than publishing an empty list); only a non-200 answer gives [].
 */
export async function getSitemapBusinesses(): Promise<SitemapBusinessDto[]> {
  const res = await call(() =>
    client().sitemap.businesses({
      fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.businesses)),
    }),
  );
  return res.status === 200 ? res.body : [];
}
