import { Injectable } from "@nestjs/common";
import type { PricingDto } from "@darb/contracts";
import type { Localized } from "@darb/core";
import { PrismaService } from "../prisma/prisma.service.js";
import { toPlanDto } from "./pricing.mapper.js";

@Injectable()
export class PricingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Live plans in order, and every "pricing." text. Hidden plans never leave the API. */
  async page(): Promise<PricingDto> {
    const [plans, texts] = await Promise.all([
      this.prisma.plan.findMany({
        where: { status: "live" },
        orderBy: [{ order: "asc" }, { slug: "asc" }],
      }),
      this.prisma.siteText.findMany({ where: { key: { startsWith: "pricing." } } }),
    ]);
    return {
      plans: plans.map(toPlanDto),
      texts: Object.fromEntries(texts.map((t) => [t.key, t.value as Localized])),
    };
  }
}
