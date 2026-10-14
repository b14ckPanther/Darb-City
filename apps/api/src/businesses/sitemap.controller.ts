import { Controller } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { PrismaService } from "../prisma/prisma.service.js";

/** Real businesses for the web sitemap; showroom examples are noindex (Plan 4 decision 4). */
@Controller()
export class SitemapController {
  constructor(private readonly prisma: PrismaService) {}

  @TsRestHandler(contract.sitemap)
  handler() {
    return tsRestHandler(contract.sitemap, {
      businesses: async () => {
        const rows = await this.prisma.business.findMany({
          where: {
            status: "published",
            tier: { not: "example" },
            place: { is: { status: "live" } },
            primaryKind: { is: { status: "active" } },
          },
          select: {
            slug: true,
            primaryKindId: true,
            updatedAt: true,
            place: { select: { slug: true } },
          },
          orderBy: [{ placeId: "asc" }, { slug: "asc" }],
          take: 40_000,
        });
        return {
          status: 200,
          body: rows.map((r) => ({
            placeSlug: r.place.slug,
            slug: r.slug,
            primaryKindId: r.primaryKindId,
            updatedAt: r.updatedAt.toISOString(),
          })),
        };
      },
    });
  }
}
