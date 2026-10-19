import { Injectable } from "@nestjs/common";
import { Prisma, type Business, type Dietary, type Place } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ADDRESS_HIDDEN_SQL } from "./public-point.js";

export type BusinessWithPlace = Business & { place: { slug: string; lat: number; lng: number } };
const placeRef = { select: { slug: true, lat: true, lng: true } } as const;

export interface PageArgs {
  placeIds: string[];
  /** The kind and its sub-kinds; undefined lists every kind. */
  kindIds?: string[];
  offset: number;
  limit: number;
  /** When set, only businesses open at this moment are listed (and paged). */
  openAt: Date | null;
  /** Only businesses whose attributes say they deliver. */
  delivers: boolean;
  /** Only businesses with every one of these whole-business dietary facts. */
  dietary: Dietary[];
  /** Sort by distance from this point (used once, never stored). */
  near: { lat: number; lng: number } | null;
}
export type PageRow = BusinessWithPlace & { distanceKm: number | null };

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

  /**
   * One SQL query picks the page (filters, order, offset), then Prisma loads those rows. Open now
   * is computed in SQL (darb_open_at), so pages never skip or repeat.
   */
  async page(args: PageArgs): Promise<{ rows: PageRow[]; hasMore: boolean }> {
    if (args.placeIds.length === 0) return { rows: [], hasMore: false };
    const here = args.near
      ? Prisma.sql`ST_SetSRID(ST_MakePoint(${args.near.lng}, ${args.near.lat}), 4326)::geography`
      : null;
    const where = [
      Prisma.sql`b.status = 'published'`,
      Prisma.sql`pk.status = 'active'`,
      Prisma.sql`b."placeId" = ANY(${args.placeIds}::uuid[])`,
      ...(args.kindIds
        ? [
            Prisma.sql`EXISTS (SELECT 1 FROM "BusinessKind" bk WHERE bk."businessId" = b.id AND bk."kindId" = ANY(${args.kindIds}::uuid[]))`,
          ]
        : []),
      ...(args.openAt ? [Prisma.sql`darb_open_at(b.hours, ${args.openAt})`] : []),
      ...(args.delivers ? [Prisma.sql`b.attributes @> '{"delivers": true}'::jsonb`] : []),
      ...(args.dietary.length > 0 ? [Prisma.sql`b.dietary @> ${args.dietary}::"Dietary"[]`] : []),
    ];
    // A business that keeps its street private is measured from its place's centre, never its pin.
    const km = here
      ? Prisma.sql`ST_Distance(CASE WHEN ${ADDRESS_HIDDEN_SQL} THEN p.point ELSE b.point END, ${here}) / 1000`
      : Prisma.sql`NULL::float8`;
    const order = here
      ? Prisma.sql`km ASC, b.slug ASC, b.id ASC`
      : Prisma.sql`b.tier DESC, b.slug ASC, b.id ASC`;
    const picked = await this.prisma.$queryRaw<{ id: string; km: number | null }[]>`
      SELECT b.id, ${km} AS km
      FROM "Business" b
      JOIN "Kind" pk ON pk.id = b."primaryKindId"
      JOIN "Place" p ON p.id = b."placeId"
      WHERE ${Prisma.join(where, " AND ")}
      ORDER BY ${order}
      OFFSET ${args.offset} LIMIT ${args.limit + 1}`;
    const pageIds = picked.slice(0, args.limit);
    const loaded = await this.prisma.business.findMany({
      where: { id: { in: pageIds.map((p) => p.id) } },
      include: { place: placeRef },
    });
    const byId = new Map(loaded.map((r) => [r.id, r]));
    return {
      rows: pageIds.flatMap(({ id, km: d }) => {
        const row = byId.get(id);
        return row ? [{ ...row, distanceKm: d === null ? null : Number(d) }] : [];
      }),
      hasMore: picked.length > args.limit,
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
        place: { select: { slug: true, path: true, lat: true, lng: true } },
        brand: { select: { slug: true } },
        // A helper's credit, read now: turning it off hides it on every card at once.
        joinRequests: {
          where: { source: "field", createdBy: { is: { isAdmin: false, helperCredit: true } } },
          select: { createdBy: { select: { helperName: true, helperCredit: true } } },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
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

  /** See PlaceCountsSchema. One grouped query; places' materialized paths end with '/'. */
  async placeCounts(): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<{ slug: string; n: number }[]>`
      SELECT s.slug, (COUNT(DISTINCT b.id) FILTER (WHERE pk.id IS NOT NULL))::int AS n
      FROM "Place" s
      LEFT JOIN "Place" p ON p.path LIKE s.path || '%'
      LEFT JOIN "Business" b ON b."placeId" = p.id AND b.status = 'published'
      LEFT JOIN "Kind" pk ON pk.id = b."primaryKindId" AND pk.status = 'active'
      WHERE s.status = 'live' AND s.type <> 'country'
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
