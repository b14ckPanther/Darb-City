import { Injectable } from "@nestjs/common";
import type { Localized, Tier } from "@darb/core";
import { vectorLiteral } from "../ai/embeddings.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface RetrievalFilters {
  kindIds: string[] | null;
  placePath: string | null;
  near: { lat: number; lng: number } | null;
  radiusKm: number | null;
  openAt: Date | null;
  delivers: boolean;
  text: string;
  embedding: number[] | null;
}

export interface Candidate {
  row: {
    id: string;
    slug: string;
    name: Localized;
    tagline: Localized;
    tier: Tier;
    primaryKindId: string;
    placeId: string;
    placeSlug: string;
    lat: number;
    lng: number;
    photos: unknown;
    hours: unknown;
  };
  text: number;
  vector: number;
  km: number | null;
  completeness: number;
}

export const CANDIDATE_LIMIT = 300;

/** Spec §5.3 step 2: one Postgres query that filters and scores; ranking happens in rank(). */
@Injectable()
export class RetrievalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async retrieve(f: RetrievalFilters): Promise<Candidate[]> {
    const scoped = f.kindIds !== null || f.placePath !== null || f.near !== null;
    if (!scoped && f.text === "") return [];
    const here = f.near
      ? Prisma.sql`ST_SetSRID(ST_MakePoint(${f.near.lng}, ${f.near.lat}), 4326)::geography`
      : null;
    // An empty text embeds to all zeros, and cosine distance to zeros is NaN (which Postgres
    // sorts above every number): such a query has no vector part at all.
    const usable =
      f.embedding !== null &&
      f.embedding.some((x) => x !== 0) &&
      f.embedding.every(Number.isFinite);
    const vec = usable ? Prisma.sql`${vectorLiteral(f.embedding!)}::vector` : null;
    const textScore = f.text
      ? Prisma.sql`GREATEST(word_similarity(${f.text}, d.text), CASE WHEN d.tsv @@ plainto_tsquery('simple', ${f.text}) THEN 1 ELSE 0 END)`
      : Prisma.sql`0`;
    // Documents without a vector are NULL (never zeros); NULLIF still turns a stray NaN into 0.
    const vectorScore = vec
      ? Prisma.sql`COALESCE(NULLIF(1 - (d.embedding <=> ${vec}), 'NaN'::float8), 0)`
      : Prisma.sql`0`;
    const km = here ? Prisma.sql`ST_Distance(d.point, ${here}) / 1000` : Prisma.sql`NULL::float8`;
    const where = [
      Prisma.sql`d."entityType" = 'business'`,
      Prisma.sql`b.status = 'published'`,
      ...(f.kindIds ? [Prisma.sql`d."kindIds" && ${f.kindIds}::uuid[]`] : []),
      ...(f.placePath ? [Prisma.sql`d."placePath" LIKE ${`${f.placePath}%`}`] : []),
      ...(here && f.radiusKm
        ? [Prisma.sql`ST_DWithin(d.point, ${here}, ${f.radiusKm * 1000})`]
        : []),
      ...(f.openAt ? [Prisma.sql`darb_open_at(b.hours, ${f.openAt})`] : []),
      ...(f.delivers ? [Prisma.sql`b.attributes @> '{"delivers": true}'::jsonb`] : []),
      ...(!f.kindIds && f.text
        ? [
            Prisma.sql`(${f.text} <% d.text OR d.tsv @@ plainto_tsquery('simple', ${f.text})${vec ? Prisma.sql` OR d.embedding <=> ${vec} < 0.6` : Prisma.empty})`,
          ]
        : []),
    ];
    const rows = await this.prisma.$queryRaw<
      (Candidate["row"] & {
        text_score: number;
        vector_score: number;
        km: number | null;
        completeness: number;
      })[]
    >`
      SELECT b.id, b.slug, b.name, b.tagline, b.tier, b."primaryKindId", b."placeId", p.slug AS "placeSlug",
             b.lat, b.lng, b.photos, b.hours, d.completeness,
             ${textScore} AS text_score, ${vectorScore} AS vector_score, ${km} AS km
      FROM "SearchDocument" d
      JOIN "Business" b ON b.id = d."entityId"
      JOIN "Kind" pk ON pk.id = b."primaryKindId" AND pk.status = 'active'
      JOIN "Place" p ON p.id = b."placeId" AND p.status = 'live'
      WHERE ${Prisma.join(where, " AND ")}
      ORDER BY (${textScore}) + (${vectorScore}) DESC, b.id ASC
      LIMIT ${CANDIDATE_LIMIT}`;
    return rows.map(({ text_score, vector_score, km: d, completeness, ...row }) => ({
      row,
      text: Number(text_score),
      vector: Number(vector_score),
      km: d === null ? null : Number(d),
      completeness: Number(completeness),
    }));
  }
}
