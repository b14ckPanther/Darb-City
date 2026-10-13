import { afterAll, beforeEach, expect, it, vi } from "vitest";
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
