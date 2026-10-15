import { Controller, Inject, Injectable, Req } from "@nestjs/common";
import { contract, type InquiryCreateDto } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { clientIp, type ClientRequest } from "../search/client-ip.js";
import { ipBucket } from "../search/ip-bucket.js";
import { ipHash, RateLimiter } from "../search/rate-limiter.js";
import { Mailer } from "./mailer.js";

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Stores the message, then mails it; the mail's outcome never changes the answer. */
  async create(dto: InquiryCreateDto, ip: string): Promise<void> {
    const row = await this.prisma.inquiry.create({
      data: {
        name: dto.name,
        contact: dto.contact,
        businessName: dto.businessName || null,
        topic: dto.topic,
        // A plan only means something on a plan inquiry.
        plan: dto.topic === "plan" ? (dto.plan ?? null) : null,
        message: dto.message,
        locale: dto.locale,
        ipHash: ipHash(this.config.search.ipSalt, ipBucket(ip)),
      },
    });
    if (await this.mailer.sendInquiry(row))
      await this.prisma.inquiry.update({ where: { id: row.id }, data: { emailedAt: new Date() } });
  }
}

@Controller()
export class InquiriesController {
  constructor(
    private readonly inquiries: InquiriesService,
    private readonly limiter: RateLimiter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @TsRestHandler(contract.inquiries)
  handler(@Req() req: ClientRequest) {
    return tsRestHandler(contract.inquiries, {
      create: async ({ body }) => {
        // The web server vouches for the visitor's IP with the proxy key (decision 5).
        const ip = clientIp(req, this.config.search.proxyKey);
        const { rateLimit, rateWindowSeconds } = this.config.inquiry;
        const gate = await this.limiter.hit("inquiry", ip, rateLimit, rateWindowSeconds);
        if (!gate.ok)
          return {
            status: 429,
            body: { message: "Too many messages, try again later", retryAfter: gate.retryAfter },
          };
        // A filled honeypot is a bot: it hears the same answer, and nothing is kept or sent.
        if (!body.website?.trim()) await this.inquiries.create(body, ip);
        return { status: 201, body: { ok: true as const } };
      },
    });
  }
}
