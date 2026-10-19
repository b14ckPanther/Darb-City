import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminBusinessCreateDto,
  type AdminBusinessDto,
  type AdminBusinessListQueryDto,
  type AdminBusinessPatchDto,
  type AdminBusinessRowDto,
  type AdminBulkDto,
  type BusinessIssue,
  type AdminStatusDto,
} from "@darb/contracts";
import type { Hours, Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import { decodeCursor, encodeCursor } from "../businesses/cursor.js";
import { Prisma, type Business } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { keptGoogleLink } from "../join/links.js";
import { AdminWriter } from "./admin-writer.js";
import { ExperienceValidator } from "./experience.js";
import { json } from "./json.js";
import { conflict, invalid, notFound, outcome } from "./outcome.js";
import { webTags } from "./tags.js";
import { nameOrSlugFilters } from "./text-search.js";
import { seedSource } from "./seed-source.js";

type Row = Business & {
  place: { slug: string; name: unknown };
  primaryKind: { name: unknown };
  kinds: { kindId: string }[];
};
const include = {
  place: { select: { slug: true, name: true } },
  primaryKind: { select: { name: true } },
  kinds: { select: { kindId: true } },
} as const;
/** The list's thumbnail: the logo, else the first photo; a media key, or null. */
export const thumbOf = (logo: unknown, photos: unknown): string | null => {
  const key = (v: unknown) =>
    v && typeof v === "object" && typeof (v as { key?: unknown }).key === "string"
      ? (v as { key: string }).key
      : null;
  return key(logo) ?? (Array.isArray(photos) ? key(photos[0]) : null);
};
/** Pins further than this from their place's centre count as outside it (no boundaries yet). */
export const PLACE_RADIUS_SQL = Prisma.sql`CASE p.type
  WHEN 'city' THEN 10000 WHEN 'town' THEN 6000 WHEN 'village' THEN 4000
  WHEN 'neighbourhood' THEN 3000 ELSE 30000 END`;
const STATUSES = new Set(["draft", "published", "suspended"]);
/** Bulk writes run this many at a time: quick, without crowding the database. */
const BULK_CONCURRENCY = 4;

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
  seedSource: seedSource.business(b.place.slug, b.slug),
  placeName: b.place.name as Localized,
  kindName: b.primaryKind.name as Localized,
  thumb: thumbOf(b.logo, b.photos),
  createdAt: b.createdAt.toISOString(),
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
  dietary: b.dietary,
  experience: b.experience as AdminBusinessDto["experience"],
  tier: b.tier,
  apps: b.apps as AdminBusinessDto["apps"],
  links: b.links as AdminBusinessDto["links"],
  logo: (b.logo as AdminBusinessDto["logo"]) ?? null,
  photos: b.photos as AdminBusinessDto["photos"],
  cardStyle: b.cardStyle as AdminBusinessDto["cardStyle"],
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
  /** Follows a short Google Maps link once, on save; replaced in tests. */
  fetchImpl: typeof fetch = fetch;

  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
    private readonly experience: ExperienceValidator,
  ) {}

  /** Ids of real, published businesses with one of the overview's gaps (raw: JSON and geography). */
  async issueIds(issue: BusinessIssue): Promise<string[] | null> {
    if (issue === "no-phone") return null;
    const rows =
      issue === "no-hours"
        ? await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT b.id FROM "Business" b
            WHERE b.tier <> 'example' AND b.hours -> 'weekly' = '{}'::jsonb
              AND COALESCE((b.hours ->> 'byAppointment')::boolean, false) = false`
        : issue === "pin-at-centre"
          ? await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT b.id FROM "Business" b JOIN "Place" p ON p.id = b."placeId"
            WHERE b.tier <> 'example' AND b.lat = p.lat AND b.lng = p.lng`
          : await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT b.id FROM "Business" b JOIN "Place" p ON p.id = b."placeId"
            WHERE b.tier <> 'example' AND NOT ST_DWithin(b.point, p.point, ${PLACE_RADIUS_SQL})`;
    return rows.map((r) => r.id);
  }

  async list(query: AdminBusinessListQueryDto) {
    const offset = query.page ? (query.page - 1) * query.limit : (decodeCursor(query.cursor) ?? 0);
    const [place, kind, sector] = await Promise.all([
      query.place ? this.prisma.place.findUnique({ where: { slug: query.place } }) : null,
      query.kind ? this.prisma.kind.findUnique({ where: { slug: query.kind } }) : null,
      query.sector ? this.prisma.sector.findUnique({ where: { slug: query.sector } }) : null,
    ]);
    const empty = { items: [], nextCursor: null, total: 0 };
    if ((query.place && !place) || (query.kind && !kind) || (query.sector && !sector)) return empty;
    const issueIds = query.issue ? await this.issueIds(query.issue) : null;
    const q = query.q;
    const origin: Prisma.BusinessWhereInput =
      query.source === "imported"
        ? { source: "seed", editedAt: null }
        : query.source === "edited"
          ? { editedAt: { not: null } }
          : query.source === "street"
            ? { joinRequests: { some: { source: "field" } } }
            : query.source === "join"
              ? { joinRequests: { some: { source: { in: ["lookup", "manual"] } } } }
              : {};
    const where: Prisma.BusinessWhereInput = {
      ...(place ? { placeId: place.id } : {}),
      ...(kind ? { primaryKindId: kind.id } : {}),
      ...(sector ? { primaryKind: { sectorId: sector.id } } : {}),
      // The admin works on real businesses; examples only when asked for.
      ...(query.tier
        ? { tier: query.tier }
        : query.examples === "1"
          ? {}
          : { tier: { not: "example" as const } }),
      ...(query.status && STATUSES.has(query.status)
        ? { status: query.status as Business["status"] }
        : {}),
      ...(query.issue === "no-phone" ? { phone: null, whatsapp: null } : {}),
      ...(issueIds ? { id: { in: issueIds } } : {}),
      ...origin,
      ...(q ? { OR: nameOrSlugFilters(q) } : {}),
    };
    const dir = query.dir ?? (query.sort === "name" ? "asc" : "desc");
    if (query.sort === "name") {
      const ids = (await this.prisma.business.findMany({ where, select: { id: true } })).map(
        (r) => r.id,
      );
      const locale = query.locale ?? "he";
      const order = dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
      const pageIds = (
        await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Business" WHERE id = ANY(${ids}::uuid[])
          ORDER BY lower(COALESCE(NULLIF(name ->> ${locale}, ''), name ->> 'he', name ->> 'ar',
            name ->> 'en', slug)) ${order}, id
          LIMIT ${query.limit} OFFSET ${offset}`
      ).map((r) => r.id);
      const rows = await this.prisma.business.findMany({
        where: { id: { in: pageIds } },
        include,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      return {
        items: pageIds.flatMap((id) => (byId.has(id) ? [toAdminBusinessRow(byId.get(id)!)] : [])),
        nextCursor: ids.length > offset + query.limit ? encodeCursor(offset + query.limit) : null,
        total: ids.length,
      };
    }
    const orderBy: Prisma.BusinessOrderByWithRelationInput[] =
      query.sort === "created"
        ? [{ createdAt: dir }, { id: "asc" }]
        : [{ updatedAt: dir }, { id: "asc" }];
    const [rows, total] = await Promise.all([
      this.prisma.business.findMany({
        where,
        include,
        orderBy,
        skip: offset,
        take: query.limit + 1,
      }),
      this.prisma.business.count({ where }),
    ]);
    return {
      items: rows.slice(0, query.limit).map(toAdminBusinessRow),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
      total,
    };
  }

  /**
   * One change to many businesses. Each goes through the same audited write as a single one
   * (status or kind), a few at a time; one that is already so is left alone and counted.
   */
  async bulk(actor: AdminActor, body: AdminBulkDto) {
    const ids = [...new Set(body.ids)];
    const rows = await this.prisma.business.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, primaryKindId: true },
    });
    const found = new Map(rows.map((r) => [r.id, r]));
    const result = { changed: 0, unchanged: 0, failed: [] as string[] };
    let revalidated: boolean | undefined;
    const status =
      body.action === "publish"
        ? ("published" as const)
        : body.action === "draft"
          ? ("draft" as const)
          : body.action === "suspend"
            ? ("suspended" as const)
            : null;
    if (
      body.action === "kind" &&
      !(await this.prisma.kind.findUnique({ where: { id: body.kindId } }))
    )
      return notFound("kind");
    const one = async (id: string) => {
      const row = found.get(id);
      if (!row) return void result.failed.push(id);
      if (status ? row.status === status : row.primaryKindId === body.kindId)
        return void result.unchanged++;
      const res = status
        ? await this.status(actor, id, { status })
        : await this.update(actor, id, { primaryKindId: body.kindId! });
      if (res.status !== 200) return void result.failed.push(id);
      result.changed++;
      const r = (res.body as { revalidated?: boolean }).revalidated;
      if (r !== undefined) revalidated = (revalidated ?? true) && r;
    };
    for (let i = 0; i < ids.length; i += BULK_CONCURRENCY)
      await Promise.all(ids.slice(i, i + BULK_CONCURRENCY).map(one));
    return {
      status: 200 as const,
      body: { ...result, ...(revalidated === undefined ? {} : { revalidated }) },
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

  /** A short Google Maps link is kept as the long one it opens, when that resolves. */
  private async keepGoogle<T extends { links?: { google?: string } }>(dto: T): Promise<T> {
    const google = dto.links?.google;
    if (!google) return dto;
    const kept = (await keptGoogleLink(google, this.fetchImpl)) ?? google;
    return kept === google ? dto : { ...dto, links: { ...dto.links, google: kept } };
  }

  async create(actor: AdminActor, given: AdminBusinessCreateDto) {
    const dto = await this.keepGoogle(given);
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
          links: json(dto.links),
          logo: dto.logo ? json(dto.logo) : Prisma.DbNull,
          photos: json(dto.photos),
          cardStyle: json(dto.cardStyle),
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

  async update(actor: AdminActor, id: string, given: AdminBusinessPatchDto) {
    const patch = await this.keepGoogle(given);
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
      "links",
      "photos",
      "cardStyle",
    ] as const;
    const data: Prisma.BusinessUpdateInput = {
      ...(rest as Prisma.BusinessUpdateInput),
      editedAt: new Date(),
    };
    for (const k of jsonFields) if (rest[k] !== undefined) data[k] = json(rest[k]);
    if (rest.logo !== undefined) data.logo = rest.logo ? json(rest.logo) : Prisma.DbNull;
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
    const { row, revalidated } = await this.writer.writeReporting(
      actor,
      "status",
      "business",
      async (tx) => {
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
      },
    );
    return { status: 200 as const, body: { ...toAdminBusiness(row), ...outcome(revalidated) } };
  }

  async remove(actor: AdminActor, id: string) {
    const before = await this.prisma.business.findUnique({ where: { id }, include });
    if (!before) return notFound("business");
    if (before.source !== "admin" || before.status !== "draft")
      return conflict("Only drafts created in admin can be deleted; suspend this business instead");
    const { revalidated } = await this.writer.writeReporting(
      actor,
      "delete",
      "business",
      async (tx) => {
        await tx.business.delete({ where: { id } });
        return {
          row: null,
          entityId: id,
          fields: [],
          tags: webTags.business(before.place.slug, before.slug),
          search: [{ entity: "business" as const, ids: [id] }],
          immediate: true,
        };
      },
    );
    return { status: 200 as const, body: { deleted: true as const, ...outcome(revalidated) } };
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
      bulk: async ({ body }) => this.businesses.bulk(actor, body),
      get: async ({ params }) => this.businesses.get(params.id),
      create: async ({ body }) => this.businesses.create(actor, body),
      update: async ({ params, body }) => this.businesses.update(actor, params.id, body),
      status: async ({ params, body }) => this.businesses.status(actor, params.id, body),
      remove: async ({ params }) => this.businesses.remove(actor, params.id),
    });
  }
}
