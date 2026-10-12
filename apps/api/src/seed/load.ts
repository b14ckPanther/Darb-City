// Seeding owns every field it writes on places, sectors, kinds, brands and seed businesses: each run
// overwrites them from packages/seed/data, hides kinds that left the data and suspends seed businesses
// that left it. Plan 4 must settle who owns these fields once admins can edit them, or a re-seed
// will silently undo those edits.
import type { SeedBrand, SeedBusiness, SeedKind, SeedPlace, SeedSector } from "@darb/seed";
import { SCREEN_SCHEMA } from "@darb/seed";
import { Ajv } from "ajv";
import type { Prisma } from "../generated/prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";

/** Seed values are plain JSON already; this tells Prisma so. */
const json = (value: unknown) => value as Prisma.InputJsonValue;

export interface SeedData {
  places: SeedPlace[];
  sectors: SeedSector[];
  kinds: SeedKind[];
  brands: SeedBrand[];
  businesses: SeedBusiness[];
}
export interface SeedCounts {
  places: number;
  sectors: number;
  kinds: number;
  brands: number;
  businesses: number;
}

const validateScreen = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);

/** Interactive transactions default to a 5 s timeout; a group of seed writes can take longer. */
const TX = { maxWait: 10_000, timeout: 120_000 };
/** Businesses per transaction: big enough to save round trips, small enough to keep locks short. */
const BUSINESS_CHUNK = 1000;

export async function loadSeed(prisma: PrismaService, data: SeedData): Promise<SeedCounts> {
  for (const b of data.businesses) {
    if (!validateScreen(b.experience)) {
      throw new Error(
        `Invalid experience for ${b.place}/${b.slug}: ${JSON.stringify(validateScreen.errors)}`,
      );
    }
  }

  const placeIds = new Map<string, string>();
  const paths = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const p of data.places) {
      const parentId = p.parent ? placeIds.get(p.parent) : null;
      if (p.parent && !parentId)
        throw new Error(`Place ${p.slug} comes before its parent ${p.parent}`);
      const path = `${p.parent ? paths.get(p.parent)! : "/"}${p.slug}/`;
      const fields = {
        slug: p.slug,
        type: p.type,
        parentId: parentId ?? null,
        path,
        name: json(p.name),
        aliases: p.aliases,
        lat: p.lat,
        lng: p.lng,
        cbsCode: p.cbsCode,
        status: p.status,
      };
      // A CBS code is the stable identity, so a renamed slug updates the row in place.
      const row = await tx.place.upsert({
        where: p.cbsCode ? { cbsCode: p.cbsCode } : { slug: p.slug },
        create: fields,
        update: fields,
      });
      placeIds.set(p.slug, row.id);
      paths.set(p.slug, path);
    }
  }, TX);

  const sectorIds = new Map<string, string>();
  const kindIds = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const s of data.sectors) {
      const fields = {
        name: json(s.name),
        tagline: json(s.tagline),
        accent: s.accent,
        order: s.order,
      };
      const row = await tx.sector.upsert({
        where: { slug: s.slug },
        create: { slug: s.slug, ...fields },
        update: fields,
      });
      sectorIds.set(s.slug, row.id);
    }

    const pending = [...data.kinds];
    while (pending.length > 0) {
      const index = pending.findIndex((k) => !k.parent || kindIds.has(k.parent));
      if (index === -1)
        throw new Error(
          `Kind parents form a cycle or are missing: ${pending.map((k) => k.slug).join(", ")}`,
        );
      const k = pending.splice(index, 1)[0]!;
      const fields = {
        sectorId: sectorIds.get(k.sector)!,
        parentKindId: k.parent ? kindIds.get(k.parent)! : null,
        name: json(k.name),
        synonyms: json(k.synonyms),
        template: k.template,
        contentSchema: json(SCREEN_SCHEMA),
        attributes: k.attributes,
        icon: k.icon,
        order: k.order,
        status: k.status,
      };
      const row = await tx.kind.upsert({
        where: { slug: k.slug },
        create: { slug: k.slug, ...fields },
        update: fields,
      });
      kindIds.set(k.slug, row.id);
    }
    await tx.kind.updateMany({
      where: { slug: { notIn: data.kinds.map((k) => k.slug) } },
      data: { status: "hidden" },
    });
  }, TX);

  const brandIds = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const b of data.brands) {
      const row = await tx.brand.upsert({
        where: { slug: b.slug },
        create: { slug: b.slug, name: json(b.name) },
        update: { name: json(b.name) },
      });
      brandIds.set(b.slug, row.id);
    }
  }, TX);

  const businessIds: string[] = [];
  for (let start = 0; start < data.businesses.length; start += BUSINESS_CHUNK) {
    const chunk = data.businesses.slice(start, start + BUSINESS_CHUNK);
    await prisma.$transaction(async (tx) => {
      const links: { businessId: string; kindId: string }[] = [];
      const ids: string[] = [];
      for (const b of chunk) {
        const placeId = placeIds.get(b.place);
        if (!placeId) throw new Error(`Business ${b.slug} is in unknown place ${b.place}`);
        const fields = {
          name: json(b.name),
          tagline: json(b.tagline),
          primaryKindId: kindIds.get(b.primaryKind)!,
          lat: b.lat,
          lng: b.lng,
          address: json(b.address),
          hours: json(b.hours),
          attributes: json(b.attributes),
          experience: json(b.experience),
          tier: b.tier,
          source: "seed" as const,
          status: "published" as const,
          brandId: b.brand ? brandIds.get(b.brand)! : null,
        };
        const row = await tx.business.upsert({
          where: { placeId_slug: { placeId, slug: b.slug } },
          create: { slug: b.slug, placeId, ...fields },
          update: fields,
          select: { id: true },
        });
        ids.push(row.id);
        for (const k of b.kinds) links.push({ businessId: row.id, kindId: kindIds.get(k)! });
      }
      await tx.businessKind.deleteMany({ where: { businessId: { in: ids } } });
      await tx.businessKind.createMany({ data: links });
      businessIds.push(...ids);
    }, TX);
  }
  // Seed businesses that left the data stay in place (claims may point at them) but go dark.
  await prisma.business.updateMany({
    where: { source: "seed", id: { notIn: businessIds } },
    data: { status: "suspended" },
  });

  return {
    places: data.places.length,
    sectors: data.sectors.length,
    kinds: data.kinds.length,
    brands: data.brands.length,
    businesses: data.businesses.length,
  };
}
