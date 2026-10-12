import { config } from "dotenv";
import { PrismaService } from "../src/prisma/prisma.service.js";

config({ path: new URL("../.env", import.meta.url) });

export const testDatabaseUrl = (): string => {
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  process.env["DATABASE_URL"] = url;
  return url;
};

export function testPrisma(): PrismaService {
  return new PrismaService({
    databaseUrl: testDatabaseUrl(),
    port: 0,
    webOrigin: "http://localhost",
  });
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "Claim", "Membership", "User", "Organization", "BusinessKind", "Business", "Brand", "Kind", "Sector", "Place" CASCADE`,
  );
}
