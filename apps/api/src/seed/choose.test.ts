import type { SeedBusiness } from "@darb/seed";
import { expect, it } from "vitest";
import { pickBusinesses } from "./choose.js";

const showroom = { slug: "example" } as SeedBusiness;
const client = { slug: "caramel" } as SeedBusiness;
const lists = { all: () => [showroom, client], real: () => [client] };

it("seeds the showroom examples and the clients by default", () => {
  expect(pickBusinesses({}, lists)).toEqual([showroom, client]);
  expect(pickBusinesses({ SEED_SHOWROOM: "1" }, lists)).toEqual([showroom, client]);
  expect(pickBusinesses({ SEED_SHOWROOM: "" }, lists)).toEqual([showroom, client]);
});

it("seeds only the real clients when SEED_SHOWROOM is 0", () => {
  expect(pickBusinesses({ SEED_SHOWROOM: "0" }, lists)).toEqual([client]);
});
