import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminBusinessCreateDto,
  type AdminBusinessDto,
  type AdminBusinessListQueryDto,
  type AdminBusinessPatchDto,
  type AdminBusinessRowDto,
  type AdminStatusDto,
} from "@darb/contracts";
import type { Hours, Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import { decodeCursor, encodeCursor } from "../businesses/cursor.js";
import type { Business, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { ExperienceValidator } from "./experience.js";
import { json } from "./json.js";
import { conflict, invalid, notFound } from "./outcome.js";
import { webTags } from "./tags.js";
import { nameOrSlugFilters } from "./text-search.js";

type Row = Business & { place: { slug: string }; kinds: { kindId: string }[] };
const include = { place: { select: { slug: true } }, kinds: { select: { kindId: true } } } as const;
const STATUSES = new Set(["draft", "published", "suspended"]);

export const toAdminBusinessRow = (b: Row): AdminBusinessRowDto => ({
  id: b.id,
  slug: b.slug,
  placeId: b.placeId,
  placeSlug: b.place.slug,
  name: b.name as Localized,
  primaryKindId: b.primaryKindId,
  tier: b.tier,
  status: b.status,
  source: b.source,
  editedAt: b.editedAt?.toISOString() ?? null,
  updatedAt: b.updatedAt.toISOString(),
});
export const toAdminBusiness = (b: Row): AdminBusinessDto => ({
  ...toAdminBusinessRow(b),
  tagline: b.tagline as Localized,
  address: b.address as Localized,
  kindIds: b.kinds.map((k) => k.kindId),
  lat: b.lat,
  lng: b.lng,
  phone: b.phone,
  whatsapp: b.whatsapp,
  website: b.website,
  hours: b.hours as unknown as Hours as AdminBusinessDto["hours"],
  attributes: b.attributes as AdminBusinessDto["attributes"],
  experience: b.experience as AdminBusinessDto["experience"],
  tier: b.tier,
  apps: b.apps as AdminBusinessDto["apps"],
  brandId: b.brandId,
});

/**
 * Showroom examples (fictional) stay out of search engines by their tier, so the admin can never
 * turn one into a real listing, nor hide a real business by labelling it an example.
 */
const exampleTierFixed = () =>
  invalid(
    "Showroom examples stay examples, and real businesses cannot become one; create a new business instead",
    undefined,
    "example_tier_fixed",
  );

const hasApps = (apps: AdminBusinessDto["apps"] | undefined) =>
  Boolean(apps && Object.keys(apps).length > 0);

@Injectable()
export class BusinessesAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
    private readonly experience: ExperienceValidator,
  ) {}

  async list(query: AdminBusinessListQueryDto) {
    const offset = decodeCursor(query.cursor) ?? 0;
    const place = query.place
      ? await this.prisma.place.findUnique({ where: { slug: query.place } })
      : null;
    const kind = query.kind
      ? await this.prisma.kind.findUnique({ where: { slug: query.kind } })
      : null;
    if ((query.place && !place) || (query.kind && !kind)) return { items: [], nextCursor: null };
    const q = query.q;
    const where: Prisma.BusinessWhereInput = {
      ...(place ? { placeId: place.id } : {}),
      ...(kind ? { primaryKindId: kind.id } : {}),
      ...(query.status && STATUSES.has(query.status)
        ? { status: query.status as Business["status"] }
        : {}),
      ...(q
        ? {
            OR: nameOrSlugFilters(q),
          }
        : {}),
    };
    const rows = await this.prisma.business.findMany({
      where,
      include,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: offset,
      take: query.limit + 1,
    });
    return {
      items: rows.slice(0, query.limit).map(toAdminBusinessRow),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async get(id: string) {
    const b = await this.prisma.business.findUnique({ where: { id }, include });
    return b ? { status: 200 as const, body: toAdminBusiness(b) } : notFound("business");
  }

  /** Shared checks for create and update; null when the values are fine. */
  private async problem(values: {
    primaryKindId: string;
    kindIds: string[] | undefined;
    tier: string;
    apps: AdminBusinessDto["apps"] | undefined;
    experience: unknown;
    checkExperience: boolean;
  }) {
    const kind = await this.prisma.kind.findUnique({ where: { id: values.primaryKindId } });
    if (!kind) return notFound("kind");
    if (values.kindIds) {
      const found = await this.prisma.kind.count({ where: { id: { in: values.kindIds } } });
      if (found !== new Set(values.kindIds).size)
        return invalid("One of the extra kinds does not exist");
    }
    if (values.tier !== "darb" && hasApps(values.apps))
      return invalid("App links are only for businesses on the darb tier");
    if (values.checkExperience) {
      const errors = this.experience.validate(kind.contentSchema, values.experience);
      if (errors.length)
        return invalid("The experience content does not fit this kind's template", errors);
    }
    return null;
  }

  async create(actor: AdminActor, dto: AdminBusinessCreateDto) {
    const place = await this.prisma.place.findUnique({ where: { id: dto.placeId } });
    if (!place) return notFound("place");
    if (dto.tier === "example") return exampleTierFixed();
    const problem = await this.problem({ ...dto, checkExperience: true });
    if (problem) return problem;
    if (
      await this.prisma.business.findUnique({
        where: { placeId_slug: { placeId: place.id, slug: dto.slug } },
      })
    )
      return conflict(`The address "${dto.slug}" is already used in this place`);
    const kindIds = [...new Set([dto.primaryKindId, ...dto.kindIds])];
    const { kindIds: _k, ...data } = dto;
    const row = await this.writer.write(actor, "create", "business", async (tx) => {
      const b = await tx.business.create({
        data: {
          ...data,
          name: json(dto.name),
          tagline: json(dto.tagline),
          address: json(dto.address),
          hours: json(dto.hours),
          attributes: json(dto.attributes),
          experience: json(dto.experience),
          apps: json(dto.apps),
          source: "admin",
          editedAt: new Date(),
          kinds: { create: kindIds.map((kindId) => ({ kindId })) },
        },
        include,
      });
      return {
        row: b,
        entityId: b.id,
        fields: Object.keys(dto).sort(),
        tags: webTags.business(place.slug, b.slug),
        search: [{ entity: "business" as const, ids: [b.id] }],
      };
    });
    return { status: 201 as const, body: toAdminBusiness(row) };
  }

  async update(actor: AdminActor, id: string, patch: AdminBusinessPatchDto) {
    const before = await this.prisma.business.findUnique({ where: { id }, include });
    if (!before) return notFound("business");
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return invalid("Nothing to change");
    if (patch.tier !== undefined && (patch.tier === "example") !== (before.tier === "example"))
      return exampleTierFixed();
    const primaryKindId = patch.primaryKindId ?? before.primaryKindId;
    const problem = await this.problem({
      primaryKindId,
      kindIds: patch.kindIds,
      tier: patch.tier ?? before.tier,
      apps: patch.apps ?? (before.apps as AdminBusinessDto["apps"]),
      experience: patch.experience ?? before.experience,
      checkExperience: patch.experience !== undefined || patch.primaryKindId !== undefined,
    });
    if (problem) return problem;
    const { kindIds, ...rest } = patch;
    const jsonFields = [
      "name",
      "tagline",
      "address",
      "hours",
      "attributes",
      "experience",
      "apps",
    ] as const;
    const data: Prisma.BusinessUpdateInput = {
      ...(rest as Prisma.BusinessUpdateInput),
      editedAt: new Date(),
    };
    for (const k of jsonFields) if (rest[k] !== undefined) data[k] = json(rest[k]);
    if (patch.primaryKindId) {
      delete (data as Record<string, unknown>)["primaryKindId"];
      data.primaryKind = { connect: { id: patch.primaryKindId } };
    }
    const row = await this.writer.write(actor, "update", "business", async (tx) => {
      if (kindIds || patch.primaryKindId) {
        // A new primary kind replaces the old one; it is not kept on as a secondary.
        const secondary =
          kindIds ?? before.kinds.map((k) => k.kindId).filter((k) => k !== before.primaryKindId);
        const links = [...new Set([primaryKindId, ...secondary])];
        await tx.businessKind.deleteMany({ where: { businessId: id } });
        await tx.businessKind.createMany({
          data: links.map((kindId) => ({ businessId: id, kindId })),
        });
      }
      const b = await tx.business.update({ where: { id }, data, include });
      return {
        row: b,
        entityId: id,
        fields,
        tags: webTags.business(b.place.slug, b.slug),
        search: [{ entity: "business" as const, ids: [id] }],
      };
    });
    return { status: 200 as const, body: toAdminBusiness(row) };
  }

  async status(actor: AdminActor, id: string, body: AdminStatusDto) {
    const before = await this.prisma.business.findUnique({ where: { id }, include });
    if (!before) return notFound("business");
    const row = await this.writer.write(actor, "status", "business", async (tx) => {
      const b = await tx.business.update({
        where: { id },
        data: { status: body.status, editedAt: new Date() },
        include,
      });
      return {
        row: b,
        entityId: id,
        fields: ["status"],
        tags: webTags.business(b.place.slug, b.slug),
        search: [{ entity: "business" as const, ids: [id] }],
        immediate: body.immediate ?? body.status !== "published",
      };
    });
    return { status: 200 as const, body: toAdminBusiness(row) };
  }

  async remove(actor: AdminActor, id: string) {
    const before = await this.prisma.business.findUnique({ where: { id }, include });
    if (!before) return notFound("business");
    if (before.source !== "admin" || before.status !== "draft")
      return conflict("Only drafts created in admin can be deleted; suspend this business instead");
    await this.writer.write(actor, "delete", "business", async (tx) => {
      await tx.business.delete({ where: { id } });
      return {
        row: null,
        entityId: id,
        fields: [],
        tags: webTags.business(before.place.slug, before.slug),
        search: [{ entity: "business" as const, ids: [id] }],
        immediate: true,
      };
    });
    return { status: 200 as const, body: { deleted: true as const } };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminBusinessesController {
  constructor(private readonly businesses: BusinessesAdmin) {}

  @TsRestHandler(contract.admin.businesses)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.businesses, {
      list: async ({ query }) => ({ status: 200, body: await this.businesses.list(query) }),
      get: async ({ params }) => this.businesses.get(params.id),
      create: async ({ body }) => this.businesses.create(actor, body),
      update: async ({ params, body }) => this.businesses.update(actor, params.id, body),
      status: async ({ params, body }) => this.businesses.status(actor, params.id, body),
      remove: async ({ params }) => this.businesses.remove(actor, params.id),
    });
  }
}
