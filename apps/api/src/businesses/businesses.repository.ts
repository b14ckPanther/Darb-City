import { Injectable } from "@nestjs/common";
import { isOpenAt, type Hours } from "@darb/core";
import type { Business, Place, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

export type BusinessWithPlace = Business & { place: { slug: string } };

export interface PageArgs {
  placeIds: string[];
  /** The kind and its sub-kinds; undefined lists every kind. */
  kindIds?: string[];
  offset: number;
  limit: number;
  /** When set, only businesses open at this moment are listed (and paged). */
  openAt: Date | null;
}

const ORDER: Prisma.BusinessOrderByWithRelationInput[] = [
  { tier: "desc" },
  { slug: "asc" },
  { id: "asc" },
];

const depth = (path: string) => path.split("/").length;

/**
 * The business in the listed place itself, else the one nearest it by path depth; a tie at the
 * same depth goes to the first place path in code-point order, so the answer never depends on
 * row order.
 */
export function closestInSubtree<T extends { place: { path: string } }>(
  rows: readonly T[],
  placePath: string,
): T | null {
  const rank = (r: T) => (r.place.path === placePath ? 0 : depth(r.place.path));
  const sorted = [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) || (a.place.path < b.place.path ? -1 : a.place.path > b.place.path ? 1 : 0),
  );
  return sorted[0] ?? null;
}

@Injectable()
export class BusinessesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async page(args: PageArgs): Promise<{ rows: BusinessWithPlace[]; hasMore: boolean }> {
    const where: Prisma.BusinessWhereInput = {
      status: "published",
      placeId: { in: args.placeIds },
      primaryKind: { is: { status: "active" } },
      ...(args.kindIds ? { kinds: { some: { kindId: { in: args.kindIds } } } } : {}),
    };
    const include = { place: { select: { slug: true } } } as const;
    if (!args.openAt) {
      const rows = await this.prisma.business.findMany({
        where,
        orderBy: ORDER,
        skip: args.offset,
        take: args.limit + 1,
        include,
      });
      return { rows: rows.slice(0, args.limit), hasMore: rows.length > args.limit };
    }
    // Open-now depends on Israel time, so it is computed here, then paged.
    const at = args.openAt;
    const candidates = await this.prisma.business.findMany({
      where,
      orderBy: ORDER,
      select: { id: true, hours: true },
    });
    const openIds = candidates
      .filter((b) => isOpenAt(b.hours as unknown as Hours, at))
      .map((b) => b.id);
    const window = openIds.slice(args.offset, args.offset + args.limit + 1);
    const pageIds = window.slice(0, args.limit);
    const rows = await this.prisma.business.findMany({ where: { id: { in: pageIds } }, include });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      rows: pageIds
        .map((id) => byId.get(id))
        .filter((r): r is BusinessWithPlace => r !== undefined),
      hasMore: window.length > args.limit,
    };
  }

  /**
   * A published business anywhere in the place's subtree, with only its active kinds. Slugs are
   * unique per place, so when several places in the subtree share one, the closest wins.
   */
  async detail(placePath: string, slug: string) {
    const rows = await this.prisma.business.findMany({
      where: {
        slug,
        status: "published",
        // paths end with '/', so a prefix never matches a sibling
        place: { path: { startsWith: placePath } },
        primaryKind: { is: { status: "active" } },
      },
      include: {
        kinds: { where: { kind: { is: { status: "active" } } }, select: { kindId: true } },
        place: { select: { slug: true, path: true } },
      },
    });
    return closestInSubtree(rows, placePath);
  }

  async countsByKind(placePath: string): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<{ slug: string; n: number }[]>`
      WITH RECURSIVE tree AS (
        SELECT id AS root, id FROM "Kind" WHERE status = 'active'
        UNION
        SELECT t.root, k.id FROM "Kind" k JOIN tree t ON k."parentKindId" = t.id
        WHERE k.status = 'active'
      )
      SELECT r.slug, COUNT(DISTINCT b.id)::int AS n
      FROM tree t
      JOIN "Kind" r ON r.id = t.root
      JOIN "BusinessKind" bk ON bk."kindId" = t.id
      JOIN "Business" b ON b.id = bk."businessId"
      JOIN "Kind" pk ON pk.id = b."primaryKindId"
      JOIN "Place" p ON p.id = b."placeId"
      WHERE b.status = 'published' AND pk.status = 'active' AND p.path LIKE ${`${placePath}%`}
      GROUP BY r.slug`;
    const active = await this.prisma.kind.findMany({
      where: { status: "active" },
      select: { slug: true },
    });
    const counts: Record<string, number> = Object.fromEntries(active.map((k) => [k.slug, 0]));
    for (const row of rows) counts[row.slug] = row.n;
    return counts;
  }

  /** See DensitySchema. One query; places' materialized paths end with '/'. */
  async density(): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<{ slug: string; n: number }[]>`
      SELECT s.slug, (COUNT(DISTINCT b.id) FILTER (WHERE pk.id IS NOT NULL))::int AS n
      FROM "Place" s
      LEFT JOIN "Place" p ON p.path LIKE s.path || '%'
      LEFT JOIN "Business" b ON b."placeId" = p.id AND b.status = 'published'
      LEFT JOIN "Kind" pk ON pk.id = b."primaryKindId" AND pk.status = 'active'
      WHERE s.status = 'live' AND s.type IN ('city', 'town', 'village')
      GROUP BY s.slug
      ORDER BY s.slug`;
    return Object.fromEntries(rows.map((r) => [r.slug, r.n]));
  }

  async nearestPlacesWithKind(
    kindIds: string[],
    lat: number,
    lng: number,
    limit: number,
  ): Promise<{ place: Place; count: number; distanceKm: number }[]> {
    if (kindIds.length === 0) return [];
    const rows = await this.prisma.$queryRaw<{ id: string; n: number; km: number }[]>`
      SELECT p.id, COUNT(DISTINCT b.id)::int AS n,
        ST_Distance(p.point, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 AS km
      FROM "Business" b
      JOIN "BusinessKind" bk ON bk."businessId" = b.id
      JOIN "Kind" pk ON pk.id = b."primaryKindId"
      JOIN "Place" p ON p.id = b."placeId"
      WHERE b.status = 'published' AND pk.status = 'active' AND p.status = 'live'
        AND bk."kindId" = ANY(${kindIds}::uuid[])
      GROUP BY p.id
      ORDER BY km ASC, p.slug ASC
      LIMIT ${limit}`;
    const places = await this.prisma.place.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
    const byId = new Map(places.map((p) => [p.id, p]));
    return rows.flatMap((r) => {
      const place = byId.get(r.id);
      return place ? [{ place, count: r.n, distanceKm: Number(r.km) }] : [];
    });
  }
}
