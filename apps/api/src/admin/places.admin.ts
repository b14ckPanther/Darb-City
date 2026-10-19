import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminPlaceListQueryDto,
  type AdminPlaceCreateDto,
  type AdminPlaceDto,
  type AdminPlacePatchDto,
} from "@darb/contracts";
import { pickText, type Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import { decodeCursor, encodeCursor } from "../businesses/cursor.js";
import type { Place, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { conflict, invalid, notFound, outcome } from "./outcome.js";
import { nameOrSlugFilters } from "./text-search.js";
import { webTags } from "./tags.js";
import { seedSource } from "./seed-source.js";

const STATUSES = new Set(["live", "soon"]);
/** Every place there is, with room to grow; a list never reads more. */
const PLACE_LIST_CAP = 5000;

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
  seedSource: seedSource.place(p),
});

/** Name text in any language, or the slug. */
export const nameOrSlug = (q: string): Prisma.PlaceWhereInput[] => [
  ...nameOrSlugFilters(q),
  { aliases: { has: q } },
];

@Injectable()
export class PlacesAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  /**
   * Places are few (about 1,100), so a list reads every match once, counts businesses per place,
   * sorts in memory (names in the asked language) and returns one page with the total.
   */
  async list(query: AdminPlaceListQueryDto) {
    const offset = query.page ? (query.page - 1) * query.limit : (decodeCursor(query.cursor) ?? 0);
    const where: Prisma.PlaceWhereInput = {
      ...(query.q ? { OR: nameOrSlug(query.q) } : {}),
      ...(query.status && STATUSES.has(query.status)
        ? { status: query.status as "live" | "soon" }
        : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [rows, counts] = await Promise.all([
      this.prisma.place.findMany({ where, orderBy: { slug: "asc" }, take: PLACE_LIST_CAP }),
      this.prisma.business.groupBy({
        by: ["placeId"],
        where: { tier: { not: "example" } },
        _count: { _all: true },
      }),
    ]);
    const count = new Map(counts.map((c) => [c.placeId, c._count._all]));
    const parentIds = [...new Set(rows.flatMap((r) => (r.parentId ? [r.parentId] : [])))];
    const parents = new Map(
      (
        await this.prisma.place.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, name: true },
        })
      ).map((p) => [p.id, p.name as Localized]),
    );
    const locale = query.locale ?? "he";
    const name = (p: Place) => pickText(p.name as Localized, locale);
    // No sort asked for: by address, as this list always was.
    const sort = query.sort;
    const dir = (query.dir ?? (sort === "name" || !sort ? "asc" : "desc")) === "asc" ? 1 : -1;
    const collator = new Intl.Collator(locale);
    const key = (p: Place) =>
      sort === "population"
        ? (p.population ?? -1)
        : sort === "businesses"
          ? (count.get(p.id) ?? 0)
          : 0;
    const sorted = [...rows].sort((a, b) =>
      !sort
        ? dir * (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
        : sort === "name"
          ? dir * collator.compare(name(a), name(b))
          : dir * (key(a) - key(b)) || collator.compare(name(a), name(b)),
    );
    const page = sorted.slice(offset, offset + query.limit);
    return {
      items: page.map((p) => ({
        ...toAdminPlace(p),
        parentName: p.parentId ? (parents.get(p.parentId) ?? null) : null,
        businessCount: count.get(p.id) ?? 0,
      })),
      nextCursor: sorted.length > offset + query.limit ? encodeCursor(offset + query.limit) : null,
      total: sorted.length,
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
    const { row, revalidated } = await this.writer.writeReporting(
      actor,
      "update",
      "place",
      async (tx) => {
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
      },
    );
    return { status: 200 as const, body: { ...toAdminPlace(row), ...outcome(revalidated) } };
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
