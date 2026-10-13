import { Injectable } from "@nestjs/common";
import type { AdminActor } from "../auth/admin.guard.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { AuditAction, AuditEntity } from "../generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { SearchEntityName } from "../search/documents.js";
import { SearchEvents } from "../search/index-queue.js";
import { WebRevalidator } from "./revalidator.js";

export interface WriteResult<T> {
  row: T;
  entityId: string;
  fields: string[];
  tags: string[];
  search?: { entity: SearchEntityName; ids: string[] }[];
  /** Takedowns: the web expires the tags at once instead of serving stale while revalidating. */
  immediate?: boolean;
}

/**
 * Every admin write goes through here: the change and its audit row commit together; then search
 * reindexing and web revalidation are started without waiting (a slow Redis or web never holds
 * the admin's request).
 */
@Injectable()
export class AdminWriter {
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: SearchEvents,
    private readonly revalidator: WebRevalidator,
  ) {}

  async write<T>(
    actor: AdminActor,
    action: AuditAction,
    entity: AuditEntity,
    run: (tx: Prisma.TransactionClient) => Promise<WriteResult<T>>,
  ): Promise<T> {
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await run(tx);
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action,
          entityType: entity,
          entityId: r.entityId,
          fields: r.fields,
        },
      });
      return r;
    });
    for (const s of result.search ?? []) if (s.ids.length > 0) this.events.notify(s.entity, s.ids);
    const job: Promise<unknown> = this.revalidator
      .revalidate(result.tags, { immediate: result.immediate })
      .catch(() => false)
      .finally(() => this.pending.delete(job));
    this.pending.add(job);
    return result.row;
  }

  async settled(): Promise<void> {
    await Promise.all([...this.pending]);
  }
}
