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
@Injectable()
export class SuggestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(q: string, options: { place?: string; limit: number }): Promise<SuggestionDto[]> {
    const n = normalize(q);
    if (n.length < 2) return [];
    // Postgres rejects a constant ORDER BY term ("false DESC"), so the term is left out without a place.
    const here = options.place
      ? Prisma.sql`(d."placePath" LIKE (SELECT path FROM "Place" WHERE slug = ${options.place}) || '%') DESC,`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
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
      JOIN "Place" p ON p.id = b."placeId"
      JOIN "Kind" k ON k.id = b."primaryKindId" AND k.status = 'active'
      JOIN "Sector" s ON s.id = k."sectorId"
      WHERE d."entityType" = 'business'
        AND (d."nameText" LIKE ${`%${n}%`} OR ${n} <% d."nameText")
      ORDER BY (d."nameText" LIKE ${`${n}%`} OR d."nameText" LIKE ${`% ${n}%`}) DESC,
               ${here}
               word_similarity(${n}, d."nameText") DESC,
               d.tier DESC NULLS LAST, d.slug ASC, p.slug ASC
      LIMIT ${options.limit}`;
    return rows;
  }
}
