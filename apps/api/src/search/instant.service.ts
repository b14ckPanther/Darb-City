import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Localized } from "@darb/core";
import {
  buildInstantIndex,
  matchInstant,
  prepare,
  type InstantIndex,
  type InstantResult,
  type Prepared,
} from "@darb/search-text";
import { PrismaService } from "../prisma/prisma.service.js";

export interface WorldPlace {
  id: string;
  slug: string;
  path: string;
  status: "live" | "soon";
  lat: number;
  lng: number;
  name: Localized;
}
export interface WorldKind {
  id: string;
  slug: string;
  sectorId: string;
  name: Localized;
}
export interface World {
  /** Changes only when the set of active kinds changes; part of the intent cache key. */
  kindsVersion: string;
  /** The lane-1 index this world was built from (served to browsers by GET /search/instant-index). */
  index: InstantIndex;
  prepared: Prepared;
  places: Map<string, WorldPlace>;
  kinds: Map<string, WorldKind>;
}

const TTL_MS = 10 * 60_000;
type Synonyms = { he: string[]; ar: string[]; en: string[] };

/** Lane 1 on the server: the same index and matcher the browser uses, built from the database. */
@Injectable()
export class InstantService {
  private cached: { at: number; world: Promise<World> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  world(): Promise<World> {
    if (!this.cached || Date.now() - this.cached.at > TTL_MS) {
      const world = this.build();
      world.catch(() => (this.cached = null));
      this.cached = { at: Date.now(), world };
    }
    return this.cached.world;
  }

  async match(q: string): Promise<InstantResult> {
    return matchInstant((await this.world()).prepared, q);
  }

  invalidate(): void {
    this.cached = null;
  }

  private async build(): Promise<World> {
    const [places, kinds, sectors] = await Promise.all([
      this.prisma.place.findMany({ orderBy: { slug: "asc" } }),
      this.prisma.kind.findMany({ orderBy: { slug: "asc" } }),
      this.prisma.sector.findMany({ select: { id: true, slug: true } }),
    ]);
    const sectorSlug = new Map(sectors.map((s) => [s.id, s.slug]));
    const bySlugId = new Map(places.map((p) => [p.id, p.slug]));
    const kindSlug = new Map(kinds.map((k) => [k.id, k.slug]));
    const index = buildInstantIndex({
      places: places.map((p) => ({
        slug: p.slug,
        type: p.type,
        status: p.status,
        parent: p.parentId ? (bySlugId.get(p.parentId) ?? null) : null,
        name: p.name as Localized,
        aliases: p.aliases,
      })),
      kinds: kinds.map((k) => ({
        slug: k.slug,
        sector: sectorSlug.get(k.sectorId) ?? "",
        parent: k.parentKindId ? (kindSlug.get(k.parentKindId) ?? null) : null,
        status: k.status,
        name: k.name as Localized,
        synonyms: k.synonyms as Synonyms,
      })),
    });
    const activeSlugs = kinds
      .filter((k) => k.status === "active")
      .map((k) => k.slug)
      .sort();
    const kindsVersion = createHash("sha256")
      .update(activeSlugs.join(","))
      .digest("hex")
      .slice(0, 12);
    return {
      kindsVersion,
      index,
      prepared: prepare(index),
      places: new Map(
        places.map((p) => [
          p.slug,
          {
            id: p.id,
            slug: p.slug,
            path: p.path,
            status: p.status,
            lat: p.lat,
            lng: p.lng,
            name: p.name as Localized,
          },
        ]),
      ),
      kinds: new Map(
        kinds
          .filter((k) => k.status === "active")
          .map((k) => [
            k.slug,
            { id: k.id, slug: k.slug, sectorId: k.sectorId, name: k.name as Localized },
          ]),
      ),
    };
  }
}
