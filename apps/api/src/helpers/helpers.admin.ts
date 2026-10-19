import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  helperDailyLimit,
  storedHelperLimit,
  type AdminHelperDto,
  type HelperLimit,
  type AdminHelperListQueryDto,
  type AdminHelperPageDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminWriter } from "../admin/admin-writer.js";
import { conflict, notFound } from "../admin/outcome.js";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import type { User } from "../generated/prisma/client.js";
import type { HelperStatus } from "../generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";

type Row = User & { helperPlace: { name: unknown } | null };
type Stats = { added: number; approved: number; rejected: number };
const include = { helperPlace: { select: { name: true } } } as const;
const NONE: Stats = { added: 0, approved: 0, rejected: 0 };
const LIST = 200;

const toAdminHelper = (u: Row, stats: Stats): AdminHelperDto => ({
  id: u.id,
  status: u.helperStatus as AdminHelperDto["status"],
  name: u.helperName ?? "",
  phone: u.helperPhone,
  placeName: (u.helperPlace?.name as Localized | undefined) ?? null,
  note: u.helperNote,
  credit: u.helperCredit,
  appliedAt: u.helperAppliedAt?.toISOString() ?? null,
  decidedAt: u.helperDecidedAt?.toISOString() ?? null,
  ...stats,
  // An admin who is also listed here keeps no cap, like everywhere else.
  dailyLimit: u.isAdmin ? null : helperDailyLimit(u.helperDailyLimit),
});

/** Which decision moves a helper from where to where. */
const MOVES = {
  approve: { from: "pending", to: "approved" },
  pause: { from: "approved", to: "paused" },
  resume: { from: "paused", to: "approved" },
} as const satisfies Record<string, { from: HelperStatus; to: HelperStatus }>;

/**
 * The admin's Helpers screen: who waits, who is active, who is paused, and how each one's
 * additions fared in the review (so a careless helper stands out). Every decision is audited.
 */
@Injectable()
export class HelpersAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  /** Each helper's street captures by review outcome, in one query. */
  private async stats(ids: string[]): Promise<Map<string, Stats>> {
    if (!ids.length) return new Map();
    const rows = await this.prisma.joinRequest.groupBy({
      by: ["createdById", "status"],
      where: { createdById: { in: ids }, source: "field" },
      _count: { _all: true },
    });
    const out = new Map<string, Stats>();
    for (const r of rows) {
      if (!r.createdById) continue;
      const s = out.get(r.createdById) ?? { ...NONE };
      s.added += r._count._all;
      if (r.status === "approved") s.approved += r._count._all;
      if (r.status === "rejected") s.rejected += r._count._all;
      out.set(r.createdById, s);
    }
    return out;
  }

  async list(query: AdminHelperListQueryDto): Promise<AdminHelperPageDto> {
    const [rows, counts] = await Promise.all([
      this.prisma.user.findMany({
        where: { helperStatus: query.status },
        include,
        // Waiting: who asked first is answered first. The rest: the latest decision first.
        orderBy:
          query.status === "pending"
            ? [{ helperAppliedAt: "asc" }, { id: "asc" }]
            : [{ helperDecidedAt: "desc" }, { id: "asc" }],
        take: LIST,
      }),
      this.prisma.user.groupBy({
        by: ["helperStatus"],
        where: { helperStatus: { in: ["pending", "approved", "paused"] } },
        _count: { _all: true },
      }),
    ]);
    const stats = await this.stats(rows.map((r) => r.id));
    const count = (s: HelperStatus) => counts.find((c) => c.helperStatus === s)?._count._all ?? 0;
    return {
      items: rows.map((r) => toAdminHelper(r, stats.get(r.id) ?? NONE)),
      counts: { pending: count("pending"), approved: count("approved"), paused: count("paused") },
    };
  }

  async decide(actor: AdminActor, id: string, move: keyof typeof MOVES) {
    const { from, to } = MOVES[move];
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.helperStatus === "none") return notFound("helper");
    if (user.helperStatus !== from)
      return conflict("This helper's status already changed", "already_decided");
    const row = await this.writer.write(actor, "status", "helper", async (tx) => ({
      row: await tx.user.update({
        where: { id },
        data: { helperStatus: to, helperDecidedAt: new Date() },
        include,
      }),
      entityId: id,
      fields: ["helperStatus"],
      tags: [],
    }));
    const stats = await this.stats([id]);
    return { status: 200 as const, body: toAdminHelper(row, stats.get(id) ?? NONE) };
  }

  /**
   * One helper's cap on additions and sign readings a day: 150 (the default, stored as null), 500,
   * or none (stored as 0). Audited; it holds from their next addition.
   */
  async setLimit(actor: AdminActor, id: string, limit: HelperLimit) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.helperStatus === "none") return notFound("helper");
    const row = await this.writer.write(actor, "update", "helper", async (tx) => ({
      row: await tx.user.update({
        where: { id },
        data: { helperDailyLimit: storedHelperLimit(limit) },
        include,
      }),
      entityId: id,
      fields: ["helperDailyLimit"],
      tags: [],
    }));
    const stats = await this.stats([id]);
    return { status: 200 as const, body: toAdminHelper(row, stats.get(id) ?? NONE) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminHelpersController {
  constructor(private readonly helpers: HelpersAdmin) {}

  @TsRestHandler(contract.admin.helpers)
  handler(@Req() req: AdminRequest & { res?: { setHeader(k: string, v: string): void } }) {
    const actor = req.admin!;
    // Names and phone numbers of people: never cached anywhere.
    req.res?.setHeader("cache-control", "no-store");
    return tsRestHandler(contract.admin.helpers, {
      list: async ({ query }) => ({ status: 200, body: await this.helpers.list(query) }),
      approve: async ({ params }) => this.helpers.decide(actor, params.id, "approve"),
      pause: async ({ params }) => this.helpers.decide(actor, params.id, "pause"),
      resume: async ({ params }) => this.helpers.decide(actor, params.id, "resume"),
      limit: async ({ params, body }) => this.helpers.setLimit(actor, params.id, body.limit),
    });
  }
}
