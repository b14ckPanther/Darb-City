import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ loaded: false }));
vi.mock("dotenv/config", () => {
  env.loaded = true;
  return {};
});

describe("admin:grant", () => {
  it("has no .env side effect when imported", async () => {
    await import("./grant.js");
    expect(env.loaded).toBe(false);
  });

  it("takes one user id and an optional --revoke", async () => {
    const { parseGrantArgs } = await import("./grant.js");
    expect(parseGrantArgs(["user_abc123"])).toEqual({ id: "user_abc123", revoke: false });
    expect(parseGrantArgs(["user_abc123", "--revoke"])).toEqual({
      id: "user_abc123",
      revoke: true,
    });
    expect(parseGrantArgs(["--revoke", "user_abc123"])).toEqual({
      id: "user_abc123",
      revoke: true,
    });
  });

  it("refuses unknown flags and stray arguments instead of granting", async () => {
    const { parseGrantArgs, GRANT_USAGE } = await import("./grant.js");
    for (const args of [
      ["user_abc123", "--revok"],
      ["user_abc123", "-r"],
      ["user_abc123", "--revoke", "--revoke"],
      ["user_abc123", "user_def456"],
      ["user_abc123", "revoke"],
      ["not-a-user"],
      [],
    ])
      expect(parseGrantArgs(args), args.join(" ")).toEqual({ error: GRANT_USAGE });
  });
});
