import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminKindCreateDto,
  type AdminKindDto,
  type AdminKindListQueryDto,
  type AdminKindPatchDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { SCREEN_SCHEMA } from "@darb/seed";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import type { Kind, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { conflict, invalid, notFound } from "./outcome.js";
import { webTags } from "./tags.js";

type Synonyms = AdminKindDto["synonyms"];
type KindRow = Kind & { _count: { primaryFor: number } };

export const toAdminKind = (k: KindRow): AdminKindDto => ({
  id: k.id,
  slug: k.slug,
  sectorId: k.sectorId,
  parentKindId: k.parentKindId,
  name: k.name as Localized,
  synonyms: k.synonyms as Synonyms,
  template: k.template,
  attributes: k.attributes,
  icon: k.icon,
  order: k.order,
  status: k.status,
  businessCount: k._count.primaryFor,
  editedAt: k.editedAt?.toISOString() ?? null,
});
const withCount = { _count: { select: { primaryFor: true } } } as const;

@Injectable()
export class KindsAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  async list(query: AdminKindListQueryDto) {
    const q = query.q;
    const where: Prisma.KindWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.sector ? { sectorId: query.sector } : {}),
      ...(q
        ? {
            OR: [
              { slug: { contains: q.toLowerCase() } },
              ...(["he", "ar", "en"] as const).map((l) => ({
                name: { path: [l], string_contains: q },
              })),
            ],
          }
        : {}),
    };
    const rows = await this.prisma.kind.findMany({
      where,
      include: withCount,
      orderBy: [{ sectorId: "asc" }, { order: "asc" }],
    });
    return rows.map(toAdminKind);
  }

  async get(id: string) {
    const k = await this.prisma.kind.findUnique({ where: { id }, include: withCount });
    return k ? { status: 200 as const, body: toAdminKind(k) } : notFound("kind");
  }

  /** A parent must sit in the same sector and must not be the kind or one of its descendants. */
  private async parentProblem(
    kindId: string | null,
    sectorId: string,
    parentId: string,
  ): Promise<string | null> {
    let cursor = await this.prisma.kind.findUnique({ where: { id: parentId } });
    if (!cursor) return "The parent kind does not exist";
    if (cursor.sectorId !== sectorId) return "The parent kind must be in the same sector";
    for (let depth = 0; cursor && depth < 10; depth++) {
      if (cursor.id === kindId) return "A kind cannot sit under itself or its own sub-kinds";
      cursor = cursor.parentKindId
        ? await this.prisma.kind.findUnique({ where: { id: cursor.parentKindId } })
        : null;
    }
    return null;
  }

  async create(actor: AdminActor, dto: AdminKindCreateDto) {
    if (!(await this.prisma.sector.findUnique({ where: { id: dto.sectorId } })))
      return notFound("sector");
    if (await this.prisma.kind.findUnique({ where: { slug: dto.slug } }))
      return conflict(`The address "${dto.slug}" is already used by another kind`);
    if (dto.parentKindId) {
      const problem = await this.parentProblem(null, dto.sectorId, dto.parentKindId);
      if (problem) return invalid(problem);
    }
    const row = await this.writer.write(actor, "create", "kind", async (tx) => {
      const k = await tx.kind.create({
        data: {
          ...dto,
          name: json(dto.name),
          synonyms: json(dto.synonyms),
          contentSchema: json(SCREEN_SCHEMA),
          editedAt: new Date(),
        },
        include: withCount,
      });
      return {
        row: k,
        entityId: k.id,
        fields: Object.keys(dto).sort(),
        tags: webTags.kind(),
        search: [{ entity: "kind" as const, ids: [k.id] }],
      };
    });
    return { status: 201 as const, body: toAdminKind(row) };
  }

  async update(actor: AdminActor, id: string, patch: AdminKindPatchDto) {
    const before = await this.prisma.kind.findUnique({ where: { id } });
    if (!before) return notFound("kind");
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return invalid("Nothing to change");
    const sectorId = patch.sectorId ?? before.sectorId;
    if (patch.sectorId && !(await this.prisma.sector.findUnique({ where: { id: patch.sectorId } })))
      return notFound("sector");
    const parentId = patch.parentKindId === undefined ? before.parentKindId : patch.parentKindId;
    if (parentId) {
      const problem = await this.parentProblem(id, sectorId, parentId);
      if (problem) return invalid(problem);
    }
    const row = await this.writer.write(actor, "update", "kind", async (tx) => {
      const k = await tx.kind.update({
        where: { id },
        data: {
          ...patch,
          ...(patch.name ? { name: json(patch.name) } : {}),
          ...(patch.synonyms ? { synonyms: json(patch.synonyms) } : {}),
          editedAt: new Date(),
        },
        include: withCount,
      });
      return {
        row: k,
        entityId: id,
        fields,
        tags: webTags.kind(),
        search: [{ entity: "kind" as const, ids: [id] }],
        immediate: before.status === "active" && k.status === "hidden" ? true : undefined,
      };
    });
    return { status: 200 as const, body: toAdminKind(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminKindsController {
  constructor(private readonly kinds: KindsAdmin) {}

  @TsRestHandler(contract.admin.kinds)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.kinds, {
      list: async ({ query }) => ({ status: 200, body: await this.kinds.list(query) }),
      get: async ({ params }) => this.kinds.get(params.id),
      create: async ({ body }) => this.kinds.create(actor, body),
      update: async ({ params, body }) => this.kinds.update(actor, params.id, body),
    });
  }
}
