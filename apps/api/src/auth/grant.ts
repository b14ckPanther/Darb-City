import type { PrismaService } from "../prisma/prisma.service.js";

/** Grants or revokes the admin flag for a Clerk user id (user_…). No side effects at import. */
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

export const GRANT_USAGE = "Usage: pnpm --filter @darb/api admin:grant <user_…> [--revoke]";
const USER_ID = /^user_[A-Za-z0-9]+$/;

/**
 * Exactly one Clerk user id and at most one --revoke. Anything else (a typo such as --revok, a
 * second id) is an error: a mistyped revoke must never turn into a grant.
 */
export function parseGrantArgs(
  args: string[],
): { id: string; revoke: boolean } | { error: string } {
  const ids = args.filter((a) => USER_ID.test(a));
  const revokes = args.filter((a) => a === "--revoke");
  if (ids.length !== 1 || revokes.length > 1 || ids.length + revokes.length !== args.length)
    return { error: GRANT_USAGE };
  return { id: ids[0]!, revoke: revokes.length === 1 };
}
