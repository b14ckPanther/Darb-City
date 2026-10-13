import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminListQueryDto,
  type AdminPlaceCreateDto,
  type AdminPlaceDto,
  type AdminPlacePatchDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import { decodeCursor, encodeCursor } from "../businesses/cursor.js";
import type { Place, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { conflict, invalid, notFound } from "./outcome.js";
import { webTags } from "./tags.js";

const STATUSES = new Set(["live", "soon"]);

export const toAdminPlace = (p: Place): AdminPlaceDto => ({
  id: p.id,
  slug: p.slug,
  type: p.type,
  parentId: p.parentId,
  path: p.path,
  name: p.name as Localized,
  aliases: p.aliases,
  lat: p.lat,
  lng: p.lng,
  population: p.population,
  cbsCode: p.cbsCode,
  status: p.status,
  editedAt: p.editedAt?.toISOString() ?? null,
});

/** Name text in any language, or the slug. */
export const nameOrSlug = (q: string): Prisma.PlaceWhereInput[] => [
  { slug: { contains: q.toLowerCase() } },
  ...(["he", "ar", "en"] as const).map((l) => ({ name: { path: [l], string_contains: q } })),
  { aliases: { has: q } },
];

@Injectable()
export class PlacesAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  async list(query: AdminListQueryDto) {
    const offset = decodeCursor(query.cursor) ?? 0;
    const where: Prisma.PlaceWhereInput = {
      ...(query.q ? { OR: nameOrSlug(query.q) } : {}),
      ...(query.status && STATUSES.has(query.status)
        ? { status: query.status as "live" | "soon" }
        : {}),
    };
    const rows = await this.prisma.place.findMany({
      where,
      orderBy: { slug: "asc" },
      skip: offset,
      take: query.limit + 1,
    });
    return {
      items: rows.slice(0, query.limit).map(toAdminPlace),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async get(id: string) {
    const p = await this.prisma.place.findUnique({ where: { id } });
    return p ? { status: 200 as const, body: toAdminPlace(p) } : notFound("place");
  }

  async create(actor: AdminActor, dto: AdminPlaceCreateDto) {
    const parent = await this.prisma.place.findUnique({ where: { id: dto.parentId } });
    if (!parent) return notFound("parent place");
    if (await this.prisma.place.findUnique({ where: { slug: dto.slug } }))
      return conflict(`The address "${dto.slug}" is already used by another place`);
    const row = await this.writer.write(actor, "create", "place", async (tx) => {
      const p = await tx.place.create({
        data: {
          slug: dto.slug,
          type: dto.type,
          parentId: parent.id,
          path: `${parent.path}${dto.slug}/`,
          name: json(dto.name),
          aliases: dto.aliases,
          lat: dto.lat,
          lng: dto.lng,
          population: dto.population,
          status: dto.status,
          editedAt: new Date(),
        },
      });
      return {
        row: p,
        entityId: p.id,
        fields: Object.keys(dto).sort(),
        tags: webTags.place(p.slug),
        search: [{ entity: "place" as const, ids: [p.id] }],
      };
    });
    return { status: 201 as const, body: toAdminPlace(row) };
  }

  async update(actor: AdminActor, id: string, patch: AdminPlacePatchDto) {
    const before = await this.prisma.place.findUnique({ where: { id } });
    if (!before) return notFound("place");
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return invalid("Nothing to change");
    const row = await this.writer.write(actor, "update", "place", async (tx) => {
      const p = await tx.place.update({
        where: { id },
        data: {
          ...patch,
          ...(patch.name ? { name: json(patch.name) } : {}),
          editedAt: new Date(),
        },
      });
      return {
        row: p,
        entityId: id,
        fields,
        tags: webTags.place(p.slug),
        search: [{ entity: "place" as const, ids: [id] }],
        immediate: before.status === "live" && p.status !== "live" ? true : undefined,
      };
    });
    return { status: 200 as const, body: toAdminPlace(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminPlacesController {
  constructor(private readonly places: PlacesAdmin) {}

  @TsRestHandler(contract.admin.places)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.places, {
      list: async ({ query }) => ({ status: 200, body: await this.places.list(query) }),
      get: async ({ params }) => this.places.get(params.id),
      create: async ({ body }) => this.places.create(actor, body),
      update: async ({ params, body }) => this.places.update(actor, params.id, body),
    });
  }
}
