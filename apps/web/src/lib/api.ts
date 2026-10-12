import {
  contract,
  type BusinessDetailDto,
  type BusinessPageDto,
  type DensityDto,
  type KindCountsDto,
  type NearestPlaceDto,
  type PlaceDetailDto,
  type PlaceDto,
  type TaxonomyDto,
} from "@darb/contracts";
import { isSlug } from "@darb/core";
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

export const REVALIDATE = { lists: 300, taxonomy: 3600 } as const;

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
    ...(options.near ? { lat: options.near.lat, lng: options.near.lng } : {}),
  };
  const res = await call(() =>
    client().businesses.list({
      params: { placeSlug },
      query,
      fetchOptions: fetchOptions(
        options.near ? "no-store" : cached(REVALIDATE.lists, tags.businesses),
      ),
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
      query: { lat, lng, limit },
      fetchOptions: fetchOptions(
        cache === "no-store" ? "no-store" : cached(REVALIDATE.lists, tags.businesses),
      ),
    }),
  );
  return res.status === 200 ? res.body : null;
}

/** "no-store" for a person's live position (never cached); "cached" for a place's own point. */
export async function getNearestPlace(
  lat: number,
  lng: number,
  cache: "cached" | "no-store",
): Promise<PlaceDto | null> {
  const res = await call(() =>
    client().places.nearest({
      query: { lat, lng },
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
