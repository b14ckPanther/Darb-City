// The admin:grant entry point. It alone reads apps/api/.env; grant.ts stays free of side effects.
import "dotenv/config";
import { loadConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { grantAdmin, parseGrantArgs } from "./grant.js";

const parsed = parseGrantArgs(process.argv.slice(2));
if ("error" in parsed) {
  console.error(parsed.error);
  process.exit(1);
}
const prisma = new PrismaService(loadConfig(process.env));
try {
  await grantAdmin(prisma, parsed.id, !parsed.revoke);
  console.log(`${parsed.revoke ? "Revoked" : "Granted"} admin for ${parsed.id}`);
} finally {
  await prisma.$disconnect();
}
