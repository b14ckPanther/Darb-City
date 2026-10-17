import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Hours, Localized } from "@darb/core";
import { EMBEDDING_PROVIDER, vectorLiteral, type EmbeddingProvider } from "../ai/embeddings.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { publicPoint } from "../businesses/public-point.js";
import {
  businessDocument,
  kindDocument,
  placeDocument,
  type BusinessSource,
  type DocumentRow,
  type SearchEntityName,
} from "./documents.js";
import { extractOfferings } from "./offerings.js";

export const EMBED_BATCH = 128;
export const CASCADE_CHUNK = 500;
/** Offering rows per INSERT (sent as one array per column, so the row count is not bounded by
 * Postgres's parameter limit). */
export const OFFERING_BATCH = 5000;
/** A full reindex rewrites every offering in one transaction: well past the 5 s default. */
const OFFERING_TX = { maxWait: 10_000, timeout: 600_000 };

type IndexedBusiness = BusinessSource & { dietary: string[] };
const embedHash = (provider: string, text: string) =>
  createHash("sha256").update(`${provider}\n${text}`).digest("hex").slice(0, 32);

/** pgvector's cosine distance to an all-zero vector is NaN, so such a text gets no vector. */
const storedVector = (vector: readonly number[] | undefined): string | null =>
  vector && vector.some((x) => x !== 0) ? vectorLiteral(vector) : null;
type Synonyms = { he: string[]; ar: string[]; en: string[] };

@Injectable()
export class SearchIndexer {
  /** Businesses reindexed per step when a place or kind changes. */
  cascadeChunk = CASCADE_CHUNK;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {}

  async indexAll(): Promise<Record<SearchEntityName | "offering", number>> {
    const out = { place: 0, kind: 0, business: 0, offering: 0 };
    for (const entity of ["place", "kind", "business"] as const) {
      const businesses = entity === "business" ? await this.businesses(null) : [];
      const rows =
        entity === "business" ? businesses.map(businessDocument) : await this.rows(entity, null);
      await this.write(rows);
      await this.prisma.$executeRaw`
        DELETE FROM "SearchDocument" WHERE "entityType" = ${entity}::"SearchEntity"
        AND NOT ("entityId" = ANY(${rows.map((r) => r.entityId)}::uuid[]))`;
      out[entity] = rows.length;
      if (entity === "business") out.offering = await this.writeOfferings(businesses, null);
    }
    // Vectors of texts no card says any more.
    await this.prisma.$executeRaw`
      DELETE FROM "SearchEmbedding" e
      WHERE NOT EXISTS (SELECT 1 FROM "SearchOffering" o WHERE o."embedHash" = e.hash)`;
    return out;
  }

  async index(
    entity: SearchEntityName,
    ids: string[],
  ): Promise<{ upserted: number; deleted: number }> {
    if (ids.length === 0) return { upserted: 0, deleted: 0 };
    const businesses = entity === "business" ? await this.businesses(ids) : [];
    const rows =
      entity === "business" ? businesses.map(businessDocument) : await this.rows(entity, ids);
    await this.write(rows);
    // A business's offerings follow its document: rebuilt, or gone when it is no longer listed.
    if (entity === "business") await this.writeOfferings(businesses, ids);
    const keep = rows.map((r) => r.entityId);
    const deleted = await this.prisma.$executeRaw`
      DELETE FROM "SearchDocument" WHERE "entityType" = ${entity}::"SearchEntity"
      AND "entityId" = ANY(${ids}::uuid[]) AND NOT ("entityId" = ANY(${keep}::uuid[]))`;
    // A place's names and a kind's names and status live in its businesses' documents too.
    if (entity !== "business") {
      const owners =
        entity === "kind"
          ? await this.prisma.$queryRaw<{ id: string }[]>`
              SELECT DISTINCT b.id FROM "Business" b JOIN "BusinessKind" bk ON bk."businessId" = b.id
              WHERE bk."kindId" = ANY(${ids}::uuid[]) OR b."primaryKindId" = ANY(${ids}::uuid[])`
          : await this.prisma.$queryRaw<{ id: string }[]>`
              SELECT b.id FROM "Business" b JOIN "Place" p ON p.id = b."placeId"
              JOIN "Place" changed ON p.path LIKE changed.path || '%'
              WHERE changed.id = ANY(${ids}::uuid[])`;
      // A country's cascade covers every business in it, so it goes in bounded chunks.
      for (let i = 0; i < owners.length; i += this.cascadeChunk)
        await this.index(
          "business",
          owners.slice(i, i + this.cascadeChunk).map((o) => o.id),
        );
    }
    return { upserted: rows.length, deleted };
  }

  private async rows(entity: "place" | "kind", ids: string[] | null): Promise<DocumentRow[]> {
    const only = ids ? { id: { in: ids } } : {};
    if (entity === "place") {
      const places = await this.prisma.place.findMany({ where: only });
      return places.map((p) => placeDocument({ ...p, name: p.name as Localized }));
    }
    const kinds = await this.prisma.kind.findMany({ where: { ...only, status: "active" } });
    return kinds.map((k) =>
      kindDocument({ ...k, name: k.name as Localized, synonyms: k.synonyms as Synonyms }),
    );
  }

  private async businesses(ids: string[] | null): Promise<IndexedBusiness[]> {
    const only = ids ? { id: { in: ids } } : {};
    const businesses = await this.prisma.business.findMany({
      // Only businesses in live places are searchable (controller ruling, fix round 1).
      where: {
        ...only,
        status: "published",
        primaryKind: { is: { status: "active" } },
        place: { is: { status: "live" } },
      },
      include: {
        place: { select: { path: true, name: true, lat: true, lng: true } },
        kinds: { where: { kind: { is: { status: "active" } } }, include: { kind: true } },
      },
      orderBy: { id: "asc" },
    });
    return businesses.map((b): IndexedBusiness => ({
      ...b,
      name: b.name as Localized,
      tagline: b.tagline as Localized,
      address: b.address as Localized,
      photos: b.photos as unknown[],
      hours: b.hours as unknown as Hours,
      attributes: b.attributes as Record<string, unknown>,
      experience: b.experience as Record<string, unknown>,
      placePath: b.place.path,
      placeName: b.place.name as Localized,
      placePoint: { lat: b.place.lat, lng: b.place.lng },
      kinds: b.kinds.map(({ kind }) => ({
        id: kind.id,
        slug: kind.slug,
        name: kind.name as Localized,
        synonyms: kind.synonyms as Synonyms,
      })),
    }));
  }

  /**
   * Replaces the offerings of `ids` (every business when null) with those of `businesses` (the
   * listed ones among them), in one transaction so a search never sees a business half done.
   * Each distinct text is embedded once, ever: its vector is shared by every card that says it.
   */
  private async writeOfferings(
    businesses: IndexedBusiness[],
    ids: string[] | null,
  ): Promise<number> {
    const rows = businesses.flatMap((b) => {
      const point = publicPoint(b, b.placePoint);
      return extractOfferings(b).map((o) => ({
        ...o,
        businessId: b.id,
        hash: embedHash(this.embeddings.name, o.embedText),
        placePath: b.placePath,
        kindIds: b.kinds.map((k) => k.id),
        attributes: b.attributes,
        dietary: b.dietary,
        tier: b.tier,
        ...point,
      }));
    });
    await this.embedOfferings(rows);
    // Postgres arrays of arrays must be rectangular: kind ids and dietary go as array literals.
    const literal = (values: string[]) => `{${values.join(",")}}`;
    const insert = (tx: Prisma.TransactionClient, start: number) => {
      const batch = rows.slice(start, start + OFFERING_BATCH);
      const col = <T>(f: (r: (typeof batch)[number]) => T) => batch.map(f);
      return tx.$executeRaw`
        INSERT INTO "SearchOffering" ("id", "businessId", "ref", "source", "label", "context",
          "labelText", "labelForms", "text", "embedHash", "placePath", "kindIds", "attributes", "dietary", "tier",
          "lat", "lng", "updatedAt")
        SELECT gen_random_uuid(), r.business_id, r.ref, r.source, r.label::jsonb, r.context::jsonb,
          r.label_text, string_to_array(r.label_forms, chr(31)), r.text, r.hash, r.place_path, r.kind_ids::uuid[], r.attributes::jsonb,
          r.dietary::"Dietary"[], r.tier::"Tier", r.lat, r.lng, now()
        FROM unnest(
          ${col((r) => r.businessId)}::uuid[], ${col((r) => r.ref)}::text[],
          ${col((r) => r.source)}::text[], ${col((r) => JSON.stringify(r.label))}::text[],
          ${col((r) => (r.context ? JSON.stringify(r.context) : null))}::text[],
          ${col((r) => r.labelText)}::text[], ${col((r) => r.labelForms.join("\u001f"))}::text[],
          ${col((r) => r.text)}::text[],
          ${col((r) => r.hash)}::text[], ${col((r) => r.placePath)}::text[],
          ${col((r) => literal(r.kindIds))}::text[], ${col((r) => JSON.stringify(r.attributes))}::text[],
          ${col((r) => literal(r.dietary))}::text[], ${col((r) => r.tier)}::text[],
          ${col((r) => r.lat)}::float8[], ${col((r) => r.lng)}::float8[]
        ) AS r(business_id, ref, source, label, context, label_text, label_forms, text, hash, place_path,
          kind_ids, attributes, dietary, tier, lat, lng)`;
    };
    await this.prisma.$transaction(async (tx) => {
      if (ids === null) await tx.$executeRaw`DELETE FROM "SearchOffering"`;
      else
        await tx.$executeRaw`DELETE FROM "SearchOffering" WHERE "businessId" = ANY(${ids}::uuid[])`;
      for (let start = 0; start < rows.length; start += OFFERING_BATCH) await insert(tx, start);
    }, OFFERING_TX);
    return rows.length;
  }

  /** Embeds the texts no stored vector has yet (an all-zero vector is never stored). */
  private async embedOfferings(rows: { hash: string; embedText: string }[]): Promise<void> {
    const texts = new Map(rows.map((r) => [r.hash, r.embedText]));
    const hashes = [...texts.keys()];
    const stored = new Set<string>();
    for (let start = 0; start < hashes.length; start += 10_000)
      for (const { hash } of await this.prisma.$queryRaw<{ hash: string }[]>`
        SELECT hash FROM "SearchEmbedding" WHERE hash = ANY(${hashes.slice(start, start + 10_000)}::text[])`)
        stored.add(hash);
    const missing = hashes.filter((h) => !stored.has(h));
    for (let start = 0; start < missing.length; start += EMBED_BATCH) {
      const batch = missing.slice(start, start + EMBED_BATCH);
      const vectors = await this.embeddings.embed(
        batch.map((h) => texts.get(h)!),
        "document",
      );
      const keep = batch.flatMap((hash, i) => {
        const v = storedVector(vectors[i]);
        return v ? [{ hash, v }] : [];
      });
      if (keep.length === 0) continue;
      await this.prisma.$executeRaw`
        INSERT INTO "SearchEmbedding" ("hash", "embedding")
        SELECT * FROM unnest(${keep.map((k) => k.hash)}::text[], ${keep.map((k) => k.v)}::vector[])
        ON CONFLICT ("hash") DO NOTHING`;
    }
  }

  private async write(rows: DocumentRow[]): Promise<void> {
    for (let start = 0; start < rows.length; start += EMBED_BATCH) {
      const batch = rows.slice(start, start + EMBED_BATCH);
      const hashes = batch.map((r) =>
        createHash("sha256")
          .update(`${this.embeddings.name}\n${r.embedText}`)
          .digest("hex")
          .slice(0, 32),
      );
      const stored = new Map(
        (
          await this.prisma.$queryRaw<{ entityId: string; embedHash: string | null }[]>`
            SELECT "entityId", "embedHash" FROM "SearchDocument"
            WHERE "entityType" = ${batch[0]!.entityType}::"SearchEntity"
              AND "entityId" = ANY(${batch.map((r) => r.entityId)}::uuid[])
              AND embedding IS NOT NULL`
        ).map((s) => [s.entityId, s.embedHash]),
      );
      const changed = batch.flatMap((r, i) => (stored.get(r.entityId) === hashes[i] ? [] : [i]));
      const fresh = await this.embeddings.embed(
        changed.map((i) => batch[i]!.embedText),
        "document",
      );
      const vectors = new Map(changed.map((i, n) => [i, fresh[n]]));
      const values = batch.map(
        (r, i) => Prisma.sql`(
        gen_random_uuid(), ${r.entityType}::"SearchEntity", ${r.entityId}::uuid, ${r.slug}, ${r.placePath},
        ${r.kindIds}::uuid[], ${JSON.stringify(r.attributes)}::jsonb, ${r.tier}::"Tier", ${r.lat}, ${r.lng},
        ${r.nameText}, ${r.text}, ${storedVector(vectors.get(i))}::vector, ${hashes[i]}, ${r.completeness}, now())`,
      );
      // An unchanged hash keeps the stored vector (no re-embedding); a changed one takes the new one.
      await this.prisma.$executeRaw`
        INSERT INTO "SearchDocument" ("id", "entityType", "entityId", "slug", "placePath", "kindIds",
          "attributes", "tier", "lat", "lng", "nameText", "text", "embedding", "embedHash", "completeness", "updatedAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("entityType", "entityId") DO UPDATE SET
          "slug" = EXCLUDED."slug", "placePath" = EXCLUDED."placePath", "kindIds" = EXCLUDED."kindIds",
          "attributes" = EXCLUDED."attributes", "tier" = EXCLUDED."tier", "lat" = EXCLUDED."lat",
          "lng" = EXCLUDED."lng", "nameText" = EXCLUDED."nameText", "text" = EXCLUDED."text",
          "embedding" = CASE
            WHEN "SearchDocument"."embedHash" = EXCLUDED."embedHash" AND "SearchDocument"."embedding" IS NOT NULL
            THEN "SearchDocument"."embedding" ELSE EXCLUDED."embedding" END,
          "embedHash" = EXCLUDED."embedHash",
          "completeness" = EXCLUDED."completeness", "updatedAt" = EXCLUDED."updatedAt"`;
    }
  }
}
