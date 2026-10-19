import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminSectorCreateDto,
  type AdminSectorDto,
  type AdminSectorPatchDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import type { Sector } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { LIST_CAP } from "./list-cap.js";
import { conflict, invalid, notFound } from "./outcome.js";
import { webTags } from "./tags.js";
import { seedSource } from "./seed-source.js";

export const toAdminSector = (s: Sector): AdminSectorDto => ({
  id: s.id,
  slug: s.slug,
  name: s.name as Localized,
  tagline: s.tagline as Localized,
  accent: s.accent,
  order: s.order,
  editedAt: s.editedAt?.toISOString() ?? null,
  seedSource: seedSource.sector(s.slug),
});

@Injectable()
export class SectorsAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  /** Each sector with how many kinds it has and how many real businesses those kinds hold. */
  async list() {
    const [sectors, kinds, businesses] = await Promise.all([
      this.prisma.sector.findMany({ orderBy: { order: "asc" }, take: LIST_CAP }),
      this.prisma.kind.groupBy({ by: ["sectorId"], _count: { _all: true } }),
      this.prisma.$queryRaw<{ sectorId: string; count: number }[]>`
        SELECT k."sectorId", COUNT(*)::int AS count FROM "Business" b
        JOIN "Kind" k ON k.id = b."primaryKindId"
        WHERE b.tier <> 'example'
        GROUP BY k."sectorId"`,
    ]);
    const kindCount = new Map(kinds.map((k) => [k.sectorId, k._count._all]));
    const businessCount = new Map(businesses.map((b) => [b.sectorId, b.count]));
    return sectors.map((s) => ({
      ...toAdminSector(s),
      kindCount: kindCount.get(s.id) ?? 0,
      businessCount: businessCount.get(s.id) ?? 0,
    }));
  }

  async create(actor: AdminActor, dto: AdminSectorCreateDto) {
    if (await this.prisma.sector.findUnique({ where: { slug: dto.slug } }))
      return conflict(`The address "${dto.slug}" is already used by another sector`);
    const row = await this.writer.write(actor, "create", "sector", async (tx) => {
      const s = await tx.sector.create({
        data: { ...dto, name: json(dto.name), tagline: json(dto.tagline), editedAt: new Date() },
      });
      return { row: s, entityId: s.id, fields: Object.keys(dto).sort(), tags: webTags.sector() };
    });
    return { status: 201 as const, body: toAdminSector(row) };
  }

  async update(actor: AdminActor, id: string, patch: AdminSectorPatchDto) {
    if (!(await this.prisma.sector.findUnique({ where: { id } }))) return notFound("sector");
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return invalid("Nothing to change");
    const row = await this.writer.write(actor, "update", "sector", async (tx) => {
      const s = await tx.sector.update({
        where: { id },
        data: {
          ...patch,
          ...(patch.name ? { name: json(patch.name) } : {}),
          ...(patch.tagline ? { tagline: json(patch.tagline) } : {}),
          editedAt: new Date(),
        },
      });
      return { row: s, entityId: id, fields, tags: webTags.sector() };
    });
    return { status: 200 as const, body: toAdminSector(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminSectorsController {
  constructor(private readonly sectors: SectorsAdmin) {}

  @TsRestHandler(contract.admin.sectors)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.sectors, {
      list: async () => ({ status: 200, body: await this.sectors.list() }),
      create: async ({ body }) => this.sectors.create(actor, body),
      update: async ({ params, body }) => this.sectors.update(actor, params.id, body),
    });
  }
}
