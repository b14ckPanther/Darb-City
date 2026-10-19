import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminJoinListQueryDto,
  type AdminJoinPageDto,
  type AdminJoinRequestDto,
  type JoinSuggestionDto,
} from "@darb/contracts";
import type { Locale, Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import { decodeCursor, encodeCursor } from "../businesses/cursor.js";
import type { JoinRequest } from "../generated/prisma/client.js";
import { MediaStore } from "../media/media.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { BusinessesAdmin } from "./businesses.admin.js";
import { conflict, notFound, outcome } from "./outcome.js";
import { webTags } from "./tags.js";

type Row = JoinRequest & {
  business: { place: { slug: string; name: unknown }; photos: unknown } | null;
  createdBy: { id: string; isAdmin: boolean; helperName: string | null } | null;
};
const include = {
  business: { select: { place: { select: { slug: true, name: true } }, photos: true } },
  createdBy: { select: { id: true, isAdmin: true, helperName: true } },
} as const;

/** The IP hash stays in the database: the admin never needs it. */
export const toAdminJoinRequest = (r: Row): AdminJoinRequestDto => ({
  id: r.id,
  status: r.status,
  source: r.source,
  ownerName: r.ownerName,
  ownerPhone: r.ownerPhone,
  ownerEmail: r.ownerEmail,
  note: r.note,
  locale: r.locale as Locale,
  businessName: r.businessName as Localized,
  businessId: r.businessId,
  placeSlug: r.business?.place.slug ?? null,
  placeName: (r.business?.place.name as Localized | undefined) ?? null,
  photo: (r.business?.photos as { key: string }[] | undefined)?.[0]?.key ?? null,
  lookup: (r.lookup as JoinSuggestionDto | null) ?? null,
  rejectReason: r.rejectReason,
  createdAt: r.createdAt.toISOString(),
  decidedAt: r.decidedAt?.toISOString() ?? null,
  // An admin's own capture stays "from the street"; anyone else who captured is a helper.
  helper:
    r.createdBy && !r.createdBy.isAdmin
      ? { id: r.createdBy.id, name: r.createdBy.helperName ?? "" }
      : null,
});

/**
 * The /join queue. Approving publishes the draft through the same status write as the business
 * screen (audited, reindexed, revalidated). Photos keep their pending/ keys once approved: the
 * key is only a name, and moving objects would only add a copy that can fail. Rejecting deletes
 * the draft (audited) and its photos, and keeps the request with the reason.
 */
@Injectable()
export class JoinAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
    private readonly businesses: BusinessesAdmin,
    private readonly media: MediaStore,
  ) {}

  async list(query: AdminJoinListQueryDto): Promise<AdminJoinPageDto> {
    const offset = decodeCursor(query.cursor) ?? 0;
    const [rows, newCount] = await Promise.all([
      this.prisma.joinRequest.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.helper ? { createdById: query.helper, source: "field" as const } : {}),
        },
        include,
        // The enum's order: pending first, then approved and rejected, newest first in each.
        orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: query.limit + 1,
      }),
      this.prisma.joinRequest.count({ where: { status: "pending" } }),
    ]);
    return {
      items: rows.slice(0, query.limit).map(toAdminJoinRequest),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
      newCount,
    };
  }

  async get(id: string) {
    const row = await this.prisma.joinRequest.findUnique({ where: { id }, include });
    return row ? { status: 200 as const, body: toAdminJoinRequest(row) } : notFound("join request");
  }

  private async pending(id: string) {
    const row = await this.prisma.joinRequest.findUnique({ where: { id }, include });
    if (!row) return { ok: false as const, error: notFound("join request") };
    if (row.status !== "pending" || !row.businessId)
      return {
        ok: false as const,
        error: conflict("This request was already decided", "already_decided"),
      };
    return { ok: true as const, row, businessId: row.businessId };
  }

  async approve(actor: AdminActor, id: string) {
    const found = await this.pending(id);
    if (!found.ok) return found.error;
    const published = await this.businesses.status(actor, found.businessId, {
      status: "published",
    });
    if (published.status !== 200) return published;
    const row = await this.prisma.joinRequest.update({
      where: { id },
      data: { status: "approved", decidedAt: new Date() },
      include,
    });
    return {
      status: 200 as const,
      body: { ...toAdminJoinRequest(row), ...outcome(published.body.revalidated) },
    };
  }

  async reject(actor: AdminActor, id: string, reason: string) {
    const found = await this.pending(id);
    if (!found.ok) return found.error;
    const business = await this.prisma.business.findUnique({
      where: { id: found.businessId },
      include: { place: { select: { slug: true } } },
    });
    // Only a draft goes: one already published from the business screen is suspended there.
    if (business && business.status !== "draft")
      return conflict("The business is no longer a draft; suspend it instead", "not_draft");
    const row = await this.writer.write(actor, "delete", "business", async (tx) => {
      if (business) await tx.business.delete({ where: { id: business.id } });
      const r = await tx.joinRequest.update({
        where: { id },
        data: { status: "rejected", rejectReason: reason, decidedAt: new Date() },
        include,
      });
      return {
        row: r,
        entityId: found.businessId,
        fields: [],
        tags: business ? webTags.business(business.place.slug, business.slug) : [],
        search: [{ entity: "business" as const, ids: [found.businessId] }],
      };
    });
    if (business) {
      const photos = (business.photos as { key: string }[]).map((p) => p.key);
      const logo = (business.logo as { key: string } | null)?.key;
      // Best effort: an object left behind costs a few KB, never a failed rejection.
      await this.media.remove([...photos, ...(logo ? [logo] : [])]);
    }
    return { status: 200 as const, body: toAdminJoinRequest(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminJoinController {
  constructor(private readonly join: JoinAdmin) {}

  @TsRestHandler(contract.admin.joinRequests)
  // Requests carry owners' phone numbers: never cached anywhere.
  handler(@Req() req: AdminRequest & { res?: { setHeader(k: string, v: string): void } }) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.joinRequests, {
      list: async ({ query }) => {
        req.res?.setHeader("cache-control", "no-store");
        return { status: 200, body: await this.join.list(query) };
      },
      get: async ({ params }) => {
        req.res?.setHeader("cache-control", "no-store");
        return this.join.get(params.id);
      },
      approve: async ({ params }) => this.join.approve(actor, params.id),
      reject: async ({ params, body }) => this.join.reject(actor, params.id, body.reason),
    });
  }
}
