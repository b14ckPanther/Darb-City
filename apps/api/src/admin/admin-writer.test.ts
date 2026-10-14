import { ConflictException } from "@nestjs/common";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { SearchEvents } from "../search/index-queue.js";
import { AdminWriter } from "./admin-writer.js";
import type { WebRevalidator } from "./revalidator.js";

const prisma = testPrisma();
let f: Fixtures;
let actor: { userId: string; clerkUserId: string };
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  const u = await prisma.user.create({ data: { clerkUserId: "user_admin", isAdmin: true } });
  actor = { userId: u.id, clerkUserId: u.clerkUserId };
});
afterAll(() => prisma.$disconnect());

it("commits, audits, notifies search and revalidates, even when revalidation fails", async () => {
  const notify = vi.fn();
  const revalidate = vi.fn(async () => {
    throw new Error("web down");
  });
  const writer = new AdminWriter(
    prisma,
    { notify } as unknown as SearchEvents,
    { revalidate } as unknown as WebRevalidator,
  );
  const row = await writer.write(actor, "update", "business", async (tx) => {
    const b = await tx.business.update({
      where: { id: f.abuSalim.id },
      data: { name: { en: "Abu Salim" }, editedAt: new Date() },
    });
    return {
      row: b,
      entityId: b.id,
      fields: ["name"],
      tags: ["businesses"],
      search: [{ entity: "business", ids: [b.id] }],
    };
  });
  await writer.settled();
  expect(row.name).toEqual({ en: "Abu Salim" });
  expect(notify).toHaveBeenCalledWith("business", [f.abuSalim.id]);
  expect(revalidate).toHaveBeenCalledWith(["businesses"], { immediate: undefined });
  const audit = await prisma.auditLog.findMany();
  expect(audit.map((a) => [a.action, a.entityType, a.entityId, a.fields])).toEqual([
    ["update", "business", f.abuSalim.id, ["name"]],
  ]);
});

it("rolls back the change and the audit row together, and notifies nobody", async () => {
  const notify = vi.fn();
  const revalidate = vi.fn(async () => true);
  const writer = new AdminWriter(prisma, { notify } as never, { revalidate } as never);
  await expect(
    writer.write(actor, "update", "business", async (tx) => {
      await tx.business.update({ where: { id: f.abuSalim.id }, data: { name: { en: "Gone" } } });
      throw new Error("validation failed late");
    }),
  ).rejects.toThrow(/late/);
  expect(
    (await prisma.business.findUniqueOrThrow({ where: { id: f.abuSalim.id } })).name,
  ).not.toEqual({ en: "Gone" });
  expect(await prisma.auditLog.count()).toBe(0);
  expect(notify).not.toHaveBeenCalled();
  expect(revalidate).not.toHaveBeenCalled();
});

it("turns a unique-constraint race into a 409 conflict, not a 500", async () => {
  const notify = vi.fn();
  const writer = new AdminWriter(
    prisma,
    { notify } as unknown as SearchEvents,
    { revalidate: vi.fn(async () => true) } as unknown as WebRevalidator,
  );
  // As if another request took the slug between the pre-check and this write.
  const write = writer.write(actor, "update", "business", async (tx) => {
    const b = await tx.business.update({
      where: { id: f.littleCuts.id },
      data: { slug: f.abuSalim.slug, placeId: f.abuSalim.placeId },
    });
    return { row: b, entityId: b.id, fields: ["slug"], tags: [] };
  });
  await expect(write).rejects.toBeInstanceOf(ConflictException);
  await expect(write).rejects.toMatchObject({
    response: { code: "already_exists" },
    status: 409,
  });
  expect(notify).not.toHaveBeenCalled();
  expect(await prisma.auditLog.count()).toBe(0);
});

describe("takedowns wait for the web and report the outcome", () => {
  const takedown = (writer: AdminWriter, immediate?: true) =>
    writer.writeReporting(actor, "status", "business", async (tx) => {
      const b = await tx.business.update({
        where: { id: f.abuSalim.id },
        data: { status: "suspended" },
      });
      return { row: b, entityId: b.id, fields: ["status"], tags: ["businesses"], immediate };
    });
  const make = (revalidate: () => Promise<boolean>, enabled = true) =>
    new AdminWriter(prisma, { notify: vi.fn() } as never, { revalidate, enabled } as never);

  it("reports true when the web confirms", async () => {
    const out = await takedown(
      make(async () => true),
      true,
    );
    expect(out.revalidated).toBe(true);
    expect(out.row.status).toBe("suspended");
  });
  it("reports false when the web refuses or is unreachable", async () => {
    expect(
      (
        await takedown(
          make(async () => false),
          true,
        )
      ).revalidated,
    ).toBe(false);
    expect(
      (
        await takedown(
          make(async () => {
            throw new Error("down");
          }),
          true,
        )
      ).revalidated,
    ).toBe(false);
  });
  it("answers false after the cap, while the revalidation keeps running", async () => {
    let finish!: (ok: boolean) => void;
    const writer = make(() => new Promise<boolean>((resolve) => (finish = resolve)));
    writer.takedownWaitMs = 20;
    const out = await takedown(writer, true);
    expect(out.revalidated).toBe(false);
    let settled = false;
    const done = writer.settled().then(() => (settled = true));
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
    finish(true);
    await done;
  });
  it("never waits for or reports an ordinary edit", async () => {
    const writer = make(() => new Promise<boolean>(() => undefined));
    writer.takedownWaitMs = 60_000;
    const out = await takedown(writer);
    expect(out).not.toHaveProperty("revalidated");
  });
  it("reports nothing when revalidation is not configured (development)", async () => {
    const out = await takedown(
      make(async () => false, false),
      true,
    );
    expect(out).not.toHaveProperty("revalidated");
  });
  it("retries a takedown's tags immediately, with the same cap", async () => {
    const revalidate = vi.fn(async () => true);
    const writer = make(revalidate);
    expect(await writer.retryTakedown(["businesses"])).toBe(true);
    expect(revalidate).toHaveBeenCalledWith(["businesses"], { immediate: true });
    expect(await make(async () => true, false).retryTakedown(["businesses"])).toBe(false);
  });
});
