import { Injectable } from "@nestjs/common";
import type { Locale } from "@darb/core";
import type { IntentDto } from "@darb/contracts";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** Spec §4.7: anonymous. Never add an IP, user, user agent or coordinate here. */
@Injectable()
export class SearchLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    normalized: string;
    locale: Locale;
    intent: IntentDto;
    unmatched: string[];
    lane: "smart" | "instant" | "blocked";
    resultCount: number;
  }): Promise<string | null> {
    try {
      const row = await this.prisma.searchQuery.create({
        data: {
          ...entry,
          normalized: entry.normalized.slice(0, 200),
          intent: entry.intent as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      return row.id;
    } catch {
      return null; // a lost log line never fails a search
    }
  }

  async click(queryId: string, key: string): Promise<boolean> {
    const { count } = await this.prisma.searchQuery.updateMany({
      where: { id: queryId, clickedKey: null },
      data: { clickedKey: key },
    });
    return count > 0;
  }
}
