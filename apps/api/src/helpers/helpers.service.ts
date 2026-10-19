import { Injectable, Logger } from "@nestjs/common";
import {
  helperDailyLimit,
  milestoneOf,
  type HelperApplyDto,
  type HelperMeDto,
  type HelperMomentsDto,
  type HelperPatchDto,
  type HelperSeenDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { WebRevalidator } from "../admin/revalidator.js";
import { conflict, notFound } from "../admin/outcome.js";
import { webTags } from "../admin/tags.js";
import type { HelperActor } from "../auth/helper.guard.js";
import type { User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

type Row = User & { helperPlace: { name: unknown } | null };
const include = { helperPlace: { select: { name: true } } } as const;

const toMe = (u: Row): HelperMeDto => ({
  status: u.helperStatus,
  name: u.helperName,
  phone: u.helperPhone,
  placeId: u.helperPlaceId,
  placeName: (u.helperPlace?.name as Localized | undefined) ?? null,
  note: u.helperNote,
  credit: u.helperCredit,
  isAdmin: u.isAdmin,
  dailyLimit: u.isAdmin ? null : helperDailyLimit(u.helperDailyLimit),
  appliedAt: u.helperAppliedAt?.toISOString() ?? null,
});

/**
 * The helper's own side: applying (anyone signed in), and their name and public credit. Never
 * audited: these are the person's own details, not site content. The admin decides in HelpersAdmin.
 */
@Injectable()
export class HelpersService {
  private readonly logger = new Logger(HelpersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidator: WebRevalidator,
  ) {}

  async me(actor: HelperActor): Promise<HelperMeDto> {
    return toMe(await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId }, include }));
  }

  /**
   * Idempotent: the first time it asks for approval; again while waiting it updates the form; once
   * an admin decided (approved or paused) it changes nothing and answers where they stand.
   */
  async apply(actor: HelperActor, dto: HelperApplyDto) {
    const place = await this.prisma.place.findUnique({
      where: { id: dto.placeId },
      select: { id: true },
    });
    if (!place) return notFound("place");
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (user.helperStatus === "approved" || user.helperStatus === "paused")
      return { status: 200 as const, body: await this.me(actor) };
    const row = await this.prisma.user.update({
      where: { id: actor.userId },
      data: {
        helperStatus: "pending",
        helperName: dto.name,
        helperPhone: dto.phone,
        helperPlaceId: dto.placeId,
        helperNote: dto.note || null,
        helperAppliedAt: user.helperStatus === "pending" ? undefined : new Date(),
      },
      include,
    });
    return { status: 200 as const, body: toMe(row) };
  }

  /**
   * Their display name and the credit toggle. Either one changes what their published additions'
   * cards say, so those pages are refreshed now (the card reads the credit at render time).
   */
  async update(actor: HelperActor, dto: HelperPatchDto) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (before.helperStatus === "none" && !before.isAdmin)
      return conflict("Apply to be a helper first", "not_a_helper");
    const row = await this.prisma.user.update({
      where: { id: actor.userId },
      data: {
        ...(dto.name !== undefined ? { helperName: dto.name } : {}),
        ...(dto.credit !== undefined ? { helperCredit: dto.credit } : {}),
      },
      include,
    });
    const shown = (u: User) => (u.helperCredit ? u.helperName : null);
    if (shown(before) !== shown(row)) void this.refreshCards(actor.userId);
    return { status: 200 as const, body: toMe(row) };
  }

  /**
   * What the app tells a helper on opening: the highest milestone their additions reached that was
   * not celebrated yet, and how many of their additions an admin published since their last visit
   * (none on the very first). Only their own additions count. Admins get neither.
   */
  async moments(actor: HelperActor): Promise<HelperMomentsDto> {
    const asOf = new Date();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (user.isAdmin) return { asOf: asOf.toISOString(), milestone: null, wentLive: null };
    const own = { createdById: actor.userId, source: "field" as const };
    const [total, wentLive] = await Promise.all([
      this.prisma.joinRequest.count({ where: own }),
      user.helperSeenAt
        ? this.prisma.joinRequest.count({
            where: {
              ...own,
              status: "approved",
              decidedAt: { gt: user.helperSeenAt, lte: asOf },
              business: { is: { status: "published" } },
            },
          })
        : 0,
    ]);
    const reached = milestoneOf(total);
    return {
      asOf: asOf.toISOString(),
      milestone:
        reached > user.helperMilestone ? await this.milestone(actor.userId, reached) : null,
      wentLive:
        wentLive > 0 && user.helperSeenAt
          ? { count: wentLive, since: user.helperSeenAt.toISOString() }
          : null,
    };
  }

  /** The milestone's words: how many of their additions are live, and their busiest town. */
  private async milestone(userId: string, count: number) {
    const own = { createdById: userId, source: "field" as const };
    const [live, towns] = await Promise.all([
      this.prisma.joinRequest.count({
        where: { ...own, business: { is: { status: "published" } } },
      }),
      this.prisma.business.groupBy({
        by: ["placeId"],
        where: { joinRequests: { some: own } },
        _count: { _all: true },
        orderBy: [{ _count: { placeId: "desc" } }, { placeId: "asc" }],
        take: 1,
      }),
    ]);
    const top = towns[0]
      ? await this.prisma.place.findUnique({
          where: { id: towns[0].placeId },
          select: { name: true },
        })
      : null;
    return { count, live, placeName: (top?.name as Localized | undefined) ?? null };
  }

  /**
   * Their visit, up to the moment the app counted (never later, so an approval in between is
   * still told next time), and a milestone once it was shown. Never moves either backwards, and a
   * milestone counts only when their additions reached it.
   */
  async seen(actor: HelperActor, dto: HelperSeenDto): Promise<void> {
    const asOf = new Date(Math.min(Date.parse(dto.asOf), Date.now()));
    await this.prisma.user.updateMany({
      where: {
        id: actor.userId,
        OR: [{ helperSeenAt: null }, { helperSeenAt: { lt: asOf } }],
      },
      data: { helperSeenAt: asOf },
    });
    if (dto.milestone === undefined) return;
    const total = await this.prisma.joinRequest.count({
      where: { createdById: actor.userId, source: "field" },
    });
    if (total < dto.milestone) return;
    await this.prisma.user.updateMany({
      where: { id: actor.userId, helperMilestone: { lt: dto.milestone } },
      data: { helperMilestone: dto.milestone },
    });
  }

  /** Best effort: a missed refresh only leaves the old line until the page's own timer. */
  private async refreshCards(userId: string): Promise<void> {
    try {
      const rows = await this.prisma.business.findMany({
        where: {
          status: "published",
          joinRequests: { some: { createdById: userId, source: "field" } },
        },
        select: { slug: true, place: { select: { slug: true } } },
      });
      const tags = rows.flatMap((b) => webTags.business(b.place.slug, b.slug));
      if (tags.length) await this.revalidator.revalidate(tags);
    } catch (err) {
      this.logger.warn(`credit refresh failed: ${err instanceof Error ? err.name : "error"}`);
    }
  }
}
