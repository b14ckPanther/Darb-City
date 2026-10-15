// Seed ownership (Plan 4, decision 2): the seed owns a row while its editedAt is null. Each run
// creates missing rows and overwrites seed-owned ones from packages/seed/data, hides seed-owned
// kinds and plans that left the data and suspends seed-owned businesses that left it. A row an
// admin has edited (editedAt set) is never updated, hidden, suspended or relinked; "Return to seed
// data" in the admin clears editedAt so the next run overwrites it again.
import type {
  SeedBrand,
  SeedBusiness,
  SeedKind,
  SeedPlace,
  SeedPlan,
  SeedSector,
  SeedText,
} from "@darb/seed";
import { loadPlans, loadTexts, SCREEN_SCHEMA } from "@darb/seed";
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
  /** The pricing page; the seed's own data when left out (src/seed/run.ts passes none). */
  plans?: SeedPlan[];
  texts?: SeedText[];
}
export interface SeedCounts {
  places: number;
  sectors: number;
  kinds: number;
  brands: number;
  businesses: number;
  plans: number;
  texts: number;
}

const validateScreen = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);

/**
 * Interactive transactions default to a 5 s timeout; a group of seed writes can take longer. The
 * workflow runs on GitHub's US runners against Frankfurt, so each write is a long round trip: the
 * 1,138 places alone took just over 2 minutes in production.
 */
const TX = { maxWait: 10_000, timeout: 900_000 };
/** Businesses per transaction: big enough to save round trips, small enough to keep locks short. */
const BUSINESS_CHUNK = 1000;
const EDITED = { editedAt: { not: null } } as const;

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
  const editedPlaces = await prisma.place.findMany({
    where: EDITED,
    select: { id: true, slug: true, path: true, cbsCode: true },
  });
  const editedByCbs = new Map(editedPlaces.filter((p) => p.cbsCode).map((p) => [p.cbsCode!, p]));
  const editedBySlug = new Map(editedPlaces.map((p) => [p.slug, p]));
  await prisma.$transaction(async (tx) => {
    for (const p of data.places) {
      const edited =
        (p.cbsCode ? editedByCbs.get(p.cbsCode) : undefined) ?? editedBySlug.get(p.slug);
      if (edited) {
        placeIds.set(p.slug, edited.id);
        paths.set(p.slug, edited.path);
        continue;
      }
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
  const editedSectors = new Map(
    (await prisma.sector.findMany({ where: EDITED, select: { id: true, slug: true } })).map((s) => [
      s.slug,
      s.id,
    ]),
  );
  const editedKinds = new Map(
    (await prisma.kind.findMany({ where: EDITED, select: { id: true, slug: true } })).map((k) => [
      k.slug,
      k.id,
    ]),
  );
  await prisma.$transaction(async (tx) => {
    for (const s of data.sectors) {
      const edited = editedSectors.get(s.slug);
      if (edited) {
        sectorIds.set(s.slug, edited);
        continue;
      }
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
      const edited = editedKinds.get(k.slug);
      if (edited) {
        kindIds.set(k.slug, edited);
        continue;
      }
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
      where: { slug: { notIn: data.kinds.map((k) => k.slug) }, editedAt: null },
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

  const editedBusinesses = new Map(
    (
      await prisma.business.findMany({
        where: EDITED,
        select: { id: true, placeId: true, slug: true },
      })
    ).map((b) => [`${b.placeId}/${b.slug}`, b.id]),
  );
  const businessIds: string[] = [];
  for (let start = 0; start < data.businesses.length; start += BUSINESS_CHUNK) {
    const chunk = data.businesses.slice(start, start + BUSINESS_CHUNK);
    await prisma.$transaction(async (tx) => {
      const links: { businessId: string; kindId: string }[] = [];
      const ids: string[] = [];
      for (const b of chunk) {
        const placeId = placeIds.get(b.place);
        if (!placeId) throw new Error(`Business ${b.slug} is in unknown place ${b.place}`);
        const edited = editedBusinesses.get(`${placeId}/${b.slug}`);
        if (edited) {
          businessIds.push(edited); // kept: never suspended, never relinked
          continue;
        }
        const fields = {
          name: json(b.name),
          tagline: json(b.tagline),
          primaryKindId: kindIds.get(b.primaryKind)!,
          lat: b.lat,
          lng: b.lng,
          address: json(b.address),
          hours: json(b.hours),
          attributes: json(b.attributes),
          dietary: b.dietary ?? [],
          experience: json(b.experience),
          tier: b.tier,
          phone: b.phone ?? null,
          whatsapp: b.whatsapp ?? null,
          website: b.website ?? null,
          apps: json(b.apps ?? {}),
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
    where: { source: "seed", editedAt: null, id: { notIn: businessIds } },
    data: { status: "suspended" },
  });

  const plans = data.plans ?? loadPlans();
  const texts = data.texts ?? loadTexts();
  await loadPricing(prisma, plans, texts);

  return {
    places: data.places.length,
    sectors: data.sectors.length,
    kinds: data.kinds.length,
    brands: data.brands.length,
    businesses: data.businesses.length,
    plans: plans.length,
    texts: texts.length,
  };
}

/** Plans by slug and texts by key; seed-owned plans that left the data are hidden, like kinds. */
async function loadPricing(prisma: PrismaService, plans: SeedPlan[], texts: SeedText[]) {
  const editedPlans = new Set(
    (await prisma.plan.findMany({ where: EDITED, select: { slug: true } })).map((p) => p.slug),
  );
  const editedTexts = new Set(
    (await prisma.siteText.findMany({ where: EDITED, select: { key: true } })).map((t) => t.key),
  );
  await prisma.$transaction(async (tx) => {
    for (const p of plans) {
      if (editedPlans.has(p.slug)) continue;
      const fields = {
        order: p.order,
        status: p.status,
        name: json(p.name),
        tagline: json(p.tagline),
        monthly: p.monthly,
        setup: p.setup,
        priceNote: json(p.priceNote),
        features: json(p.features),
        highlighted: p.highlighted,
        ctaLabel: json(p.ctaLabel),
        ctaHref: p.ctaHref,
        finePrint: json(p.finePrint),
      };
      await tx.plan.upsert({
        where: { slug: p.slug },
        create: { slug: p.slug, ...fields },
        update: fields,
      });
    }
    await tx.plan.updateMany({
      where: { slug: { notIn: plans.map((p) => p.slug) }, editedAt: null },
      data: { status: "hidden" },
    });
    for (const t of texts) {
      if (editedTexts.has(t.key)) continue;
      await tx.siteText.upsert({
        where: { key: t.key },
        create: { key: t.key, value: json(t.value) },
        update: { value: json(t.value) },
      });
    }
  }, TX);
}
