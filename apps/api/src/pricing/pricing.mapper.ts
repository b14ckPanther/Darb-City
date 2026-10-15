import type { Localized } from "@darb/core";
import type { PlanDto } from "@darb/contracts";
import type { Plan } from "../generated/prisma/client.js";

type Features = PlanDto["features"];

export const toPlanDto = (row: Plan): PlanDto => ({
  id: row.id,
  slug: row.slug,
  order: row.order,
  name: row.name as Localized,
  tagline: row.tagline as Localized,
  monthly: row.monthly,
  setup: row.setup,
  priceNote: row.priceNote as Localized,
  features: row.features as Features,
  highlighted: row.highlighted,
  ctaLabel: row.ctaLabel as Localized,
  ctaHref: row.ctaHref,
  finePrint: row.finePrint as Localized,
});
