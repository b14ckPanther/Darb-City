import { Inject, Injectable } from "@nestjs/common";
import type { Hours, Localized } from "@darb/core";
import { EMBEDDING_PROVIDER, vectorLiteral, type EmbeddingProvider } from "../ai/embeddings.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  businessDocument,
  kindDocument,
  placeDocument,
  type DocumentRow,
  type SearchEntityName,
} from "./documents.js";

export const EMBED_BATCH = 128;
export const CASCADE_CHUNK = 500;

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

  async indexAll(): Promise<Record<SearchEntityName, number>> {
    const out = { place: 0, kind: 0, business: 0 };
    for (const entity of ["place", "kind", "business"] as const) {
      const rows = await this.rows(entity, null);
      await this.write(rows);
      await this.prisma.$executeRaw`
        DELETE FROM "SearchDocument" WHERE "entityType" = ${entity}::"SearchEntity"
        AND NOT ("entityId" = ANY(${rows.map((r) => r.entityId)}::uuid[]))`;
      out[entity] = rows.length;
    }
    return out;
  }

  async index(
    entity: SearchEntityName,
    ids: string[],
  ): Promise<{ upserted: number; deleted: number }> {
    if (ids.length === 0) return { upserted: 0, deleted: 0 };
    const rows = await this.rows(entity, ids);
    await this.write(rows);
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

  private async rows(entity: SearchEntityName, ids: string[] | null): Promise<DocumentRow[]> {
    const only = ids ? { id: { in: ids } } : {};
    if (entity === "place") {
      const places = await this.prisma.place.findMany({ where: only });
      return places.map((p) => placeDocument({ ...p, name: p.name as Localized }));
    }
    if (entity === "kind") {
      const kinds = await this.prisma.kind.findMany({ where: { ...only, status: "active" } });
      return kinds.map((k) =>
        kindDocument({ ...k, name: k.name as Localized, synonyms: k.synonyms as Synonyms }),
      );
    }
    const businesses = await this.prisma.business.findMany({
      where: { ...only, status: "published", primaryKind: { is: { status: "active" } } },
      include: {
        place: { select: { path: true, name: true } },
        kinds: { where: { kind: { is: { status: "active" } } }, include: { kind: true } },
      },
      orderBy: { id: "asc" },
    });
    return businesses.map((b) =>
      businessDocument({
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
        kinds: b.kinds.map(({ kind }) => ({
          id: kind.id,
          name: kind.name as Localized,
          synonyms: kind.synonyms as Synonyms,
        })),
      }),
    );
  }

  private async write(rows: DocumentRow[]): Promise<void> {
    for (let start = 0; start < rows.length; start += EMBED_BATCH) {
      const batch = rows.slice(start, start + EMBED_BATCH);
      const vectors = await this.embeddings.embed(
        batch.map((r) => r.embedText),
        "document",
      );
      const values = batch.map(
        (r, i) => Prisma.sql`(
        gen_random_uuid(), ${r.entityType}::"SearchEntity", ${r.entityId}::uuid, ${r.slug}, ${r.placePath},
        ${r.kindIds}::uuid[], ${JSON.stringify(r.attributes)}::jsonb, ${r.tier}::"Tier", ${r.lat}, ${r.lng},
        ${r.nameText}, ${r.text}, ${storedVector(vectors[i])}::vector, ${r.completeness}, now())`,
      );
      await this.prisma.$executeRaw`
        INSERT INTO "SearchDocument" ("id", "entityType", "entityId", "slug", "placePath", "kindIds",
          "attributes", "tier", "lat", "lng", "nameText", "text", "embedding", "completeness", "updatedAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("entityType", "entityId") DO UPDATE SET
          "slug" = EXCLUDED."slug", "placePath" = EXCLUDED."placePath", "kindIds" = EXCLUDED."kindIds",
          "attributes" = EXCLUDED."attributes", "tier" = EXCLUDED."tier", "lat" = EXCLUDED."lat",
          "lng" = EXCLUDED."lng", "nameText" = EXCLUDED."nameText", "text" = EXCLUDED."text",
          "embedding" = EXCLUDED."embedding", "completeness" = EXCLUDED."completeness",
          "updatedAt" = EXCLUDED."updatedAt"`;
    }
  }
}
