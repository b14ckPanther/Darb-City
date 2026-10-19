import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminKindCreateDto,
  type AdminKindDto,
  type AdminKindListQueryDto,
  type AdminKindPatchDto,
  type AdminSynonymDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { SCREEN_SCHEMA } from "@darb/seed";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import type { Kind, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { LIST_CAP } from "./list-cap.js";
import { conflict, invalid, notFound, outcome } from "./outcome.js";
import { webTags } from "./tags.js";
import { nameOrSlugFilters } from "./text-search.js";
import { seedSource } from "./seed-source.js";

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
  seedSource: seedSource.kind(k.slug),
});
const withCount = { _count: { select: { primaryFor: true } } } as const;
/** How many ancestors the cycle check walks before it gives up and refuses. */
const MAX_KIND_DEPTH = 10;

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
            OR: nameOrSlugFilters(q),
          }
        : {}),
    };
    const rows = await this.prisma.kind.findMany({
      where,
      include: withCount,
      orderBy: [{ sectorId: "asc" }, { order: "asc" }],
      take: LIST_CAP,
    });
    return rows.map(toAdminKind);
  }

  async get(id: string) {
    const k = await this.prisma.kind.findUnique({ where: { id }, include: withCount });
    return k ? { status: 200 as const, body: toAdminKind(k) } : notFound("kind");
  }

  /**
   * A parent must sit in the same sector and must not be the kind or one of its descendants.
   * The ancestor walk is capped; a tree too deep to finish checking is refused, never allowed.
   */
  private async parentProblem(
    kindId: string | null,
    sectorId: string,
    parentId: string,
  ): Promise<{ message: string; code?: string } | null> {
    let cursor = await this.prisma.kind.findUnique({ where: { id: parentId } });
    if (!cursor) return { message: "The parent kind does not exist" };
    if (cursor.sectorId !== sectorId)
      return { message: "The parent kind must be in the same sector" };
    const visited = new Set<string>();
    for (let depth = 0; cursor; depth++) {
      if (cursor.id === kindId)
        return { message: "A kind cannot sit under itself or its own sub-kinds" };
      if (visited.has(cursor.id)) return { message: "The kind tree already has a loop" };
      if (depth >= MAX_KIND_DEPTH)
        return { message: "The kind tree is too deep", code: "kind_tree_too_deep" };
      visited.add(cursor.id);
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
      if (problem) return invalid(problem.message, undefined, problem.code);
    }
    const row = await this.writer.write(actor, "create", "kind", async (tx) => {
      const k = await tx.kind.create({
        data: {
          ...dto,
          status: "hidden",
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
    // Sub-kinds must share their parent's sector; moving the whole subtree is not offered in v1.
    if (
      patch.sectorId &&
      patch.sectorId !== before.sectorId &&
      (await this.prisma.kind.count({ where: { parentKindId: id } })) > 0
    )
      return conflict(
        "Move or detach this kind's sub-kinds before changing its sector",
        "kind_has_sub_kinds",
      );
    const parentId = patch.parentKindId === undefined ? before.parentKindId : patch.parentKindId;
    if (parentId) {
      const problem = await this.parentProblem(id, sectorId, parentId);
      if (problem) return invalid(problem.message, undefined, problem.code);
    }
    const { row, revalidated } = await this.writer.writeReporting(
      actor,
      "update",
      "kind",
      async (tx) => {
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
      },
    );
    return { status: 200 as const, body: { ...toAdminKind(row), ...outcome(revalidated) } };
  }

  /** One more search word, from the search gaps; a word it already has changes nothing. */
  async synonym(actor: AdminActor, id: string, dto: AdminSynonymDto) {
    const before = await this.prisma.kind.findUnique({ where: { id }, include: withCount });
    if (!before) return notFound("kind");
    const synonyms = before.synonyms as AdminKindDto["synonyms"];
    const list = synonyms[dto.locale] ?? [];
    if (list.some((w) => w.toLowerCase() === dto.word.toLowerCase()))
      return { status: 200 as const, body: toAdminKind(before) };
    if (list.length >= 80) return invalid("This kind already has the most words it can hold");
    const next = { ...synonyms, [dto.locale]: [...list, dto.word] };
    const row = await this.writer.write(actor, "update", "kind", async (tx) => {
      const k = await tx.kind.update({
        where: { id },
        data: { synonyms: json(next), editedAt: new Date() },
        include: withCount,
      });
      return {
        row: k,
        entityId: id,
        fields: ["synonyms"],
        tags: webTags.kind(),
        search: [{ entity: "kind" as const, ids: [id] }],
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
      synonym: async ({ params, body }) => this.kinds.synonym(actor, params.id, body),
    });
  }
}
