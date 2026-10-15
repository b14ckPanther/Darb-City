import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminPlanCreateDto,
  type AdminPlanDto,
  type AdminPlanPatchDto,
} from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import type { Plan } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toPlanDto } from "../pricing/pricing.mapper.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { LIST_CAP } from "./list-cap.js";
import { conflict, invalid, notFound } from "./outcome.js";
import { seedSource } from "./seed-source.js";
import { webTags } from "./tags.js";

export const toAdminPlan = (p: Plan): AdminPlanDto => ({
  ...toPlanDto(p),
  status: p.status,
  editedAt: p.editedAt?.toISOString() ?? null,
  seedSource: seedSource.plan(p.slug),
});

/** The DTO's JSON fields, ready for Prisma; the rest pass through as they are. */
const jsonFields = (dto: AdminPlanPatchDto) => ({
  ...dto,
  ...(dto.name ? { name: json(dto.name) } : {}),
  ...(dto.tagline ? { tagline: json(dto.tagline) } : {}),
  ...(dto.priceNote ? { priceNote: json(dto.priceNote) } : {}),
  ...(dto.features ? { features: json(dto.features) } : {}),
  ...(dto.ctaLabel ? { ctaLabel: json(dto.ctaLabel) } : {}),
  ...(dto.finePrint ? { finePrint: json(dto.finePrint) } : {}),
});

@Injectable()
export class PlansAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  async list() {
    const rows = await this.prisma.plan.findMany({
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      take: LIST_CAP,
    });
    return rows.map(toAdminPlan);
  }

  async get(id: string) {
    const p = await this.prisma.plan.findUnique({ where: { id } });
    return p ? { status: 200 as const, body: toAdminPlan(p) } : notFound("plan");
  }

  async create(actor: AdminActor, dto: AdminPlanCreateDto) {
    if (await this.prisma.plan.findUnique({ where: { slug: dto.slug } }))
      return conflict(`The address "${dto.slug}" is already used by another plan`);
    const row = await this.writer.write(actor, "create", "plan", async (tx) => {
      const p = await tx.plan.create({
        data: {
          ...dto,
          name: json(dto.name),
          tagline: json(dto.tagline),
          priceNote: json(dto.priceNote),
          features: json(dto.features),
          ctaLabel: json(dto.ctaLabel),
          finePrint: json(dto.finePrint),
          editedAt: new Date(),
        },
      });
      return { row: p, entityId: p.id, fields: Object.keys(dto).sort(), tags: webTags.plan() };
    });
    return { status: 201 as const, body: toAdminPlan(row) };
  }

  async update(actor: AdminActor, id: string, patch: AdminPlanPatchDto) {
    if (!(await this.prisma.plan.findUnique({ where: { id } }))) return notFound("plan");
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return invalid("Nothing to change");
    const row = await this.writer.write(actor, "update", "plan", async (tx) => {
      const p = await tx.plan.update({
        where: { id },
        data: { ...jsonFields(patch), editedAt: new Date() },
      });
      return { row: p, entityId: id, fields, tags: webTags.plan() };
    });
    return { status: 200 as const, body: toAdminPlan(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminPlansController {
  constructor(private readonly plans: PlansAdmin) {}

  @TsRestHandler(contract.admin.plans)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.plans, {
      list: async () => ({ status: 200, body: await this.plans.list() }),
      get: async ({ params }) => this.plans.get(params.id),
      create: async ({ body }) => this.plans.create(actor, body),
      update: async ({ params, body }) => this.plans.update(actor, params.id, body),
    });
  }
}
