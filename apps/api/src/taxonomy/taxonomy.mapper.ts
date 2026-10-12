import type { Localized } from "@darb/core";
import type { KindDto, SectorDto } from "@darb/contracts";
import type { Kind, Sector } from "../generated/prisma/client.js";

export const toSectorDto = (row: Sector): SectorDto => ({
  id: row.id,
  slug: row.slug,
  name: row.name as Localized,
  tagline: row.tagline as Localized,
  accent: row.accent,
  order: row.order,
});

export const toKindDto = (row: Kind): KindDto => ({
  id: row.id,
  slug: row.slug,
  sectorId: row.sectorId,
  parentKindId: row.parentKindId,
  name: row.name as Localized,
  template: row.template,
  attributes: row.attributes,
  icon: row.icon,
  order: row.order,
});
