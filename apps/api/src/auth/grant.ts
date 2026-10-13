import "dotenv/config";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** Grants or revokes the admin flag for a Clerk user id (user_…). */
export async function grantAdmin(
  prisma: PrismaService,
  clerkUserId: string,
  isAdmin: boolean,
): Promise<void> {
  await prisma.user.upsert({
    where: { clerkUserId },
    create: { clerkUserId, isAdmin },
    update: { isAdmin },
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--"));
  if (!id || !/^user_[A-Za-z0-9]+$/.test(id)) {
    console.error("Usage: pnpm --filter @darb/api admin:grant <user_…> [--revoke]");
    process.exit(1);
  }
  const prisma = new PrismaService(loadConfig(process.env));
  const revoke = args.includes("--revoke");
  await grantAdmin(prisma, id, !revoke);
  await prisma.$disconnect();
  console.log(`${revoke ? "Revoked" : "Granted"} admin for ${id}`);
}
