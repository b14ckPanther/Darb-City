import { Inject, Injectable, Logger } from "@nestjs/common";
import { inIsrael, type LatLng, type Locale } from "@darb/core";
import { APP_CONFIG, type AppConfig } from "../config.js";

/** Nominatim's usage policy: an identifying User-Agent and at most one request a second. */
export const NOMINATIM_USER_AGENT = "Darb/1.0 (founder@darb.co.il)";
const MIN_GAP_MS = 1000;

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
}
interface NominatimPlace {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
}

export interface Geocoded {
  point: LatLng;
  /** "Street 12, Town", in the asked language when OpenStreetMap has it. */
  address: string;
  town: string | null;
}

function toGeocoded(p: NominatimPlace): Geocoded | null {
  const point = { lat: Number(p.lat), lng: Number(p.lon) };
  if (!inIsrael(point)) return null;
  const a = p.address ?? {};
  const street = [a.road ?? a.pedestrian, a.house_number].filter(Boolean).join(" ");
  const town = a.city ?? a.town ?? a.village ?? null;
  const address =
    [street || a.neighbourhood || a.suburb, town].filter(Boolean).join(", ") ||
    (p.display_name ?? "").split(",").slice(0, 3).join(",").trim();
  return { point, address: address.slice(0, 300), town };
}

/**
 * OpenStreetMap's Nominatim: an address for a point, and a point for a name and town (Israel
 * only). Calls queue one a second in this process; any failure is null, never thrown. Off
 * (always null) when NOMINATIM_URL is turned off, as in tests and e2e.
 */
@Injectable()
export class Geocoder {
  private readonly logger = new Logger(Geocoder.name);
  private queue: Promise<unknown> = Promise.resolve();
  private last = 0;
  fetchImpl: typeof fetch = fetch;
  /** Replaced in tests, so the queue costs no real seconds. */
  sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get enabled(): boolean {
    return this.config.join.geocoderUrl !== null;
  }

  async reverse(point: LatLng, locale: Locale): Promise<Geocoded | null> {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: point.lat.toFixed(6),
      lon: point.lng.toFixed(6),
      zoom: "18",
      addressdetails: "1",
    });
    const found = await this.get<NominatimPlace & { error?: string }>("reverse", params, locale);
    if (!found || found.error) return null;
    const g = toGeocoded(found);
    // The pin stays where the owner put it; only the words come from OpenStreetMap.
    return g ? { ...g, point } : null;
  }

  async search(query: string, locale: Locale): Promise<Geocoded | null> {
    const q = query.trim().slice(0, 200);
    if (!q) return null;
    const params = new URLSearchParams({
      format: "jsonv2",
      q,
      countrycodes: "il",
      limit: "1",
      addressdetails: "1",
    });
    const found = await this.get<NominatimPlace[]>("search", params, locale);
    return Array.isArray(found) && found[0] ? toGeocoded(found[0]) : null;
  }

  private get<T>(path: string, params: URLSearchParams, locale: Locale): Promise<T | null> {
    const base = this.config.join.geocoderUrl;
    if (!base) return Promise.resolve(null);
    params.set("accept-language", locale);
    const run = async (): Promise<T | null> => {
      const wait = this.last + MIN_GAP_MS - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.last = Date.now();
      try {
        const res = await this.fetchImpl(`${base}/${path}?${params}`, {
          headers: { "user-agent": NOMINATIM_USER_AGENT, accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          this.logger.warn(`Nominatim answered ${res.status}`);
          return null;
        }
        return (await res.json()) as T;
      } catch {
        this.logger.warn("Nominatim could not be reached");
        return null;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
