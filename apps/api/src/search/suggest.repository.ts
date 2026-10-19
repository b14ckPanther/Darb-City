import { Injectable } from "@nestjs/common";
import type { Localized } from "@darb/core";
import type { SuggestionDto } from "@darb/contracts";
import { normalize } from "@darb/search-text";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Spec §5.2: business names by prefix and trigram. Normalized text has no LIKE wildcards
 * (normalize() turns punctuation, % and _ included, into spaces), so it is safe in patterns.
 */
/** Trigram word similarity a business name needs to be suggested for a misspelled query. */
export const SUGGEST_SIMILARITY = 0.45;

@Injectable()
export class SuggestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(q: string, options: { place?: string; limit: number }): Promise<SuggestionDto[]> {
    // Callers may pass anything; LIMIT must stay 1–10 (a negative LIMIT is an SQL error).
    const limit = Number.isFinite(options.limit)
      ? Math.min(10, Math.max(1, Math.trunc(options.limit)))
      : 6;
    const n = normalize(q);
    if (n.length < 2) return [];
    // Postgres rejects a constant ORDER BY term ("false DESC"), so the term is left out without a place.
    const here = options.place
      ? Prisma.sql`(d."placePath" LIKE (SELECT path FROM "Place" WHERE slug = ${options.place}) || '%') DESC,`
      : Prisma.empty;
    const query = this.prisma.$queryRaw<
      {
        slug: string;
        placeSlug: string;
        kindSlug: string;
        sectorSlug: string;
        name: Localized;
        placeName: Localized;
      }[]
    >`
      SELECT d.slug, p.slug AS "placeSlug", k.slug AS "kindSlug", s.slug AS "sectorSlug",
             b.name, p.name AS "placeName"
      FROM "SearchDocument" d
      JOIN "Business" b ON b.id = d."entityId" AND b.status = 'published'
      JOIN "Place" p ON p.id = b."placeId" AND p.status = 'live'
      JOIN "Kind" k ON k.id = b."primaryKindId" AND k.status = 'active'
      JOIN "Sector" s ON s.id = k."sectorId"
      WHERE d."entityType" = 'business'
        AND (d."nameText" LIKE ${`%${n}%`} OR ${n} <% d."nameText")
      ORDER BY (d."nameText" LIKE ${`${n}%`} OR d."nameText" LIKE ${`% ${n}%`}) DESC,
               ${here}
               word_similarity(${n}, d."nameText") DESC,
               d.tier DESC NULLS LAST, d.slug ASC, p.slug ASC
      LIMIT ${limit}`;
    // A name typed by ear ("מקדולנדס", "hamburgr") shares fewer trigrams than pg_trgm's 0.6
    // default asks; exact and prefix matches still come first.
    const [, rows] = await this.prisma.$transaction([
      this.prisma
        .$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(SUGGEST_SIMILARITY)}, true)`,
      query,
    ]);
    return rows;
  }
}
