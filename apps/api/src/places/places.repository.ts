import { Injectable } from "@nestjs/common";
import type { Place, PlaceStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

const SETTLEMENTS = ["city", "town", "village"] as const;

@Injectable()
export class PlacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  bySlug(slug: string): Promise<Place | null> {
    return this.prisma.place.findUnique({ where: { slug } });
  }

  /** Root first, excluding the place itself. Uses the materialized path. */
  async ancestors(place: Place): Promise<Place[]> {
    const slugs = place.path.split("/").filter(Boolean).slice(0, -1);
    const rows = await this.prisma.place.findMany({ where: { slug: { in: slugs } } });
    return slugs.map((s) => rows.find((r) => r.slug === s)).filter((r): r is Place => r !== undefined);
  }

  children(placeId: string): Promise<Place[]> {
    return this.prisma.place.findMany({ where: { parentId: placeId }, orderBy: { slug: "asc" } });
  }

  listSettlements(status?: PlaceStatus): Promise<Place[]> {
    return this.prisma.place.findMany({
      where: { type: { in: [...SETTLEMENTS] }, ...(status ? { status } : {}) },
      orderBy: { slug: "asc" },
    });
  }

  async nearestLive(lat: number, lng: number): Promise<Place | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Place"
      WHERE status = 'live' AND type IN ('city', 'town', 'village')
      ORDER BY "point" <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      LIMIT 1`;
    const id = rows[0]?.id;
    return id ? this.prisma.place.findUnique({ where: { id } }) : null;
  }

  /** The place and every place beneath it. */
  async subtreeIds(place: Place): Promise<string[]> {
    const rows = await this.prisma.place.findMany({ where: { path: { startsWith: place.path } }, select: { id: true } });
    return rows.map((r) => r.id);
  }
}
