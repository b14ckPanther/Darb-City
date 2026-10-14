import { ConflictException, Injectable } from "@nestjs/common";
import type { AdminActor } from "../auth/admin.guard.js";
import { Prisma } from "../generated/prisma/client.js";
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

/** How long a takedown waits for the web to drop its cached pages before answering anyway. */
export const TAKEDOWN_WAIT_MS = 6000;

/** A write's row and, for takedowns only, whether the web confirmed it dropped the old pages. */
export interface Written<T> {
  row: T;
  /** Set only for takedowns with revalidation configured; false also means it timed out. */
  revalidated?: boolean;
}

/**
 * Every admin write goes through here: the change and its audit row commit together; then search
 * reindexing and web revalidation are started. Ordinary edits never wait for them (a slow Redis or
 * web never holds the admin's request). A takedown (`immediate`) waits for the web, up to
 * TAKEDOWN_WAIT_MS, and reports the outcome: a takedown that still shows publicly must never look
 * like it worked.
 */
@Injectable()
export class AdminWriter {
  private readonly pending = new Set<Promise<unknown>>();
  takedownWaitMs = TAKEDOWN_WAIT_MS;

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
    return (await this.writeReporting(actor, action, entity, run)).row;
  }

  /** Like write, plus the web revalidation outcome of a takedown. */
  async writeReporting<T>(
    actor: AdminActor,
    action: AuditAction,
    entity: AuditEntity,
    run: (tx: Prisma.TransactionClient) => Promise<WriteResult<T>>,
  ): Promise<Written<T>> {
    const result = await this.prisma
      .$transaction(async (tx) => {
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
      })
      .catch((err: unknown) => {
        // The callers check slugs first; this is the race where another write got there between.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
          throw new ConflictException({
            message: "That address is already in use; pick another",
            code: "already_exists",
          });
        throw err;
      });
    for (const s of result.search ?? []) if (s.ids.length > 0) this.events.notify(s.entity, s.ids);
    const job = this.revalidate(result.tags, result.immediate === true);
    if (result.immediate !== true || !this.revalidator.enabled) return { row: result.row };
    return { row: result.row, revalidated: await this.capped(job) };
  }

  /** Re-sends a takedown's revalidation (the admin's Retry); waits like a takedown does. */
  async retryTakedown(tags: string[]): Promise<boolean> {
    if (!this.revalidator.enabled) return false;
    return this.capped(this.revalidate(tags, true));
  }

  private revalidate(tags: string[], immediate: boolean): Promise<boolean> {
    const job: Promise<boolean> = this.revalidator
      .revalidate(tags, { immediate: immediate || undefined })
      .catch(() => false)
      .finally(() => this.pending.delete(job));
    this.pending.add(job);
    return job;
  }

  /** The job keeps running (and is still awaited by settled()) after the cap answers false. */
  private async capped(job: Promise<boolean>): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), this.takedownWaitMs);
    });
    try {
      return await Promise.race([job, late]);
    } finally {
      clearTimeout(timer);
    }
  }

  async settled(): Promise<void> {
    await Promise.all([...this.pending]);
  }
}
