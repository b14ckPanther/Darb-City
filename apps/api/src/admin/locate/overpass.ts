import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import { APP_CONFIG, type AppConfig } from "../../config.js";
import { NOMINATIM_USER_AGENT } from "../../join/geocoder.js";
import { REDIS } from "../../redis/redis.module.js";
import { houseNumbers, sameStreet } from "./address.js";
import { round6, type KnownNumber } from "./numbers.js";

/** [south, west, north, east]. */
export type Box = [number, number, number, number];

const DAY_SECONDS = 24 * 60 * 60;
const MIN_GAP_MS = 1000;
const TIMEOUT_MS = 15_000;
/** A box wider than this (degrees, about 6 km) is no single street: refused. */
const MAX_SIDE = 0.06;

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const STREET_TAGS = ["addr:street", "addr:street:he", "addr:street:ar", "addr:street:en"];

/**
 * OpenStreetMap's house numbers on one street, from Overpass: every addr:housenumber inside the
 * street's box whose street name is the asked one. Answers are kept in Redis for a day; calls go
 * one at a time, a second apart, with a timeout. Any failure is null, never thrown. Off with the
 * geocoder (tests and e2e).
 */
@Injectable()
export class Overpass {
  private readonly logger = new Logger(Overpass.name);
  private queue: Promise<unknown> = Promise.resolve();
  private last = 0;
  fetchImpl: typeof fetch = fetch;
  sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  get enabled(): boolean {
    return this.config.join.overpassUrl !== null;
  }

  async numbers(street: string, box: Box): Promise<KnownNumber[] | null> {
    const url = this.config.join.overpassUrl;
    if (!url) return null;
    const b = box.map((n) => Number(n.toFixed(4))) as Box;
    if (b[2] - b[0] > MAX_SIDE || b[3] - b[1] > MAX_SIDE || b[2] <= b[0] || b[3] <= b[1])
      return null;
    const key = `darb:locate:osm:${createHash("sha256")
      .update(`${street}|${b.join(",")}`)
      .digest("hex")
      .slice(0, 32)}`;
    try {
      const hit = await this.redis.get(key);
      if (hit) return JSON.parse(hit) as KnownNumber[];
    } catch {
      // Redis down: ask Overpass.
    }
    const elements = await this.fetchBox(url, b);
    if (!elements) return null;
    const known = elements.flatMap((el): KnownNumber[] => {
      const tags = el.tags ?? {};
      const p = el.lat !== undefined && el.lon !== undefined ? el : el.center;
      if (!p || p.lat === undefined || p.lon === undefined) return [];
      if (!STREET_TAGS.some((t) => tags[t] && sameStreet(tags[t], street))) return [];
      const point = { lat: round6(p.lat), lng: round6(p.lon) };
      return houseNumbers(tags["addr:housenumber"] ?? "").map((h) => ({ ...h, point }));
    });
    try {
      await this.redis.set(key, JSON.stringify(known), "EX", DAY_SECONDS);
    } catch {
      // Only a cache.
    }
    return known;
  }

  private fetchBox(url: string, b: Box): Promise<OverpassElement[] | null> {
    const query = `[out:json][timeout:15];nwr["addr:housenumber"](${b.join(",")});out center tags;`;
    const run = async (): Promise<OverpassElement[] | null> => {
      const wait = this.last + MIN_GAP_MS - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.last = Date.now();
      try {
        const res = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            "user-agent": NOMINATIM_USER_AGENT,
            "content-type": "application/x-www-form-urlencoded",
            accept: "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
          this.logger.warn(`Overpass answered ${res.status}`);
          return null;
        }
        const body = (await res.json()) as { elements?: OverpassElement[] };
        return Array.isArray(body.elements) ? body.elements : null;
      } catch {
        this.logger.warn("Overpass could not be reached");
        return null;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
