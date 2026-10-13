/** Runs once when a server instance starts: a misconfigured production server fails loudly. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertServerEnv } = await import("./lib/env");
  assertServerEnv();
}
