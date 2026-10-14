import { expect, it } from "vitest";

it("lets server modules import server-only under Vitest", async () => {
  await expect(import("server-only")).resolves.toBeDefined();
});
