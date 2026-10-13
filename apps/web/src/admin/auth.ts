import "server-only";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { adminAuthMode, FAKE_COOKIE } from "./mode";

/** The bearer token the API's AdminGuard verifies: a Clerk session JWT, or a fake one locally. */
export async function adminToken(): Promise<string | null> {
  const mode = adminAuthMode();
  if (mode === "fake") return (await cookies()).get(FAKE_COOKIE)?.value ?? null;
  if (mode === "clerk") return (await auth()).getToken();
  return null;
}
