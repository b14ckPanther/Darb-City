import { Injectable } from "@nestjs/common";
import type { MissingReportDto } from "@darb/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

type Row = { term: string; count: number };

/** Spec §4.7: feeds the admin's Missing kinds and places screen (Plan 4). */
@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async report(days: number, limit: number, now: Date): Promise<MissingReportDto> {
    const since = new Date(now.getTime() - days * 86_400_000);
    const [missingKinds, missingPlaces, noResults] = await Promise.all([
      this.prisma.$queryRaw<Row[]>`
        SELECT normalized AS term, COUNT(*)::int AS count FROM "SearchQuery"
        WHERE "createdAt" >= ${since} AND lane <> 'blocked' AND jsonb_array_length(intent -> 'kinds') = 0
        GROUP BY normalized ORDER BY count DESC, term ASC LIMIT ${limit}`,
      this.prisma.$queryRaw<Row[]>`
        SELECT term, COUNT(*)::int AS count FROM (
          SELECT q.intent ->> 'place' AS term FROM "SearchQuery" q
          JOIN "Place" p ON p.slug = q.intent ->> 'place'
          WHERE q."createdAt" >= ${since} AND p.status <> 'live'
          UNION ALL
          SELECT array_to_string(q.unmatched, ' ') AS term FROM "SearchQuery" q
          WHERE q."createdAt" >= ${since} AND q.lane <> 'blocked'
            AND jsonb_array_length(q.intent -> 'kinds') > 0
            AND q.intent -> 'place' = 'null'::jsonb
            AND (q.intent ->> 'nearMe')::boolean IS NOT TRUE
            AND cardinality(q.unmatched) > 0
        ) t
        GROUP BY term ORDER BY count DESC, term ASC LIMIT ${limit}`,
      this.prisma.$queryRaw<Row[]>`
        SELECT normalized AS term, COUNT(*)::int AS count FROM "SearchQuery"
        WHERE "createdAt" >= ${since} AND lane <> 'blocked' AND "resultCount" = 0
        GROUP BY normalized ORDER BY count DESC, term ASC LIMIT ${limit}`,
    ]);
    return { since: since.toISOString(), missingKinds, missingPlaces, noResults };
  }
}
