import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import { contract, type LocateQueryDto, type LocateResultDto } from "@darb/contracts";
import { pickText, type Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import { Geocoder } from "../join/geocoder.js";
import { resolveShortLink } from "../join/links.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RateLimiter } from "../search/rate-limiter.js";
import { Locator } from "./locate/locator.js";
import { Overpass } from "./locate/overpass.js";

/** Searches one admin may run a minute: plenty by hand, and Nominatim's queue stays short. */
export const LOCATE_PER_MINUTE = 20;

/** Find the place for the admin's business editor and street capture. */
@Injectable()
export class LocateAdmin {
  /** For short Google Maps links; replaced in tests. */
  fetchImpl: typeof fetch = fetch;
  private readonly locator: Locator;

  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: RateLimiter,
    geocoder: Geocoder,
    overpass: Overpass,
  ) {
    this.locator = new Locator({
      geocoder,
      overpass,
      resolveShort: (url) => resolveShortLink(url, this.fetchImpl),
    });
  }

  async locate(actor: AdminActor, dto: LocateQueryDto): Promise<LocateResultDto> {
    const limit = await this.limiter.hit("locate", actor.userId, LOCATE_PER_MINUTE);
    if (!limit.ok)
      return { found: null, alternatives: [], reason: "busy", address: null, googleLink: null };
    const place = dto.placeSlug
      ? await this.prisma.place.findUnique({ where: { slug: dto.placeSlug } }).catch(() => null)
      : null;
    // Hebrew first: OpenStreetMap in Israel names nearly every town in Hebrew.
    const town = dto.town || (place ? pickText(place.name as Localized, "he") : null);
    try {
      return await this.locator.locate({
        query: dto.query,
        locale: dto.locale,
        town,
        near: place ? { lat: place.lat, lng: place.lng } : null,
      });
    } catch {
      return {
        found: null,
        alternatives: [],
        reason: "not-found",
        address: null,
        googleLink: null,
      };
    }
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminLocateController {
  constructor(private readonly locate: LocateAdmin) {}

  @TsRestHandler(contract.admin.locate)
  handler(@Req() req: AdminRequest & { res?: { setHeader(k: string, v: string): void } }) {
    const actor = req.admin!;
    req.res?.setHeader("cache-control", "no-store");
    return tsRestHandler(contract.admin.locate, async ({ body }) => ({
      status: 200,
      body: await this.locate.locate(actor, body),
    }));
  }
}
