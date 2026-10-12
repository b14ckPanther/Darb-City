import { Injectable } from "@nestjs/common";
import type { TaxonomyDto } from "@darb/contracts";
import type { Kind } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toKindDto, toSectorDto } from "./taxonomy.mapper.js";

@Injectable()
export class TaxonomyRepository {
  constructor(private readonly prisma: PrismaService) {}

  activeKindBySlug(slug: string): Promise<Kind | null> {
    return this.prisma.kind.findFirst({ where: { slug, status: "active" } });
  }

  async descendantKindIds(kindId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT id FROM "Kind" WHERE id = ${kindId}::uuid AND status = 'active'
        UNION
        SELECT k.id FROM "Kind" k JOIN tree t ON k."parentKindId" = t.id WHERE k.status = 'active'
      )
      SELECT id FROM tree`;
    return rows.map((r) => r.id);
  }

  async tree(): Promise<TaxonomyDto> {
    const sectors = await this.prisma.sector.findMany({
      orderBy: { order: "asc" },
      include: { kinds: { where: { status: "active" }, orderBy: { order: "asc" } } },
    });
    return { sectors: sectors.map((s) => ({ ...toSectorDto(s), kinds: s.kinds.map(toKindDto) })) };
  }
}
