import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  PhoneSchema,
  type FieldCaptureCreateDto,
  type FieldCaptureDto,
  type FieldCapturesDto,
  type FieldDuplicateQueryDto,
  type FieldMatchDto,
  type FieldReadResultDto,
  type FieldStatusDto,
  type JoinSuggestionDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { isBlocked } from "@darb/search-text";
import type { Redis } from "ioredis";
import { AdminWriter } from "../admin/admin-writer.js";
import { json } from "../admin/json.js";
import type { AdminActor } from "../auth/admin.guard.js";
import { APP_CONFIG, type AppConfig } from "../config.js";
import type { JoinRequest } from "../generated/prisma/client.js";
import { slugBase } from "../join/join.service.js";
import { MediaStore } from "../media/media.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { ModelBudget } from "../search/model-budget.js";
import { phoneKey, similarNames } from "./similar.js";
import { SIGN_READER, type SignReader } from "./sign-reader.js";

/** A similar name within this many metres is probably the same shop. */
export const NEAR_METRES = 50;
const DAY_KEY = (day: string) => `darb:field:reads:${day}`;
const MINE = 30;

const someText = (l: Record<string, string | null | undefined>) =>
  Object.fromEntries(
    Object.entries(l).filter((e): e is [string, string] => Boolean(e[1]?.trim())),
  ) as Localized;

export const toFieldCapture = (r: JoinRequest): FieldCaptureDto => ({
  id: r.id,
  clientId: r.clientId,
  businessName: r.businessName as FieldCaptureDto["businessName"],
  status: r.status,
  businessId: r.businessId,
  createdAt: r.createdAt.toISOString(),
});

/**
 * Add from the street: reading a sign from the admin's photo, the duplicate check, and the capture
 * itself, a draft business with its request in the join queue (source field). Nothing is public
 * until the request is approved there.
 */
@Injectable()
export class FieldService {
  private readonly logger = new Logger(FieldService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaStore,
    private readonly writer: AdminWriter,
    private readonly budget: ModelBudget,
    @Inject(SIGN_READER) private readonly reader: SignReader,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get readingOn(): boolean {
    return this.reader.name !== "off" && this.config.field.readsPerDay > 0;
  }

  status(): FieldStatusDto {
    return { reading: this.readingOn, uploads: this.media.enabled };
  }

  /** One of the day's sign readings, across every replica; a Redis failure means none. */
  private async takeRead(now = new Date()): Promise<boolean> {
    const key = DAY_KEY(now.toISOString().slice(0, 10));
    try {
      const res = await this.redis
        .multi()
        .incr(key)
        .expire(key, 2 * 86_400)
        .exec();
      return Number(res?.[0]?.[1] ?? Infinity) <= this.config.field.readsPerDay;
    } catch {
      return false;
    }
  }

  private activeKinds() {
    return this.prisma.kind.findMany({
      where: { status: "active" },
      select: { id: true, slug: true, name: true },
      orderBy: { slug: "asc" },
    });
  }

  /** `image` is already a WebP without metadata. Never throws: the form works without it. */
  async read(image: Buffer): Promise<FieldReadResultDto> {
    if (!this.readingOn) return { reading: null, reason: "off" };
    if (!(await this.takeRead()) || !(await this.budget.take()))
      return { reading: null, reason: "budget" };
    const kinds = await this.activeKinds();
    const found = await this.reader
      .read(
        { image, kinds: kinds.map((k) => `${k.slug}: ${(k.name as Localized).en ?? k.slug}`) },
        AbortSignal.timeout(this.config.field.timeoutMs),
      )
      .catch((err: unknown) => {
        this.logger.warn(`sign read failed: ${err instanceof Error ? err.name : "error"}`);
        return null;
      });
    if (!found || !found.sign) return { reading: null, reason: "unreadable" };
    if (found.excluded || (found.category !== null && isBlocked(found.category)))
      return { reading: null, reason: "excluded" };
    const phone = found.phone ? PhoneSchema.safeParse(found.phone) : null;
    return {
      reading: {
        name: found.name,
        phone: phone?.success ? phone.data : null,
        kindSlug: kinds.some((k) => k.slug === found.kind) ? found.kind : null,
        confidence: found.confidence,
      },
    };
  }

  /**
   * The same phone number anywhere (any status, phone or WhatsApp), or a similar name within
   * NEAR_METRES of the pin. Drafts count too: the queue may already hold this shop.
   */
  async duplicates(q: FieldDuplicateQueryDto): Promise<FieldMatchDto[]> {
    const here = { lat: q.lat, lng: q.lng };
    type Row = {
      id: string;
      name: Localized;
      slug: string;
      status: "draft" | "published" | "suspended";
      metres: number;
    };
    const key = phoneKey(q.phone);
    const national = (column: string) =>
      `regexp_replace(regexp_replace(regexp_replace(coalesce(b."${column}", ''), '\\D', '', 'g'), '^972', ''), '^0+', '')`;
    const [byPhone, near] = await Promise.all([
      key
        ? this.prisma.$queryRawUnsafe<Row[]>(
            `SELECT b.id, b.name, p.slug, b.status,
               ST_Distance(b.point, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)::int AS metres
             FROM "Business" b JOIN "Place" p ON p.id = b."placeId"
             WHERE ${national("phone")} = $1 OR ${national("whatsapp")} = $1
             LIMIT 10`,
            key,
            here.lng,
            here.lat,
          )
        : Promise.resolve([]),
      this.prisma.$queryRaw<Row[]>`
        SELECT b.id, b.name, p.slug, b.status,
          ST_Distance(b.point, ST_SetSRID(ST_MakePoint(${here.lng}, ${here.lat}), 4326)::geography)::int AS metres
        FROM "Business" b JOIN "Place" p ON p.id = b."placeId"
        WHERE ST_DWithin(b.point, ST_SetSRID(ST_MakePoint(${here.lng}, ${here.lat}), 4326)::geography, ${NEAR_METRES})
        ORDER BY metres
        LIMIT 50`,
    ]);
    const out = new Map<string, FieldMatchDto>();
    const add = (r: Row, reason: "phone" | "name") => {
      if (out.has(r.id)) return;
      out.set(r.id, {
        id: r.id,
        name: someText(r.name),
        placeSlug: r.slug,
        status: r.status,
        reason,
        metres: Math.max(0, Number(r.metres) || 0),
      });
    };
    for (const r of byPhone) add(r, "phone");
    for (const r of near) if (similarNames(q.name, r.name)) add(r, "name");
    return [...out.values()].slice(0, 10);
  }

  /** The closest city, town or village of any status, as /join picks it. */
  private async nearestPlace(lat: number, lng: number) {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Place"
      WHERE type IN ('city', 'town', 'village')
      ORDER BY "point" <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      LIMIT 1`;
    return rows[0] ? this.prisma.place.findUnique({ where: { id: rows[0].id } }) : null;
  }

  private async freeSlug(placeId: string, base: string): Promise<string> {
    const taken = new Set(
      (
        await this.prisma.business.findMany({
          where: { placeId, slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((b) => b.slug),
    );
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }

  /**
   * The capture as a draft business (source admin, never public until approved) and its request,
   * audited, in one transaction. The same clientId answers the capture it already made.
   */
  async create(
    actor: AdminActor,
    dto: FieldCaptureCreateDto,
  ): Promise<
    | { status: 200 | 201; body: FieldCaptureDto }
    | { status: 400; body: { message: string; code: string } }
  > {
    const existing = await this.prisma.joinRequest.findUnique({
      where: { clientId: dto.clientId },
    });
    if (existing) return { status: 200, body: toFieldCapture(existing) };
    const [place, kind] = await Promise.all([
      this.nearestPlace(dto.lat, dto.lng),
      this.prisma.kind.findFirst({ where: { slug: dto.kindSlug, status: "active" } }),
    ]);
    if (!place)
      return { status: 400, body: { message: "No town near this point", code: "no_place" } };
    if (!kind) return { status: 400, body: { message: "No such kind", code: "unknown_kind" } };
    // Only a key this API handed out and that the bucket still holds.
    const photo =
      dto.photo && dto.photo.startsWith("pending/") && (await this.media.exists(dto.photo))
        ? dto.photo
        : null;
    const name = someText(dto.name);
    const reading: JoinSuggestionDto | null = dto.reading
      ? {
          found: true,
          point: { lat: dto.lat, lng: dto.lng },
          ...(dto.reading.kindSlug ? { kindSlug: dto.reading.kindSlug } : {}),
          ...(Object.keys(someText(dto.reading.name)).length
            ? { name: someText(dto.reading.name) }
            : {}),
          ...(dto.reading.phone ? { phone: dto.reading.phone } : {}),
          sources: [],
          osm: false,
        }
      : null;
    const base = slugBase(name);
    for (let attempt = 0; ; attempt++) {
      const slug = await this.freeSlug(place.id, base);
      try {
        const row = await this.writer.write(actor, "create", "business", async (tx) => {
          const b = await tx.business.create({
            data: {
              slug,
              name: json(name),
              tagline: json(kind.name),
              address: json(place.name),
              primaryKindId: kind.id,
              placeId: place.id,
              lat: dto.lat,
              lng: dto.lng,
              phone: dto.phone,
              photos: json(photo ? [{ key: photo, alt: name }] : []),
              hours: json({ weekly: {}, exceptions: [] }),
              experience: json({}),
              tier: "basic",
              source: "admin",
              status: "draft",
              editedAt: new Date(),
              kinds: { create: [{ kindId: kind.id }] },
            },
          });
          const r = await tx.joinRequest.create({
            data: {
              businessId: b.id,
              businessName: json(name),
              ownerName: "",
              ownerPhone: "",
              note: dto.note || null,
              locale: dto.locale,
              source: "field",
              lookup: reading ? json(reading) : undefined,
              createdById: actor.userId,
              clientId: dto.clientId,
              ...(dto.capturedAt ? { createdAt: capped(dto.capturedAt) } : {}),
            },
          });
          return { row: r, entityId: b.id, fields: [], tags: [] };
        });
        return { status: 201, body: toFieldCapture(row) };
      } catch (err) {
        if (!(err instanceof ConflictException)) throw err;
        // The same capture arrived twice at once: answer the one that won.
        const won = await this.prisma.joinRequest.findUnique({ where: { clientId: dto.clientId } });
        if (won) return { status: 200, body: toFieldCapture(won) };
        // Another write took the slug between the check and the insert: pick again.
        if (attempt < 3) continue;
        throw err;
      }
    }
  }

  /** The admin's own captures, newest first, and how many were added today in Israel. */
  async mine(actor: AdminActor): Promise<FieldCapturesDto> {
    const [rows, today] = await Promise.all([
      this.prisma.joinRequest.findMany({
        where: { createdById: actor.userId, source: "field" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: MINE,
      }),
      this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM "JoinRequest"
        WHERE "createdById" = ${actor.userId}::uuid AND source = 'field'
          AND ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem')::date
            = (now() AT TIME ZONE 'Asia/Jerusalem')::date`,
    ]);
    return { today: Number(today[0]?.n ?? 0), items: rows.map(toFieldCapture) };
  }
}

/** When the phone took it (a queued capture may arrive hours later), never in the future. */
function capped(iso: string): Date {
  const at = new Date(iso);
  const now = new Date();
  const weekAgo = now.getTime() - 7 * 86_400_000;
  return Number.isNaN(at.getTime()) || at > now || at.getTime() < weekAgo ? now : at;
}
