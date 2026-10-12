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
  for (const p of data.places) {
    const parentId = p.parent ? placeIds.get(p.parent) : null;
    if (p.parent && !parentId)
      throw new Error(`Place ${p.slug} comes before its parent ${p.parent}`);
    const path = `${p.parent ? paths.get(p.parent)! : "/"}${p.slug}/`;
    const fields = {
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
    const row = await prisma.place.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...fields },
      update: fields,
    });
    placeIds.set(p.slug, row.id);
    paths.set(p.slug, path);
  }

  const sectorIds = new Map<string, string>();
  for (const s of data.sectors) {
    const fields = {
      name: json(s.name),
      tagline: json(s.tagline),
      accent: s.accent,
      order: s.order,
    };
    const row = await prisma.sector.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, ...fields },
      update: fields,
    });
    sectorIds.set(s.slug, row.id);
  }

  const kindIds = new Map<string, string>();
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
    const row = await prisma.kind.upsert({
      where: { slug: k.slug },
      create: { slug: k.slug, ...fields },
      update: fields,
    });
    kindIds.set(k.slug, row.id);
  }

  const brandIds = new Map<string, string>();
  for (const b of data.brands) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      create: { slug: b.slug, name: json(b.name) },
      update: { name: json(b.name) },
    });
    brandIds.set(b.slug, row.id);
  }

  for (const b of data.businesses) {
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
    const row = await prisma.business.upsert({
      where: { placeId_slug: { placeId, slug: b.slug } },
      create: { slug: b.slug, placeId, ...fields },
      update: fields,
    });
    await prisma.businessKind.deleteMany({ where: { businessId: row.id } });
    await prisma.businessKind.createMany({
      data: b.kinds.map((k) => ({ businessId: row.id, kindId: kindIds.get(k)! })),
    });
  }

  return {
    places: data.places.length,
    sectors: data.sectors.length,
    kinds: data.kinds.length,
    brands: data.brands.length,
    businesses: data.businesses.length,
  };
}
