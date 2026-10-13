import { Inject, Injectable } from "@nestjs/common";
import type {
  IntentDto,
  ResultsRequestDto,
  SearchRequestDto,
  SearchResponseDto,
} from "@darb/contracts";
import { isBlocked, normalize } from "@darb/search-text";
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from "../ai/embeddings.js";
import { CLOCK, type Clock } from "../businesses/businesses.controller.js";
import { BusinessesRepository } from "../businesses/businesses.repository.js";
import { toPlaceDto } from "../places/place.mapper.js";
import { TaxonomyRepository } from "../taxonomy/taxonomy.repository.js";
import { InstantService, type World } from "./instant.service.js";
import { IntentService } from "./intent.service.js";
import { rank } from "./ranking.js";
import { RetrievalRepository, type RetrievalFilters } from "./retrieval.repository.js";
import { SearchLogRepository } from "./search-log.repository.js";
import { candidateSummary } from "./summary.js";

export const NEAR_RADIUS_KM = 25;
export const EMBED_TIMEOUT_MS = 800;
type Point = { lat: number; lng: number };

const blockedResponse = (intent: IntentDto): SearchResponseDto => ({
  status: "blocked",
  lane: "instant",
  queryId: null,
  intent,
  needsLocation: false,
  items: [],
  nearest: [],
});

@Injectable()
export class SmartSearchService {
  constructor(
    private readonly intents: IntentService,
    private readonly instant: InstantService,
    private readonly retrieval: RetrievalRepository,
    private readonly taxonomy: TaxonomyRepository,
    private readonly businesses: BusinessesRepository,
    private readonly log: SearchLogRepository,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async search(req: SearchRequestDto): Promise<SearchResponseDto> {
    // Lane 1 first (in process, no network): blocked text never reaches the embeddings provider.
    const lane1 = await this.instant.match(req.q);
    const embedding = lane1.blocked ? Promise.resolve(null) : this.embed(req.q); // parallel with the intent
    const resolved = await this.intents.resolve(req.q, req.locale);
    if (resolved.blocked) {
      await this.log.record({
        normalized: resolved.instant.normalized,
        locale: req.locale,
        intent: resolved.intent,
        unmatched: [],
        lane: "blocked",
        resultCount: 0,
      });
      return blockedResponse(resolved.intent);
    }
    const body = await this.answer(resolved.intent, req.near ?? null, await embedding);
    const queryId = await this.log.record({
      normalized: resolved.instant.normalized,
      locale: req.locale,
      intent: resolved.intent,
      unmatched: resolved.instant.unmatched,
      lane: resolved.lane,
      resultCount: body.items.length,
    });
    return { ...body, lane: resolved.lane, queryId };
  }

  async results(req: ResultsRequestDto): Promise<SearchResponseDto | null> {
    const world = await this.instant.world();
    if (req.intent.kinds.some((k) => !world.kinds.has(k))) return null;
    if (req.intent.place && !world.places.has(req.intent.place)) return null;
    // The URL carries both the query and the free text: either may name what Darb does not list,
    // and neither then reaches the embeddings provider or retrieval.
    const names = world.prepared.names;
    if (isBlocked(req.q, names) || isBlocked(req.intent.freeText, names))
      return blockedResponse(req.intent);
    // The same text search() embeds (the query), so a chip edit never changes the ranking by
    // itself; the free text still narrows retrieval through the text filter.
    const body = await this.answer(req.intent, req.near ?? null, await this.embed(req.q));
    return { ...body, lane: "instant", queryId: null };
  }

  private async answer(intent: IntentDto, near: Point | null, embedding: number[] | null) {
    const world = await this.instant.world();
    const now = this.clock();
    const filters = await this.filters(intent, near, embedding, world, now);
    const items = rank(await this.retrieval.retrieve(filters)).map((c) => candidateSummary(c, now));
    const nearest =
      items.length === 0 && filters.kindIds
        ? await this.nearest(filters.kindIds, intent, near, world)
        : [];
    return {
      status: "ok" as const,
      intent,
      needsLocation: intent.nearMe && near === null,
      items,
      nearest,
    };
  }

  private async filters(
    intent: IntentDto,
    near: Point | null,
    embedding: number[] | null,
    world: World,
    now: Date,
  ): Promise<RetrievalFilters> {
    const kindIds = intent.kinds.length
      ? [
          ...new Set(
            (
              await Promise.all(
                // A kind can vanish between the intent and this world (a rebuild): drop it.
                intent.kinds
                  .map((k) => world.kinds.get(k))
                  .filter((k) => k !== undefined)
                  .map((k) => this.taxonomy.descendantKindIds(k.id)),
              )
            ).flat(),
          ),
        ]
      : null;
    const place = intent.place ? world.places.get(intent.place) : undefined;
    const point = intent.nearMe && near ? near : null;
    return {
      kindIds,
      placePath: place?.path ?? null,
      near: point,
      radiusKm: point && !place ? NEAR_RADIUS_KM : null,
      openAt: intent.openNow ? now : null,
      delivers: intent.attributes.delivers,
      text: normalize(intent.freeText),
      embedding,
    };
  }

  private async nearest(kindIds: string[], intent: IntentDto, near: Point | null, world: World) {
    const place = intent.place ? world.places.get(intent.place) : undefined;
    const origin = near ?? (place ? { lat: place.lat, lng: place.lng } : null);
    if (!origin) return [];
    const rows = await this.businesses.nearestPlacesWithKind(kindIds, origin.lat, origin.lng, 5);
    return rows.map((r) => ({ ...toPlaceDto(r.place), count: r.count, distanceKm: r.distanceKm }));
  }

  /** The query's embedding, or null when the provider is slow or failing (ranking then skips it). */
  private async embed(text: string): Promise<number[] | null> {
    if (text.trim() === "") return null;
    try {
      const [v] = await this.embeddings.embed(
        [text],
        "query",
        AbortSignal.timeout(EMBED_TIMEOUT_MS),
      );
      return v ?? null;
    } catch {
      return null;
    }
  }
}
