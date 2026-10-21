import "server-only";
import { auth } from "@clerk/nextjs/server";
import { adminAuthMode } from "./mode";

/** Whether this request carries a Clerk session (the sign-in pages then open on the welcome). */
export async function hasClerkSession(): Promise<boolean> {
  if (adminAuthMode() !== "clerk") return false;
  try {
    return Boolean((await auth()).userId);
  } catch {
    return false;
  }
}
