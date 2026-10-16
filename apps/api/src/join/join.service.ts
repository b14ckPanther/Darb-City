import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  PhoneSchema,
  type JoinCreateDto,
  type JoinLookupRequestDto,
  type JoinSuggestionDto,
} from "@darb/contracts";
import {
  isReservedSlug,
  latinize,
  normalizeLinks,
  toSlug,
  websiteUrl,
  type BusinessLinks,
  type LatLng,
  type Localized,
} from "@darb/core";
import { isBlocked, normalize } from "@darb/search-text";
import type { Redis } from "ioredis";
import { json } from "../admin/json.js";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { Prisma } from "../generated/prisma/client.js";
import { MediaStore } from "../media/media.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { ipBucket } from "../search/ip-bucket.js";
import { ipHash } from "../search/rate-limiter.js";
import { Geocoder } from "./geocoder.js";
import { readLink, resolveShortLink } from "./links.js";
import { LOOKUP_AI, type AiFindings, type LookupAi } from "./lookup-ai.js";

const SETTLEMENTS = ["city", "town", "village", "neighbourhood"] as const;
const DAY_KEY = (day: string) => `darb:join:lookups:${day}`;

/** Business names to a URL slug: English first, else the owner's letters in rough Latin. */
export function slugBase(name: Localized): string {
  for (const text of [name.en, name.he, name.ar]) {
    if (!text?.trim()) continue;
    try {
      const slug = toSlug(latinize(text)).slice(0, 60).replace(/-+$/, "");
      if (slug) return isReservedSlug(slug) ? `${slug}-biz` : slug;
    } catch {
      // Nothing Latin came out of this one; try the next language.
    }
  }
  return "business";
}

const phoneOrNull = (v: string | null | undefined) => {
  const p = v ? PhoneSchema.safeParse(v) : null;
  return p?.success ? p.data : undefined;
};
const someText = (l: Record<string, string | null | undefined> | undefined) => {
  const out = Object.fromEntries(
    Object.entries(l ?? {}).filter((e): e is [string, string] => Boolean(e[1]?.trim())),
  );
  return Object.keys(out).length ? out : undefined;
};

/**
 * The /join form's two jobs: find a business from what its owner gives (a link, a point, a name)
 * and keep the form as a draft business with a request for the admin's queue.
 */
@Injectable()
export class JoinService {
  private readonly logger = new Logger(JoinService.name);
  /** Short map links are followed with this (replaced in tests). */
  fetchImpl: typeof fetch = fetch;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoder: Geocoder,
    private readonly media: MediaStore,
    @Inject(LOOKUP_AI) private readonly ai: LookupAi,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get lookupOn(): boolean {
    return this.ai.name !== "off" && this.config.join.lookupsPerDay > 0;
  }

  /** One of the day's model lookups, across every replica; a Redis failure means none. */
  private async takeLookup(now = new Date()): Promise<boolean> {
    if (!this.lookupOn) return false;
    const key = DAY_KEY(now.toISOString().slice(0, 10));
    try {
      const res = await this.redis
        .multi()
        .incr(key)
        .expire(key, 2 * 86_400)
        .exec();
      return Number(res?.[0]?.[1] ?? Infinity) <= this.config.join.lookupsPerDay;
    } catch {
      return false;
    }
  }

  private async activeKinds() {
    return this.prisma.kind.findMany({
      where: { status: "active" },
      select: { slug: true, name: true },
      orderBy: { slug: "asc" },
    });
  }

  /** The closest settlement of any status: a business may join before its town is live. */
  private async nearestPlace(p: LatLng): Promise<string | undefined> {
    const rows = await this.prisma.$queryRaw<{ slug: string }[]>`
      SELECT slug FROM "Place"
      WHERE type IN ('city', 'town', 'village')
      ORDER BY "point" <-> ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography
      LIMIT 1`;
    return rows[0]?.slug;
  }

  /** A town's name in any language (or an alias) to its place. */
  private async placeByName(town: string): Promise<string | undefined> {
    const wanted = normalize(town);
    if (!wanted) return undefined;
    const places = await this.prisma.place.findMany({
      where: { type: { in: [...SETTLEMENTS] } },
      select: { slug: true, name: true, aliases: true },
    });
    const hit = places.find((p) =>
      [p.slug.replace(/-/g, " "), ...Object.values(p.name as Localized), ...p.aliases].some(
        (n) => typeof n === "string" && normalize(n) === wanted,
      ),
    );
    return hit?.slug;
  }

  async lookup(dto: JoinLookupRequestDto): Promise<JoinSuggestionDto> {
    const { locale } = dto;
    let point: LatLng | undefined = dto.point;
    let linkName: string | undefined;
    let links: BusinessLinks = {};
    let website: string | undefined;
    if (dto.url) {
      let facts = readLink(dto.url);
      if (facts?.short) {
        const long = await resolveShortLink(dto.url, this.fetchImpl);
        facts = long ? readLink(long) : null;
      }
      point ??= facts?.point;
      linkName = facts?.name;
      links = facts?.links ?? {};
      website = facts?.website;
    }
    const query = [dto.query, linkName].filter(Boolean).join(" ").trim();
    let osm = false;
    let address: string | undefined;
    let town: string | undefined;
    if (point) {
      const g = await this.geocoder.reverse(point, locale);
      if (g) [address, town, osm] = [g.address, g.town ?? undefined, true];
    }

    const subject = query || website || Object.values(links)[0] || address;
    let ai: AiFindings | null = null;
    const asked = Boolean(subject) && (await this.takeLookup());
    if (asked) {
      const kinds = await this.activeKinds();
      ai = await this.ai
        .find(
          {
            query: subject,
            address,
            town,
            links: [website, ...Object.values(links)].filter((l): l is string => Boolean(l)),
            locale,
            kinds: kinds.map((k) => `${k.slug}: ${(k.name as Localized).en ?? k.slug}`),
          },
          AbortSignal.timeout(this.config.join.timeoutMs),
        )
        .catch((err: unknown) => {
          this.logger.warn(`join lookup failed: ${err instanceof Error ? err.name : "error"}`);
          return null;
        });
      if (ai && (ai.excluded || (ai.category !== null && isBlocked(ai.category))))
        return { found: false, reason: "excluded", sources: [], osm: false };
      if (ai && !ai.found) ai = null;
      if (ai?.kind && !kinds.some((k) => k.slug === ai!.kind)) ai.kind = null;
    }

    if (!point) {
      const q = [ai?.address, ai?.town ?? town].filter(Boolean).join(", ") || query;
      const g = q ? await this.geocoder.search(q, locale) : null;
      if (g) {
        [point, osm] = [g.point, true];
        address ??= g.address;
        town ??= g.town ?? undefined;
      }
    }
    const placeSlug = point
      ? await this.nearestPlace(point)
      : await this.placeByName(ai?.town ?? town ?? "");

    const found = Boolean(point || ai || website || Object.keys(links).length);
    if (!found)
      return {
        found: false,
        reason: asked || (this.lookupOn && !subject) ? "none" : "off",
        sources: [],
        osm: false,
      };
    const aiLinks = ai
      ? normalizeLinks({ instagram: ai.instagram, facebook: ai.facebook, tiktok: ai.tiktok })
      : {};
    const mergedLinks = { ...aiLinks, ...links };
    const site = website ?? (ai?.website ? (websiteUrl(ai.website) ?? undefined) : undefined);
    const name =
      someText(ai?.name) ?? (linkName ? { [locale]: linkName.slice(0, 120) } : undefined);
    return {
      found: true,
      ...(point ? { point } : {}),
      ...(address || ai?.address ? { address: (address ?? ai?.address)!.slice(0, 300) } : {}),
      ...(placeSlug ? { placeSlug } : {}),
      ...(ai?.kind ? { kindSlug: ai.kind } : {}),
      ...(name ? { name } : {}),
      ...(phoneOrNull(ai?.phone) ? { phone: phoneOrNull(ai?.phone) } : {}),
      ...(phoneOrNull(ai?.whatsapp) ? { whatsapp: phoneOrNull(ai?.whatsapp) } : {}),
      ...(site ? { website: site } : {}),
      ...(Object.keys(mergedLinks).length ? { links: mergedLinks } : {}),
      ...(ai?.hours ? { hours: { weekly: ai.hours, exceptions: [] } } : {}),
      ...(someText(ai?.description) ? { description: someText(ai?.description) } : {}),
      sources: (ai?.sources ?? []).filter((s) => /^https:\/\//i.test(s)).slice(0, 5),
      osm,
    };
  }

  /** A free slug in the place: the base, then base-2, base-3... */
  private async freeSlug(placeId: string, base: string): Promise<string> {
    const taken = new Set(
      (
        await this.prisma.business.findMany({
          where: { placeId, slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((b) => b.slug),
    );
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }

  /** Only keys this API handed out and that R2 still holds; the rest are dropped. */
  private async keptKeys(keys: string[]): Promise<string[]> {
    const unique = [...new Set(keys)].filter((k) => k.startsWith("pending/"));
    const held = await Promise.all(unique.map((k) => this.media.exists(k)));
    return unique.filter((_, i) => held[i]);
  }

  /**
   * The form as a draft business (source self, never public until approved) and its request,
   * in one transaction. Missing words fall back to what the place and kind already say.
   */
  async create(dto: JoinCreateDto, ip: string): Promise<"ok" | "unknown_place" | "unknown_kind"> {
    const [place, kind] = await Promise.all([
      this.prisma.place.findFirst({
        where: { slug: dto.placeSlug, type: { in: [...SETTLEMENTS] } },
      }),
      this.prisma.kind.findFirst({ where: { slug: dto.kindSlug, status: "active" } }),
    ]);
    if (!place) return "unknown_place";
    if (!kind) return "unknown_kind";
    const [photos, logo] = await Promise.all([
      this.keptKeys(dto.photos),
      dto.logo ? this.keptKeys([dto.logo]) : Promise.resolve([]),
    ]);
    const name = dto.name as Localized;
    const hasText = (l: Localized) => Object.values(l).some((v) => v?.trim());
    const base = slugBase(name);
    for (let attempt = 0; ; attempt++) {
      const slug = await this.freeSlug(place.id, base);
      try {
        await this.prisma.$transaction(async (tx) => {
          const b = await tx.business.create({
            data: {
              slug,
              name: json(name),
              tagline: json(hasText(dto.description) ? dto.description : kind.name),
              address: json(hasText(dto.address) ? dto.address : place.name),
              primaryKindId: kind.id,
              placeId: place.id,
              lat: dto.lat,
              lng: dto.lng,
              phone: dto.phone,
              whatsapp: dto.whatsapp,
              website: dto.website,
              photos: json(photos.map((key) => ({ key, alt: name }))),
              logo: logo[0] ? json({ key: logo[0] }) : Prisma.DbNull,
              links: json(dto.links),
              cardStyle: json(dto.cardStyle),
              hours: json(dto.hours),
              experience: json({}),
              tier: "basic",
              source: "self",
              status: "draft",
              kinds: { create: [{ kindId: kind.id }] },
            },
          });
          await tx.joinRequest.create({
            data: {
              businessId: b.id,
              businessName: json(name),
              ownerName: dto.owner.name,
              ownerPhone: dto.owner.phone,
              ownerEmail: dto.owner.email ?? null,
              note: dto.note || null,
              locale: dto.locale,
              source: dto.source,
              lookup: dto.lookup ? json(dto.lookup) : Prisma.DbNull,
              ipHash: ipHash(this.config.search.ipSalt, ipBucket(ip)),
            },
          });
        });
        return "ok";
      } catch (err) {
        // Another form took the slug between the check and the insert: pick again.
        if (
          attempt < 3 &&
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        )
          continue;
        throw err;
      }
    }
  }
}
