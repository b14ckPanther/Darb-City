import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";

const prisma = testPrisma();
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

it("derives a PostGIS point from lat/lng", async () => {
  await prisma.place.create({
    data: {
      slug: "haifa",
      type: "city",
      path: "/haifa/",
      name: { en: "Haifa" },
      aliases: [],
      lat: 32.794,
      lng: 34.9896,
    },
  });
  const [row] = await prisma.$queryRaw<
    { wkt: string }[]
  >`SELECT ST_AsText("point"::geometry) AS wkt FROM "Place"`;
  expect(row?.wkt).toBe("POINT(34.9896 32.794)");
});
