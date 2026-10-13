import { describe, expect, it } from "vitest";
import { RANKING } from "./ranking.config.js";
import { rank } from "./ranking.js";
import type { Candidate } from "./retrieval.repository.js";

const row = (slug: string, tier: Candidate["row"]["tier"] = "example") => ({
  id: slug,
  slug,
  name: { en: slug },
  tagline: {},
  tier,
  primaryKindId: "k",
  placeId: "p",
  placeSlug: "sakhnin",
  lat: 0,
  lng: 0,
  photos: [],
  hours: { weekly: {}, exceptions: [] },
});
const c = (
  slug: string,
  f: Partial<Omit<Candidate, "row">>,
  tier?: Candidate["row"]["tier"],
): Candidate => ({
  row: row(slug, tier),
  text: 0,
  vector: 0,
  km: null,
  completeness: 0,
  ...f,
});
const order = (cs: Candidate[]) => rank(cs).map((r) => r.row.slug);

describe("ranking", () => {
  it("has weights that sum to 1 and a capped tier boost", () => {
    const w = RANKING.weights;
    expect(w.text + w.vector + w.distance + w.completeness).toBeCloseTo(1, 9);
    expect(Math.max(...Object.values(RANKING.tierBoost))).toBeLessThanOrEqual(RANKING.tierCap);
  });
  it("orders by text, then vector similarity", () => {
    expect(order([c("a", { text: 0.2 }), c("b", { text: 0.9 })])).toEqual(["b", "a"]);
    expect(order([c("a", { vector: 0.3 }), c("b", { vector: 0.8 })])).toEqual(["b", "a"]);
  });
  it("prefers the nearer of two equal matches", () => {
    expect(order([c("far", { text: 0.5, km: 12 }), c("near", { text: 0.5, km: 0.4 })])).toEqual([
      "near",
      "far",
    ]);
  });
  it("does not punish rows when distance is unknown for all", () => {
    const [r] = rank([c("a", { text: 1, vector: 1, completeness: 1 })]);
    expect(r!.relevance).toBeCloseTo(1, 9);
  });
  it("lets tier reorder only results of similar relevance", () => {
    // 0.02 apart: the darb tier (+0.03) overtakes.
    expect(order([c("plain", { text: 0.62 }), c("darb", { text: 0.6 }, "darb")])[0]).toBe("darb");
    // Far apart: it never does.
    expect(order([c("plain", { text: 0.9 }), c("darb", { text: 0.3 }, "darb")])[0]).toBe("plain");
  });
  it("is stable on ties and cut to the limit", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      c(`b${String(i).padStart(2, "0")}`, { text: 0.5 }),
    );
    const out = rank(many);
    expect(out).toHaveLength(RANKING.limit);
    expect(out[0]!.row.slug).toBe("b00");
  });
});

describe("ranking ties", () => {
  it("breaks a tie on slug, then on id (a chain repeats its slug in every town)", () => {
    const twin = (id: string, slug: string): Candidate => ({
      ...c(slug, { text: 0.5 }),
      row: { ...row(slug), id },
    });
    expect(
      rank([twin("id-2", "halawa"), twin("id-1", "halawa"), twin("id-0", "zeta")]).map(
        (r) => r.row.id,
      ),
    ).toEqual(["id-1", "id-2", "id-0"]);
  });
});
