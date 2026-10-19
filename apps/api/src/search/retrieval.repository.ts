import { Injectable } from "@nestjs/common";
import type { Dietary, Localized, Tier } from "@darb/core";
import { vectorLiteral } from "../ai/embeddings.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RANKING } from "./ranking.config.js";
import { ADDRESS_HIDDEN_SQL } from "../businesses/public-point.js";

export interface RetrievalFilters {
  /** A hard filter, unless `items` is set: then a kind only lifts its businesses (deep search). */
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
  /**
   * Deep search: the things asked for, normalized. Every business whose card offers one is a
   * candidate (its best offering is its match), whatever its kind.
   */
  items?: string[];
  /** Without items: words to show the matched thing for (the free text), never a filter. */
  probe?: string[];
  /**
   * The items' (or probe's) own embedding, for offerings close in meaning ("charging station"
   * for "EV charging"). Never the whole query's: its diet and place words would match tags.
   */
  itemEmbedding?: number[] | null;
  /** Wishes, not musts: a result that is open at this time, or delivers, is lifted a little. */
  nice?: { openAt: Date | null; delivers: boolean };
}

export interface MatchedOffering {
  label: Localized;
  context: Localized | null;
  source: string;
  score: number;
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
    logo?: unknown;
    cardStyle?: unknown;
  };
  text: number;
  vector: number;
  km: number | null;
  completeness: number;
  /** Deep search: 1 when the business is of an asked kind, 0 when not; absent otherwise. */
  kind?: number;
  /** How many stated wishes it meets. */
  nice?: number;
  /** The offering on its card that best answers the items (or the free text). */
  matched?: MatchedOffering | null;
}

export const CANDIDATE_LIMIT = 300;

/** A kind near a query in meaning, through the offerings that name it (kinds, items, tags). */
export interface NearKind {
  kindId: string;
  similarity: number;
}
const MAX_PROBES = 6;

/** Spec §5.3 step 2: one Postgres query that filters and scores; ranking happens in rank(). */
@Injectable()
export class RetrievalRepository {
  /** Rows kept for rank(); tests lower it to prove the pre-cut keeps the right ones. */
  candidateLimit = CANDIDATE_LIMIT;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The kinds closest in meaning to a query's embedding: the nearest distinct offering texts
   * (kind names and synonyms, items, tags) by vector, each kind scored by its closest one. What
   * lane 2 falls back to when the model gives no answer ("someone to fix my AC" is near the
   * technicians' "air conditioning repair" whatever the words).
   */
  async nearestKinds(embedding: number[], limit: number): Promise<NearKind[]> {
    if (!embedding.some((x) => x !== 0) || !embedding.every(Number.isFinite)) return [];
    const vec = Prisma.sql`${vectorLiteral(embedding)}::vector`;
    const rows = await this.prisma.$queryRaw<{ kindId: string; similarity: number }[]>`
      WITH near AS (
        SELECT hash, 1 - (embedding <=> ${vec}) AS v FROM "SearchEmbedding"
        ORDER BY embedding <=> ${vec} LIMIT ${RANKING.offerings.vectorPool}
      ),
      per AS (
        SELECT kid, max(near.v) AS v
        FROM near JOIN "SearchOffering" o ON o."embedHash" = near.hash
        CROSS JOIN LATERAL unnest(o."kindIds") AS kid
        WHERE o.source IN ('kind', 'item', 'part', 'tag')
        GROUP BY kid
      )
      SELECT k.id AS "kindId", per.v::float8 AS similarity
      FROM per JOIN "Kind" k ON k.id = per.kid AND k.status = 'active'
      ORDER BY similarity DESC, k.id LIMIT ${limit}`;
    return rows.map((r) => ({ kindId: r.kindId, similarity: Number(r.similarity) }));
  }

  async retrieve(f: RetrievalFilters): Promise<Candidate[]> {
    const items = (f.items ?? []).filter(Boolean).slice(0, MAX_PROBES);
    const deep = items.length > 0;
    const probe = deep ? items : (f.probe ?? []).filter(Boolean).slice(0, MAX_PROBES);
    const scoped =
      f.kindIds !== null || f.placePath !== null || f.near !== null || f.dietary.length > 0;
    if (!scoped && f.text === "" && !deep) return [];
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
    const itemVector = f.itemEmbedding ?? null;
    const itemVec =
      itemVector && itemVector.some((x) => x !== 0) && itemVector.every(Number.isFinite)
        ? Prisma.sql`${vectorLiteral(itemVector)}::vector`
        : null;
    const docTexts = f.text ? [f.text] : [];
    // How exactly a text names something: found in it, and all of it ("coffee" is all of
    // "coffee" but only part of "walnut coffee table").
    const exactness = (t: string, name: Prisma.Sql) =>
      Prisma.sql`(0.5 * word_similarity(${t}, ${name}) + 0.5 * similarity(${t}, ${name}))`;
    const docScore = (t: string) =>
      Prisma.sql`GREATEST(word_similarity(${t}, d.text), CASE WHEN d.tsv @@ plainto_tsquery('simple', ${t}) THEN 1 ELSE 0 END)`;
    const documentScore =
      docTexts.length === 0
        ? Prisma.sql`0`
        : docTexts.length === 1
          ? docScore(docTexts[0]!)
          : Prisma.sql`GREATEST(${Prisma.join(docTexts.map(docScore))})`;
    const o = RANKING.offerings;
    // Deep search: the best offering on the card (items, tags, tagline, kinds), or the business's
    // own name when that is what was asked ("Samer"). Its place's name is never a match.
    // When kinds are asked, a business of another kind answers only by what its card offers
    // (items, their parts, tags), never by what it is: its name, tagline and kind ("ספר", a
    // barber, is not "בית ספר", a school).
    const ofAskedKind = f.kindIds ? Prisma.sql`d."kindIds" && ${f.kindIds}::uuid[]` : null;
    const nameScore = (t: string) =>
      ofAskedKind
        ? Prisma.sql`CASE WHEN ${ofAskedKind} THEN word_similarity(${t}, d."nameText") ELSE 0 END`
        : Prisma.sql`word_similarity(${t}, d."nameText")`;
    const textScore = deep
      ? Prisma.sql`GREATEST(COALESCE(h.score, 0), ${Prisma.join(items.map(nameScore))})`
      : documentScore;
    // Documents without a vector are NULL (never zeros); NULLIF still turns a stray NaN into 0.
    const vectorScore = vec
      ? Prisma.sql`COALESCE(NULLIF(1 - (d.embedding <=> ${vec}), 'NaN'::float8), 0)`
      : Prisma.sql`0`;
    const km = here ? Prisma.sql`ST_Distance(d.point, ${here}) / 1000` : Prisma.sql`NULL::float8`;
    const kindMatch =
      deep && f.kindIds
        ? Prisma.sql`CASE WHEN d."kindIds" && ${f.kindIds}::uuid[] THEN 1 ELSE 0 END`
        : Prisma.sql`0`;
    const niceScore = Prisma.sql`(${
      f.nice?.openAt
        ? Prisma.sql`CASE WHEN darb_open_at(b.hours, ${f.nice.openAt}) THEN 1 ELSE 0 END`
        : Prisma.sql`0`
    } + ${
      f.nice?.delivers
        ? Prisma.sql`CASE WHEN b.attributes @> '{"delivers": true}'::jsonb THEN 1 ELSE 0 END`
        : Prisma.sql`0`
    })`;
    // The pre-cut approximates rank()'s full blend (same weights, same normalization, same tier
    // boost), so a near-me search with many matches keeps the nearest and most complete rows.
    const w = here ? RANKING.nearWeights : RANKING.weights;
    const kindWeight = deep && f.kindIds ? RANKING.kindWeight : 0;
    const total =
      (docTexts.length || deep ? w.text : 0) +
      (vec ? w.vector : 0) +
      (here ? w.distance : 0) +
      w.completeness +
      kindWeight;
    const distanceScore = here
      ? Prisma.sql`1 / (1 + (${km}) / ${RANKING.distanceScaleKm}::float8)`
      : Prisma.sql`0`;
    const boost = (tier: string) => Math.min(RANKING.tierBoost[tier as Tier] ?? 0, RANKING.tierCap);
    const tierBoost = Prisma.sql`CASE b.tier WHEN 'darb' THEN ${boost("darb")}::float8 WHEN 'verified' THEN ${boost("verified")}::float8 WHEN 'basic' THEN ${boost("basic")}::float8 ELSE ${boost("example")}::float8 END`;
    // Near me, rank() decides how much the example penalty applies (only within a distance band),
    // so the pre-cut never drops a showroom example around the corner.
    const demo = Prisma.sql`CASE WHEN b.tier = 'example' THEN ${deep && f.kindIds && !here ? RANKING.examplePenalty : 0}::float8 ELSE 0 END`;
    const preScore = Prisma.sql`(- ${demo} + (${w.text}::float8 * ${textScore} + ${w.vector}::float8 * ${vectorScore} + ${w.distance}::float8 * ${distanceScore} + ${w.completeness}::float8 * d.completeness + ${kindWeight}::float8 * ${kindMatch}) / ${total}::float8 + ${tierBoost} + ${RANKING.niceBoost}::float8 * ${niceScore})`;
    const placeFilter = (alias: string) =>
      f.placePath ? [Prisma.sql`${Prisma.raw(alias)}."placePath" LIKE ${`${f.placePath}%`}`] : [];
    const radiusFilter = (alias: string) =>
      here && f.radiusKm
        ? [Prisma.sql`ST_DWithin(${Prisma.raw(alias)}.point, ${here}, ${f.radiusKm * 1000})`]
        : [];
    const where = [
      Prisma.sql`d."entityType" = 'business'`,
      Prisma.sql`b.status = 'published'`,
      ...(f.kindIds && !deep ? [Prisma.sql`d."kindIds" && ${f.kindIds}::uuid[]`] : []),
      ...placeFilter("d"),
      ...radiusFilter("d"),
      ...(f.openAt ? [Prisma.sql`darb_open_at(b.hours, ${f.openAt})`] : []),
      ...(f.delivers ? [Prisma.sql`b.attributes @> '{"delivers": true}'::jsonb`] : []),
      ...(f.dietary.length > 0 ? [Prisma.sql`b.dietary @> ${f.dietary}::"Dietary"[]`] : []),
      ...(deep
        ? [
            // Its card offers an item, its kind was asked for, or (no kind asked) its name matches.
            Prisma.sql`(h."businessId" IS NOT NULL${
              f.kindIds
                ? Prisma.sql` OR d."kindIds" && ${f.kindIds}::uuid[]`
                : Prisma.sql` OR ${Prisma.join(
                    items.map((t) => Prisma.sql`${t} <% d."nameText"`),
                    " OR ",
                  )}`
            })`,
          ]
        : !f.kindIds && f.text
          ? [
              Prisma.sql`(${f.text} <% d.text OR d.tsv @@ plainto_tsquery('simple', ${f.text})${vec ? Prisma.sql` OR d.embedding <=> ${vec} < 0.6` : Prisma.empty})`,
            ]
          : []),
    ];
    // The best offering per business: hybrid (trigram and words on its text, or its vector among
    // the nearest distinct texts), under the same strict filters as the businesses.
    const sourceWeight = Prisma.sql`CASE o.source ${Prisma.join(
      Object.entries(o.sourceWeight).map(
        ([source, weight]) => Prisma.sql`WHEN ${source} THEN ${weight}::float8`,
      ),
      " ",
    )} ELSE 0.5::float8 END`;
    // How well an offering answers a text: its label found in the text and named exactly ("coffee"
    // is all of "Coffee" but only part of "Walnut coffee table"), or its context and synonyms.
    const offeringText = (t: string) =>
      Prisma.sql`GREATEST(COALESCE((SELECT max(${exactness(t, Prisma.sql`x`)}) FROM unnest(o."labelForms") x), 0), ${o.contextWeight}::float8 * GREATEST(word_similarity(${t}, o.text), CASE WHEN o.tsv @@ plainto_tsquery('simple', ${t}) THEN 1 ELSE 0 END))`;
    const offeringFilters = [
      ...placeFilter("o"),
      ...radiusFilter("o"),
      ...(deep && f.kindIds
        ? [Prisma.sql`(o.source IN ('item', 'part', 'tag') OR o."kindIds" && ${f.kindIds}::uuid[])`]
        : []),
      ...(f.dietary.length > 0 ? [Prisma.sql`o.dietary @> ${f.dietary}::"Dietary"[]`] : []),
    ];
    const offeringWhere =
      offeringFilters.length === 0
        ? Prisma.empty
        : Prisma.sql`AND ${Prisma.join(offeringFilters, " AND ")}`;
    const hits =
      probe.length === 0
        ? Prisma.empty
        : Prisma.sql`WITH emb AS (${
            itemVec
              ? Prisma.sql`SELECT hash, 1 - (embedding <=> ${itemVec}) AS v FROM "SearchEmbedding"
                ORDER BY embedding <=> ${itemVec} LIMIT ${o.vectorPool}`
              : Prisma.sql`SELECT NULL::text AS hash, 0::float8 AS v WHERE false`
          }),
          cand AS (
            ${Prisma.join(
              probe.map(
                (t) => Prisma.sql`SELECT o.id FROM "SearchOffering" o
                  WHERE ${t} <% o.text OR o.tsv @@ plainto_tsquery('simple', ${t})`,
              ),
              " UNION ",
            )}
            UNION SELECT o.id FROM "SearchOffering" o JOIN emb ON emb.hash = o."embedHash"
              WHERE emb.v >= ${o.minVector}::float8
          ),
          scored AS (
            SELECT o."businessId", o.label, o.context, o.source,
                   ${sourceWeight} * GREATEST(${
                     probe.length === 1
                       ? offeringText(probe[0]!)
                       : Prisma.sql`GREATEST(${Prisma.join(probe.map(offeringText))})`
                   }, ${o.vectorWeight}::float8 * COALESCE(emb.v, 0)) AS score
            FROM cand JOIN "SearchOffering" o ON o.id = cand.id
            LEFT JOIN emb ON emb.hash = o."embedHash"
            WHERE TRUE ${offeringWhere}
          ),
          h AS (
            -- An item beats a tag of the same score, a tag the tagline, the tagline a kind.
            SELECT DISTINCT ON ("businessId") * FROM scored
            ORDER BY "businessId", score DESC,
              array_position(ARRAY['item','part','tag','tagline','kind'], source)
          )`;
    const join =
      probe.length === 0
        ? Prisma.sql`LEFT JOIN (SELECT NULL::uuid AS "businessId", NULL::jsonb AS label, NULL::jsonb AS context, NULL::text AS source, NULL::float8 AS score) h ON FALSE`
        : Prisma.sql`LEFT JOIN h ON h."businessId" = b.id`;
    const query = this.prisma.$queryRaw<
      (Candidate["row"] & {
        text_score: number;
        vector_score: number;
        km: number | null;
        completeness: number;
        kind_match: number;
        nice_score: number;
        m_label: Localized | null;
        m_context: Localized | null;
        m_source: string | null;
        m_score: number | null;
      })[]
    >`
      ${hits}
      SELECT b.id, b.slug, b.name, b.tagline, b.tier, b."primaryKindId", b."placeId", p.slug AS "placeSlug",
             -- A business that keeps its street private shows its place's centre, never its pin.
             CASE WHEN ${ADDRESS_HIDDEN_SQL} THEN p.lat ELSE b.lat END AS lat,
             CASE WHEN ${ADDRESS_HIDDEN_SQL} THEN p.lng ELSE b.lng END AS lng,
             b.photos, b.hours, b.dietary::text[] AS dietary, b.logo, b."cardStyle", d.completeness,
             ${textScore} AS text_score, ${vectorScore} AS vector_score, ${km} AS km,
             ${kindMatch} AS kind_match, ${niceScore} AS nice_score,
             h.label AS m_label, h.context AS m_context, h.source AS m_source, h.score AS m_score
      FROM "SearchDocument" d
      JOIN "Business" b ON b.id = d."entityId"
      JOIN "Kind" pk ON pk.id = b."primaryKindId" AND pk.status = 'active'
      JOIN "Place" p ON p.id = b."placeId" AND p.status = 'live'
      ${join}
      WHERE ${Prisma.join(where, " AND ")}
      ORDER BY ${preScore} DESC, b.slug ASC, b.id ASC
      LIMIT ${this.candidateLimit}`;
    // Deep search reads Hebrew and Arabic words with their prefixes ("לרכב" for "רכב"), which
    // costs trigram overlap: its candidates need a little less of it than the 0.6 default.
    const rows = deep
      ? (
          await this.prisma.$transaction([
            this.prisma
              .$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(o.minWordSimilarity)}, true)`,
            query,
          ])
        )[1]
      : await query;
    return rows.map(
      ({
        text_score,
        vector_score,
        km: d,
        completeness,
        kind_match,
        nice_score,
        m_label,
        m_context,
        m_source,
        m_score,
        ...row
      }) => ({
        row,
        text: Number(text_score),
        vector: Number(vector_score),
        km: d === null ? null : Number(d),
        completeness: Number(completeness),
        ...(kindWeight > 0 ? { kind: Number(kind_match) } : {}),
        nice: Number(nice_score),
        matched:
          m_label && m_source
            ? { label: m_label, context: m_context, source: m_source, score: Number(m_score) }
            : null,
      }),
    );
  }
}
