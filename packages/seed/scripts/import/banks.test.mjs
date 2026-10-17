import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBanks } from "./banks.mjs";

const { rows } = JSON.parse(
  readFileSync(new URL("./fixtures/banks.json", import.meta.url), "utf8"),
);

describe("banks importer over a fixture", () => {
  const { businesses, counts, conflicts } = buildBanks({ rows });

  it("keeps open walk-in branches in the north and says why the rest are out", () => {
    expect(counts).toMatchObject({
      fetched: 7,
      notBranch: 1,
      digital: 1,
      closed: 1,
      outsideNorth: 1,
      pointFarFromTown: 1,
      emitted: 2,
    });
    expect(conflicts[0]).toMatch(/שלומי/);
    expect(businesses.map((b) => b.place).sort()).toEqual(["haifa", "nazareth"]);
  });
  it("writes a branch card with its bank, branch number and closed day", () => {
    const leumi = businesses.find((b) => b.brand === "leumi");
    expect(leumi).toMatchObject({
      primaryKind: "banks",
      kinds: ["banks"],
      tier: "basic",
      hours: { weekly: {}, exceptions: [] },
      attributes: { primaryAction: "directions", bankCode: 10 },
    });
    expect(leumi.slug).toMatch(/^leumi-/);
    expect(leumi.name.he).toMatch(/^בנק לאומי /);
    expect(leumi.name.ar).toMatch(/^بنك لئومي /);
    const labels = leumi.experience.items.map((i) => i.label.en);
    expect(labels.slice(0, 2)).toEqual(["Branch number", "Branch type"]);
    expect(leumi.experience.items[0].meta.en).toBe(String(leumi.attributes.branchCode));
  });
});
