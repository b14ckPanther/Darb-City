import { Injectable } from "@nestjs/common";
import type { AdminEntity, AdminOverviewDto, AdminSearchDto, BusinessIssue } from "@darb/contracts";
import type { Localized } from "@darb/core";
import type { AdminActor } from "../auth/admin.guard.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PLACE_RADIUS_SQL, thumbOf } from "./businesses.admin.js";
import { nameOrSlug } from "./places.admin.js";
import { nameOrSlugFilters } from "./text-search.js";

/** The dashboard's numbers are a glance, not a ledger: one read serves every admin for this long. */
export const OVERVIEW_TTL_MS = 30_000;
const DAY_MS = 86_400_000;
const ADDED_DAYS = 14;
const ACTIVITY = 15;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Base = Omit<AdminOverviewDto, "activity"> & {
  activity: (Omit<AdminOverviewDto["activity"][number], "self"> & { actorId: string })[];
};

/** "2026-10-19" for the day `at` falls on in Israel. */
export const israelDay = (at: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(at);

@Injectable()
export class OverviewAdmin {
  private cached: { at: number; value: Promise<Base> } | null = null;
  /** Replaced in tests. */
  now: () => number = () => Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: AdminActor): Promise<AdminOverviewDto> {
    const now = this.now();
    if (!this.cached || now - this.cached.at > OVERVIEW_TTL_MS) {
      const value = this.read(new Date(now));
      this.cached = { at: now, value };
      // A failed read is never served again.
      value.catch(() => {
        if (this.cached?.value === value) this.cached = null;
      });
    }
    const base = await this.cached.value;
    return {
      ...base,
      activity: base.activity.map(({ actorId, ...a }) => ({
        ...a,
        self: actorId === actor.userId,
      })),
    };
  }

  private async issueCount(issue: BusinessIssue): Promise<number> {
    const published = Prisma.sql`b.tier <> 'example' AND b.status = 'published'`;
    const rows =
      issue === "no-phone"
        ? await this.prisma.$queryRaw<{ n: number }[]>`
            SELECT COUNT(*)::int AS n FROM "Business" b
            WHERE ${published} AND b.phone IS NULL AND b.whatsapp IS NULL`
        : issue === "no-hours"
          ? await this.prisma.$queryRaw<{ n: number }[]>`
            SELECT COUNT(*)::int AS n FROM "Business" b
            WHERE ${published} AND b.hours -> 'weekly' = '{}'::jsonb
              AND COALESCE((b.hours ->> 'byAppointment')::boolean, false) = false`
          : issue === "pin-at-centre"
            ? await this.prisma.$queryRaw<{ n: number }[]>`
            SELECT COUNT(*)::int AS n FROM "Business" b JOIN "Place" p ON p.id = b."placeId"
            WHERE ${published} AND b.lat = p.lat AND b.lng = p.lng`
            : await this.prisma.$queryRaw<{ n: number }[]>`
            SELECT COUNT(*)::int AS n FROM "Business" b JOIN "Place" p ON p.id = b."placeId"
            WHERE ${published} AND NOT ST_DWithin(b.point, p.point, ${PLACE_RADIUS_SQL})`;
    return rows[0]?.n ?? 0;
  }

  private async read(now: Date): Promise<Base> {
    const real = { tier: { not: "example" as const } };
    const since = new Date(now.getTime() - ADDED_DAYS * DAY_MS);
    const [
      byStatus,
      addedThisWeek,
      places,
      kinds,
      pendingJoins,
      streetPending,
      helpersWaiting,
      newInquiries,
      added,
      noPhone,
      noHours,
      atCentre,
      outside,
      audit,
    ] = await Promise.all([
      this.prisma.business.groupBy({ by: ["status"], where: real, _count: { _all: true } }),
      this.prisma.business.count({
        where: {
          ...real,
          source: { not: "seed" },
          createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) },
        },
      }),
      this.prisma.place.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.kind.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.joinRequest.count({ where: { status: "pending" } }),
      this.prisma.joinRequest.count({ where: { status: "pending", source: "field" } }),
      this.prisma.user.count({ where: { helperStatus: "pending" } }),
      this.prisma.inquiry.count({ where: { status: "new" } }),
      this.prisma.business.findMany({
        where: { ...real, source: { not: "seed" }, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.issueCount("no-phone"),
      this.issueCount("no-hours"),
      this.issueCount("pin-at-centre"),
      this.issueCount("pin-outside"),
      // Site content only: helper decisions have their own screen.
      this.prisma.auditLog.findMany({
        where: { entityType: { not: "helper" } },
        orderBy: [{ at: "desc" }, { id: "desc" }],
        take: ACTIVITY,
        include: { actor: { select: { clerkUserId: true } } },
      }),
    ]);
    const status = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
    const perDay = new Map<string, number>();
    for (const b of added)
      perDay.set(israelDay(b.createdAt), (perDay.get(israelDay(b.createdAt)) ?? 0) + 1);
    const days = Array.from({ length: ADDED_DAYS }, (_, i) =>
      israelDay(new Date(now.getTime() - (ADDED_DAYS - 1 - i) * DAY_MS)),
    );
    const content = audit.filter(
      (a): a is (typeof audit)[number] & { entityType: AdminEntity } => a.entityType !== "helper",
    );
    const names = await this.names(content.map((a) => ({ type: a.entityType, id: a.entityId })));
    return {
      counts: {
        published: status("published"),
        draft: status("draft"),
        suspended: status("suspended"),
        addedThisWeek,
        placesLive: places.find((p) => p.status === "live")?._count._all ?? 0,
        placesTotal: places.reduce((n, p) => n + p._count._all, 0),
        kindsActive: kinds.find((k) => k.status === "active")?._count._all ?? 0,
        kindsHidden: kinds.find((k) => k.status === "hidden")?._count._all ?? 0,
        pendingJoins,
        streetPending,
        helpersWaiting,
        newInquiries,
      },
      attention: {
        "no-phone": noPhone,
        "no-hours": noHours,
        "pin-at-centre": atCentre,
        "pin-outside": outside,
      },
      added: days.map((day) => ({ day, count: perDay.get(day) ?? 0 })),
      activity: content.map((a) => ({
        id: a.id,
        at: a.at.toISOString(),
        actor: a.actor.clerkUserId,
        actorId: a.actorId,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        fields: a.fields,
        name: names.get(a.entityId) ?? null,
      })),
      generatedAt: now.toISOString(),
    };
  }

  /** Readable names for audit rows, one query per kind of entity. */
  private async names(refs: { type: AdminEntity; id: string }[]): Promise<Map<string, Localized>> {
    const ids = (type: AdminEntity) => [
      ...new Set(refs.filter((r) => r.type === type).map((r) => r.id)),
    ];
    const select = { id: true, name: true } as const;
    const [businesses, places, kinds, sectors, plans, texts] = await Promise.all([
      this.prisma.business.findMany({ where: { id: { in: ids("business") } }, select }),
      this.prisma.place.findMany({ where: { id: { in: ids("place") } }, select }),
      this.prisma.kind.findMany({ where: { id: { in: ids("kind") } }, select }),
      this.prisma.sector.findMany({ where: { id: { in: ids("sector") } }, select }),
      this.prisma.plan.findMany({ where: { id: { in: ids("plan") } }, select }),
      this.prisma.siteText.findMany({
        where: { id: { in: ids("text") } },
        select: { id: true, key: true },
      }),
    ]);
    return new Map<string, Localized>([
      ...[...businesses, ...places, ...kinds, ...sectors, ...plans].map(
        (r) => [r.id, r.name as Localized] as const,
      ),
      ...texts.map((t) => [t.id, { en: t.key }] as const),
    ]);
  }

  /** The command palette: a handful of each, by name, address, phone or id. */
  async search(q: string): Promise<AdminSearchDto> {
    // A phone however it is written: "04-674 0000", "+972 4 6740000" and "6740000" all match.
    const typed = q.replace(/[\s()+-]/g, "");
    const digits = typed.replace(/^972/, "").replace(/^0/, "");
    const byPhone =
      /^\d+$/.test(typed) && digits.length >= 5
        ? (
            await this.prisma.$queryRaw<{ id: string }[]>`
              SELECT id FROM "Business"
              WHERE regexp_replace(COALESCE(phone, '') || ' ' || COALESCE(whatsapp, ''), '[^0-9]', '', 'g')
                LIKE ${`%${digits}%`}
              LIMIT 20`
          ).map((r) => r.id)
        : [];
    const businessOr: Prisma.BusinessWhereInput[] = [
      ...nameOrSlugFilters(q),
      ...(byPhone.length ? [{ id: { in: byPhone } }] : []),
      ...(UUID.test(q) ? [{ id: q.toLowerCase() }] : []),
    ];
    const [businesses, places, kinds, sectors] = await Promise.all([
      this.prisma.business.findMany({
        where: { tier: { not: "example" }, OR: businessOr },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 8,
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          logo: true,
          photos: true,
          place: { select: { name: true } },
        },
      }),
      this.prisma.place.findMany({
        where: { OR: nameOrSlug(q) },
        orderBy: [{ population: { sort: "desc", nulls: "last" } }, { slug: "asc" }],
        take: 6,
        select: { id: true, slug: true, name: true, status: true, type: true },
      }),
      this.prisma.kind.findMany({
        where: { OR: nameOrSlugFilters(q) },
        orderBy: { order: "asc" },
        take: 6,
        select: { id: true, slug: true, name: true, status: true },
      }),
      this.prisma.sector.findMany({
        where: { OR: nameOrSlugFilters(q) },
        orderBy: { order: "asc" },
        take: 4,
        select: { id: true, slug: true, name: true, accent: true },
      }),
    ]);
    return {
      businesses: businesses.map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name as Localized,
        status: b.status,
        placeName: b.place.name as Localized,
        thumb: thumbOf(b.logo, b.photos),
      })),
      places: places.map((p) => ({ ...p, name: p.name as Localized })),
      kinds: kinds.map((k) => ({ ...k, name: k.name as Localized })),
      sectors: sectors.map((s) => ({ ...s, name: s.name as Localized })),
    };
  }
}
