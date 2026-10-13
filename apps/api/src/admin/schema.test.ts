import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";

const prisma = testPrisma();
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

it("stores audit rows and leaves seed rows unedited by default", async () => {
  const f = await seedFixtures(prisma);
  expect(f.abuSalim.editedAt).toBeNull();
  expect(f.sakhnin.editedAt).toBeNull();
  const user = await prisma.user.create({ data: { clerkUserId: "user_a", isAdmin: true } });
  const row = await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "update",
      entityType: "business",
      entityId: f.abuSalim.id,
      fields: ["name"],
    },
  });
  expect(row.at).toBeInstanceOf(Date);
  const admin = await prisma.business.update({
    where: { id: f.abuSalim.id },
    data: { source: "admin", editedAt: new Date() },
  });
  expect(admin.source).toBe("admin");
});
