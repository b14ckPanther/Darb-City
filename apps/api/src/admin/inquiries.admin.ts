import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminInquiryDto,
  type AdminInquiryListQueryDto,
  type AdminInquiryPageDto,
} from "@darb/contracts";
import type { Locale } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminRequest } from "../auth/admin.guard.js";
import { decodeCursor, encodeCursor } from "../businesses/cursor.js";
import type { Inquiry } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { notFound } from "./outcome.js";

/** The IP hash stays in the database: the admin never needs it. */
export const toAdminInquiry = (i: Inquiry): AdminInquiryDto => ({
  id: i.id,
  name: i.name,
  contact: i.contact,
  businessName: i.businessName,
  topic: i.topic,
  plan: i.plan,
  message: i.message,
  locale: i.locale as Locale,
  status: i.status,
  emailedAt: i.emailedAt?.toISOString() ?? null,
  createdAt: i.createdAt.toISOString(),
});

@Injectable()
export class InquiriesAdmin {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminInquiryListQueryDto): Promise<AdminInquiryPageDto> {
    const offset = decodeCursor(query.cursor) ?? 0;
    const [rows, newCount] = await Promise.all([
      this.prisma.inquiry.findMany({
        where: query.status ? { status: query.status } : {},
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: query.limit + 1,
      }),
      this.prisma.inquiry.count({ where: { status: "new" } }),
    ]);
    return {
      items: rows.slice(0, query.limit).map(toAdminInquiry),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
      newCount,
    };
  }

  async setStatus(id: string, status: AdminInquiryDto["status"]) {
    if (!(await this.prisma.inquiry.findUnique({ where: { id } }))) return notFound("inquiry");
    const row = await this.prisma.inquiry.update({ where: { id }, data: { status } });
    return { status: 200 as const, body: toAdminInquiry(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminInquiriesController {
  constructor(private readonly inquiries: InquiriesAdmin) {}

  @TsRestHandler(contract.admin.inquiries)
  // Messages carry people's phone numbers and addresses: never cached anywhere.
  handler(@Req() req: AdminRequest & { res?: { setHeader(k: string, v: string): void } }) {
    return tsRestHandler(contract.admin.inquiries, {
      list: async ({ query }) => {
        req.res?.setHeader("cache-control", "no-store");
        return { status: 200, body: await this.inquiries.list(query) };
      },
      status: async ({ params, body }) => this.inquiries.setStatus(params.id, body.status),
    });
  }
}
