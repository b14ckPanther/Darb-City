/** Far beyond any place's business count; keeps Prisma's 32-bit `skip` in range. */
const MAX_OFFSET = 100_000;

/** Opaque page cursors. Today they wrap an offset; clients must not rely on that. */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

/** The offset a cursor stands for: 0 when absent, null when it is not a cursor we issued. */
export function decodeCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) return 0;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const offset = (value as { o?: unknown }).o;
    return typeof offset === "number" &&
      Number.isSafeInteger(offset) &&
      offset >= 0 &&
      offset <= MAX_OFFSET
      ? offset
      : null;
  } catch {
    return null;
  }
}
