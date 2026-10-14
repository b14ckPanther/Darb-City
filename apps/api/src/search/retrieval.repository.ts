import { Injectable } from "@nestjs/common";
import type { Dietary, Localized, Tier } from "@darb/core";
import { vectorLiteral } from "../ai/embeddings.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RANKING } from "./ranking.config.js";
import { ADDRESS_HIDDEN_SQL } from "../businesses/public-point.js";

export interface RetrievalFilters {
  kindIds: string[] | null;
  placePath: string | null;
  near: { lat: number; lng: number } | null;
  radiusKm: number | null;
  openAt: Date | null;
  delivers: boolean;
  /** Whole-business dietary facts every result must have (Task 27b). */
  dietary: Dietary[];
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
    dietary: Dietary[];
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
  /** Rows kept for rank(); tests lower it to prove the pre-cut keeps the right ones. */
  candidateLimit = CANDIDATE_LIMIT;

  constructor(private readonly prisma: PrismaService) {}

  async retrieve(f: RetrievalFilters): Promise<Candidate[]> {
    const scoped =
      f.kindIds !== null || f.placePath !== null || f.near !== null || f.dietary.length > 0;
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
    // The pre-cut approximates rank()'s full blend (same weights, same normalization, same tier
    // boost), so a near-me search with many matches keeps the nearest and most complete rows.
    const w = RANKING.weights;
    const total =
      (f.text ? w.text : 0) + (vec ? w.vector : 0) + (here ? w.distance : 0) + w.completeness;
    const distanceScore = here
      ? Prisma.sql`1 / (1 + (${km}) / ${RANKING.distanceScaleKm}::float8)`
      : Prisma.sql`0`;
    const boost = (tier: string) => Math.min(RANKING.tierBoost[tier as Tier] ?? 0, RANKING.tierCap);
    const tierBoost = Prisma.sql`CASE b.tier WHEN 'darb' THEN ${boost("darb")}::float8 WHEN 'verified' THEN ${boost("verified")}::float8 WHEN 'basic' THEN ${boost("basic")}::float8 ELSE ${boost("example")}::float8 END`;
    const preScore = Prisma.sql`((${w.text}::float8 * ${textScore} + ${w.vector}::float8 * ${vectorScore} + ${w.distance}::float8 * ${distanceScore} + ${w.completeness}::float8 * d.completeness) / ${total}::float8 + ${tierBoost})`;
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
      ...(f.dietary.length > 0 ? [Prisma.sql`b.dietary @> ${f.dietary}::"Dietary"[]`] : []),
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
             -- A business that keeps its street private shows its place's centre, never its pin.
             CASE WHEN ${ADDRESS_HIDDEN_SQL} THEN p.lat ELSE b.lat END AS lat,
             CASE WHEN ${ADDRESS_HIDDEN_SQL} THEN p.lng ELSE b.lng END AS lng,
             b.photos, b.hours, b.dietary::text[] AS dietary, d.completeness,
             ${textScore} AS text_score, ${vectorScore} AS vector_score, ${km} AS km
      FROM "SearchDocument" d
      JOIN "Business" b ON b.id = d."entityId"
      JOIN "Kind" pk ON pk.id = b."primaryKindId" AND pk.status = 'active'
      JOIN "Place" p ON p.id = b."placeId" AND p.status = 'live'
      WHERE ${Prisma.join(where, " AND ")}
      ORDER BY ${preScore} DESC, b.slug ASC, b.id ASC
      LIMIT ${this.candidateLimit}`;
    return rows.map(({ text_score, vector_score, km: d, completeness, ...row }) => ({
      row,
      text: Number(text_score),
      vector: Number(vector_score),
      km: d === null ? null : Number(d),
      completeness: Number(completeness),
    }));
  }
}
