import type { Localized } from "@darb/core";
import type { PlaceDto } from "@darb/contracts";
import type { Place } from "../generated/prisma/client.js";

export function toPlaceDto(row: Place): PlaceDto {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    name: row.name as Localized,
    status: row.status,
    lat: row.lat,
    lng: row.lng,
    parentId: row.parentId,
  };
}
